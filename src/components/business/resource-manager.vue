<template>
  <div class="pro-list-page">
    <PageHeader :title="definition.title" :description="definition.description">
      <template #actions>
        <Button v-if="canWrite" type="primary" @click="openEditor()">新增</Button>
      </template>
    </PageHeader>
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <ListPanel :summary="`共 ${total} 条记录`">
      <template #filters>
        <Input v-model="keyword" placeholder="按名称搜索" :maxlength="200" clearable />
      </template>
      <template #actions><Button :loading="loading" @click="reload">刷新</Button></template>
      <Table :data="items" :columns="columns" :loading="loading" row-key="id" :scroll="{ x: 1000 }">
        <template v-for="field in visibleFields" :key="field.key" #[field.key]="{ record }">
          {{ display(field, record[field.key]) }}
        </template>
        <template #action="{ record }">
          <Space>
            <Button theme="plain" size="small" :disabled="saving" @click="openEditor(record.id)">
              详情 / 编辑
            </Button>
            <Button
              v-if="definition.detail"
              theme="plain"
              size="small"
              :disabled="saving"
              @click="openDetail(record.id)"
            >
              {{ definition.detail.label }}
            </Button>
            <Button
              v-if="canReview(record)"
              theme="plain"
              size="small"
              :disabled="saving"
              @click="openReview(record.id)"
            >
              审核
            </Button>
            <Button
              v-if="canDelete"
              theme="plain"
              size="small"
              :disabled="saving"
              @click="deleteId = record.id"
            >
              删除
            </Button>
          </Space>
        </template>
      </Table>
      <Page v-model:page="page" :page-size="pageSize" :total="total" :disabled="loading" />
    </ListPanel>
    <Drawer
      v-model="editorOpen"
      :title="editing ? '记录详情' : '新增记录'"
      :width="520"
      :closable="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <p v-if="detailLoading">正在加载…</p>
      <p v-if="detailError" role="alert">
        {{ detailError }}
        <Button @click="openEditor(editing)">重试</Button>
      </p>
      <Form v-if="!detailLoading && !detailError" layout="vertical">
        <FormItem v-for="field in definition.fields" :key="field.key" :label="field.label">
          <Switch
            v-if="field.kind === 'boolean'"
            :model-value="Boolean(form[field.key])"
            :disabled="!editable || saving"
            @update:model-value="form[field.key] = $event"
          />
          <InputNumber
            v-else-if="field.kind === 'number'"
            :model-value="Number(form[field.key])"
            :min="field.min"
            :max="field.max"
            :precision="0"
            :disabled="!editable || saving"
            @update:model-value="form[field.key] = $event ?? field.initial"
          />
          <Select
            v-else-if="field.kind === 'select'"
            :model-value="selectValue(field)"
            :options="fieldOptions(field)"
            :multiple="field.multiple"
            :clearable="field.nullable || field.multiple"
            filterable
            block
            :disabled="!editable || saving"
            @update:model-value="setSelection(field, $event)"
          />
          <TextArea
            v-else-if="field.kind === 'textarea'"
            :model-value="String(form[field.key] ?? '')"
            :maxlength="field.maxLength"
            :disabled="!editable || saving"
            @update:model-value="form[field.key] = $event"
          />
          <Input
            v-else
            :type="
              field.kind === 'date' || field.kind === 'time' || field.kind === 'password'
                ? field.kind
                : 'text'
            "
            :model-value="form[field.key]"
            :maxlength="field.maxLength"
            :disabled="!editable || saving"
            @update:model-value="form[field.key] = $event"
          />
        </FormItem>
        <p v-if="definition.review && editing">
          审核状态：{{ detail?.status }}；审核备注：{{ detail?.reviewNote || "无" }}
        </p>
      </Form>
      <template #footer>
        <Button :disabled="saving" @click="editorOpen = false">关闭</Button>
        <Button
          v-if="editable"
          type="primary"
          :loading="saving"
          :disabled="detailLoading || !!detailError"
          @click="save"
        >
          保存
        </Button>
      </template>
    </Drawer>
    <Modal
      :model-value="!!deleteId"
      title="删除记录"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
      @update:model-value="!$event && (deleteId = '')"
    >
      <p>确定删除此记录？此操作无法撤销。</p>
      <template #footer>
        <Button :disabled="saving" @click="deleteId = ''">取消</Button>
        <Button type="danger" :loading="saving" @click="remove">确认删除</Button>
      </template>
    </Modal>
    <Modal
      :model-value="!!reviewId"
      title="审核申请"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
      @update:model-value="!$event && (reviewId = '')"
    >
      <TextArea v-model="reviewNote" placeholder="审核备注" :maxlength="2000" :disabled="saving" />
      <template #footer>
        <Button :disabled="saving" @click="reviewId = ''">取消</Button>
        <Button :loading="saving" @click="review(false)">驳回</Button>
        <Button type="primary" :loading="saving" @click="review(true)">通过</Button>
      </template>
    </Modal>
  </div>
</template>
<script setup lang="ts">
import { computed, onDeactivated, onScopeDispose, ref } from "vue";
import { useRouter } from "vue-router";
import { message, type Column, type SelectValue } from "kui-vue";
import {
  formValue,
  referenceOptions,
  workspaceApi,
  type BusinessRecord,
  type Field,
  type FormData,
  type ResourceDefinition,
} from "@/api/workspace";
import { useResourcePage } from "@/composables/use-resource-page";
import { hasPermission } from "@/routers/permissions";
import { useAuthStore } from "@/stores/auth";
import { reportFailure } from "@/utils/report-failure";

const props = defineProps<{ definition: ResourceDefinition }>();
const auth = useAuthStore();
const router = useRouter();
/** Membership and other per-record pages live outside this generic table. */
const openDetail = (id: string) =>
  router.push(`${props.definition.detail?.basePath || ""}/${encodeURIComponent(id)}`);
const keyword = ref("");
const { items, total, page, pageSize, loading, error, reload } = useResourcePage<BusinessRecord>(
  `/${props.definition.path}`,
  () => ({ keyword: keyword.value.trim() }),
);
const canWrite = computed(() =>
  hasPermission(
    props.definition.adminWrite ? "*" : `${props.definition.permission}:write`,
    auth.permissions,
  ),
);
const canDelete = computed(
  () =>
    props.definition.deletable &&
    hasPermission(`${props.definition.permission}:delete`, auth.permissions),
);
const visibleFields = computed(() => props.definition.fields.filter((field) => !field.hidden));
const columns = computed<Column[]>(() => [
  ...visibleFields.value.map((field) => ({ title: field.label, key: field.key, width: 160 })),
  ...(props.definition.review ? [{ title: "审核状态", key: "status", width: 120 }] : []),
  { title: "操作", key: "action", width: props.definition.detail ? 296 : 240, fixed: "right" },
]);
const editorOpen = ref(false),
  editing = ref<string>(),
  detail = ref<BusinessRecord>();
const detailLoading = ref(false),
  detailError = ref(""),
  saving = ref(false);
const form = ref<FormData>({});
const options = ref<Record<string, { label: string; value: string }[]>>({});
const editable = computed(
  () =>
    canWrite.value &&
    !(props.definition.review && editing.value && detail.value?.status !== "pending") &&
    !(props.definition.path === "roles" && detail.value?.code === "admin"),
);
let generation = 0;
const suspend = () => {
  generation++;
  editorOpen.value = false;
  reviewId.value = "";
  deleteId.value = "";
};
onDeactivated(suspend);
onScopeDispose(suspend);
function display(field: Field, value: unknown) {
  if (field.kind === "boolean") return value ? "是" : "否";
  return field.options?.find((option) => option.value === value)?.label || String(value ?? "—");
}
function selectValue(field: Field): SelectValue | SelectValue[] | undefined {
  return (form.value[field.key] ?? undefined) as SelectValue | SelectValue[] | undefined;
}
function setSelection(field: Field, value: SelectValue | SelectValue[] | undefined) {
  form.value[field.key] =
    value == null
      ? field.multiple
        ? []
        : null
      : Array.isArray(value)
        ? value.map(String)
        : String(value);
}
function fieldOptions(field: Field) {
  const result = [...(field.options || options.value[field.key] || [])];
  const values = Array.isArray(form.value[field.key])
    ? (form.value[field.key] as string[])
    : [form.value[field.key]];
  for (const value of values)
    if (value && !result.some((option) => option.value === value))
      result.push({ label: `${value}（当前关联）`, value: String(value) });
  return field.key === "parentId"
    ? result.filter((option) => option.value !== editing.value)
    : result;
}
async function openEditor(id?: string) {
  if (saving.value) return;
  const current = ++generation;
  editing.value = id;
  detail.value = undefined;
  detailError.value = "";
  editorOpen.value = true;
  detailLoading.value = true;
  options.value = {};
  try {
    const row = id ? await workspaceApi.get(props.definition.path, id) : undefined;
    if (current !== generation) return;
    detail.value = row;
    form.value = formValue(props.definition, row);
    if (editable.value) {
      const sourcePermissions = {
        projects: "project:read",
        roles: "system:role:read",
        departments: "system:user:read",
        permissions: "system:role:read",
        menus: "system:menu:read",
      };
      const entries = await Promise.all(
        props.definition.fields
          .filter(
            (field) =>
              field.source && hasPermission(sourcePermissions[field.source], auth.permissions),
          )
          .map(async (field) => [field.key, await referenceOptions(field.source!)] as const),
      );
      if (current !== generation) return;
      options.value = Object.fromEntries(entries);
    }
  } catch (reason) {
    if (current === generation)
      detailError.value = reason instanceof Error ? reason.message : "加载失败";
  } finally {
    if (current === generation) detailLoading.value = false;
  }
}
async function save() {
  if (saving.value || !editable.value || detailLoading.value || detailError.value) return;
  for (const field of props.definition.fields)
    if (field.required && !String(form.value[field.key] ?? "").trim())
      return message.warning(`请填写${field.label}`);
  if (props.definition.path === "users" && !editing.value && !form.value.password)
    return message.warning("新建用户必须填写密码");
  saving.value = true;
  try {
    await workspaceApi.save(props.definition, form.value, editing.value);
    editorOpen.value = false;
    message.success("保存成功");
    await reload();
  } catch (reason) {
    reportFailure(reason, "保存失败");
  } finally {
    saving.value = false;
  }
}
const deleteId = ref(""),
  reviewId = ref(""),
  reviewNote = ref("");
const canReview = (row: BusinessRecord) =>
  props.definition.review &&
  row.status === "pending" &&
  row.ownerId !== auth.user.id &&
  hasPermission("approval:review", auth.permissions);
const openReview = (id: string) => {
  reviewId.value = id;
  reviewNote.value = "";
};
async function remove() {
  if (saving.value || !canDelete.value || !deleteId.value) return;
  saving.value = true;
  try {
    await workspaceApi.remove(props.definition.path, deleteId.value);
    deleteId.value = "";
    message.success("已删除");
    await reload();
  } catch (reason) {
    reportFailure(reason, "删除失败");
  } finally {
    saving.value = false;
  }
}
async function review(approved: boolean) {
  if (saving.value || !reviewId.value || !hasPermission("approval:review", auth.permissions))
    return;
  saving.value = true;
  try {
    await workspaceApi.review(reviewId.value, approved, reviewNote.value);
    reviewId.value = "";
    message.success("审核完成");
    await reload();
  } catch (reason) {
    reportFailure(reason, "审核失败");
  } finally {
    saving.value = false;
  }
}
</script>

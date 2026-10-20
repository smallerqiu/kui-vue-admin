<template>
  <div class="pro-list-page">
    <PageHeader
      title="部门维护"
      description="部门决定「本部门」数据范围的归属；改名只改名称，已有记录跟着这张表走。"
    >
      <template #actions>
        <Button v-if="canWrite" type="primary" @click="openEditor()">新增部门</Button>
      </template>
    </PageHeader>

    <Alert
      v-if="!canWrite"
      type="info"
      show-icon
      title="只读"
      description="新增、改名和删除只对超级管理员开放，其余账号在这里核对名称，到用户管理里分配归属。"
    />

    <p v-if="loading" role="status">正在加载部门…</p>
    <p v-else-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>

    <ListPanel v-else :summary="`共 ${shown.length} 个部门`">
      <template #filters>
        <Input v-model="keyword" placeholder="按名称搜索" :maxlength="120" clearable />
      </template>
      <template #actions>
        <Button :loading="loading" @click="reload">刷新</Button>
      </template>
      <Table
        :data="shown"
        :columns="columns"
        :loading="loading"
        row-key="id"
        :scroll="{ x: 720 }"
      >
        <template #action="{ record }">
          <Space>
            <Button theme="plain" size="small" :disabled="!canWrite" @click="openEditor(record)">
              改名
            </Button>
            <Button theme="plain" size="small" :disabled="!canWrite" @click="openDelete(record)">
              删除
            </Button>
          </Space>
        </template>
      </Table>
    </ListPanel>

    <Modal
      :model-value="editorOpen"
      :title="editing ? '部门改名' : '新增部门'"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
      @update:model-value="!$event && closeEditor()"
    >
      <Form layout="vertical">
        <FormItem label="部门名称">
          <Input
            v-model="draftName"
            placeholder="例如 平台组"
            :maxlength="120"
            :disabled="saving"
          />
        </FormItem>
      </Form>
      <p v-if="formError" role="alert">{{ formError }}</p>
      <template #footer>
        <Button :disabled="saving" @click="closeEditor">取消</Button>
        <Button type="primary" :loading="saving" @click="submit">保存</Button>
      </template>
    </Modal>

    <Modal
      :model-value="!!pendingDelete"
      title="删除部门"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
      @update:model-value="!$event && closeDelete()"
    >
      <p>确定删除「{{ pendingDelete?.name }}」？此操作无法撤销。</p>
      <p v-if="deleteError" role="alert">{{ deleteError }}</p>
      <template #footer>
        <Button :disabled="saving" @click="closeDelete">取消</Button>
        <Button type="danger" :loading="saving" @click="remove">确认删除</Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PageHeader, message, type Column } from "kui-vue";
import {
  createDepartment,
  loadDepartments,
  removeDepartment,
  renameDepartment,
  type Department,
} from "@/api/departments";
import { useRemoteData } from "@/composables/use-remote-data";
import { hasPermission } from "@/routers/permissions";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
/** The write routes ask for the wildcard permission, so the buttons match it exactly. */
const canWrite = computed(() => hasPermission("*", auth.permissions));

const { data, loading, error, reload } = useRemoteData(loadDepartments);
const departments = computed(() => data.value ?? []);
const keyword = ref("");
/** The directory is small and served whole, so searching it happens here. */
const shown = computed(() => {
  const term = keyword.value.trim();
  return term ? departments.value.filter((row) => row.name.includes(term)) : departments.value;
});
const columns: Column[] = [
  { title: "部门名称", key: "name", width: 480 },
  { title: "操作", key: "action", width: 200, fixed: "right" },
];

const saving = ref(false);
const editorOpen = ref(false);
const editing = ref<Department>();
const draftName = ref("");
const formError = ref("");

function openEditor(row?: Department) {
  if (saving.value || !canWrite.value) return;
  editing.value = row;
  draftName.value = row?.name ?? "";
  formError.value = "";
  editorOpen.value = true;
}
function closeEditor() {
  if (saving.value) return;
  editorOpen.value = false;
  editing.value = undefined;
  formError.value = "";
}

async function submit() {
  if (saving.value || !canWrite.value || !editorOpen.value) return;
  const name = draftName.value.trim();
  if (!name) {
    formError.value = "请填写部门名称";
    return;
  }
  if (departments.value.some((row) => row.name === name && row.id !== editing.value?.id)) {
    formError.value = "已经有同名部门了";
    return;
  }
  saving.value = true;
  formError.value = "";
  const renaming = editing.value;
  try {
    if (renaming) await renameDepartment(renaming.id, name);
    else await createDepartment(name);
    editorOpen.value = false;
    editing.value = undefined;
    message.success(renaming ? "部门已改名" : "部门已创建");
    await reload();
  } catch (reason) {
    // A rejected write keeps the name on screen, and the server's own wording is
    // what explains it, so the field stays open with the reason under it.
    formError.value = reason instanceof Error ? reason.message : "保存失败";
  } finally {
    saving.value = false;
  }
}

const pendingDelete = ref<Department>();
const deleteError = ref("");

function openDelete(row: Department) {
  if (saving.value || !canWrite.value) return;
  pendingDelete.value = row;
  deleteError.value = "";
}
function closeDelete() {
  if (saving.value) return;
  pendingDelete.value = undefined;
  deleteError.value = "";
}

async function remove() {
  if (saving.value || !pendingDelete.value) return;
  const target = pendingDelete.value;
  saving.value = true;
  deleteError.value = "";
  try {
    await removeDepartment(target.id);
    pendingDelete.value = undefined;
    message.success("部门已删除");
    await reload();
  } catch (reason) {
    // A 409 names the table and the count that still belongs to the department,
    // which is the only way the operator learns where to reassign people.
    deleteError.value = reason instanceof Error ? reason.message : "删除失败";
  } finally {
    saving.value = false;
  }
}
</script>

<route lang="yaml">
meta:
  title: "部门维护"
  icon: "Building2"
  order: 3
  permissions: ["system:user:read"]
</route>

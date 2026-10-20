<template>
  <div class="project-member-page">
    <PageHeader :title="roster ? projectName || '项目成员' : '项目成员'" description="维护项目成员；负责人由项目资料决定，不在这里修改。">
      <template #actions>
        <Button :icon="ArrowLeft" @click="router.back()">返回</Button>
      </template>
    </PageHeader>

    <p v-if="loading" role="status">正在加载项目成员…</p>
    <p v-else-if="error" role="alert">
      {{ error }}
      <Button @click="load">重试</Button>
    </p>

    <Grid v-else-if="roster" :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Card bordered title="项目概况">
          <div class="project-identity">
            <span class="project-icon"><Icon :type="FolderKanban" /></span>
            <h2>{{ projectName || "未命名项目" }}</h2>
            <p>{{ projectCode }}</p>
          </div>
          <Divider />
          <div class="project-facts">
            <p><small>负责人</small><strong>{{ personText(roster.owner) }}</strong></p>
            <p><small>状态</small><strong>{{ statusLabel }}</strong></p>
            <p><small>截止日期</small><strong>{{ projectDeadline || "待确认" }}</strong></p>
            <p><small>成员数</small><strong>{{ roster.members.length }} 人</strong></p>
          </div>
        </Card>
      </GridItem>

      <GridItem :span="{ xs: 1, lg: 8 }">
        <Card bordered title="项目成员">
          <Alert
            v-if="directoryUnavailable"
            type="warning"
            show-icon
            title="无法读取用户目录"
            description="缺少 system:user:read 权限或目录请求失败：可以移除已在名单里的人，但无法搜索新成员。需要添加时请联系具备该权限的账号。"
          />
          <Form layout="vertical" class="member-form">
            <FormItem label="成员">
              <Select
                v-model="draft"
                :options="memberOptions"
                multiple
                clearable
                filterable
                block
                :disabled="!canEdit || saving"
                placeholder="选择项目成员"
              />
            </FormItem>
          </Form>
          <div v-if="roster.members.length" class="member-list">
            <div v-for="member in roster.members" :key="member.userId" class="member-row">
              <Flex align="center" :size="10">
                <Avatar :style="{ background: avatarColor(member.fullName) }">
                  {{ member.fullName.slice(0, 1) }}
                </Avatar>
                <div class="member-names">
                  <strong>{{ member.fullName }}</strong>
                  <small>{{ member.account }}{{ member.email ? ` · ${member.email}` : "" }}</small>
                </div>
              </Flex>
              <Tag v-if="member.userId === roster.owner?.userId" theme="fill">负责人</Tag>
            </div>
          </div>
          <Empty v-else description="这个项目还没有成员" />

          <Flex justify="space-between" align="center" :size="12" class="member-actions">
            <span class="member-hint">{{ hint }}</span>
            <Space>
              <Button :disabled="saving || !dirty" @click="resetDraft">放弃修改</Button>
              <Button
                type="primary"
                :loading="saving"
                :disabled="!canEdit || !dirty"
                @click="save"
              >
                保存成员
              </Button>
            </Space>
          </Flex>
        </Card>
      </GridItem>
    </Grid>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, FolderKanban } from "kui-icons";
import { PageHeader, message } from "kui-vue";
import { computed, onActivated, onDeactivated, onScopeDispose, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  loadAssignablePeople,
  loadProjectRoster,
  saveProjectMembers,
  type PersonOption,
  type ProjectPerson,
  type ProjectRoster,
} from "@/api/collaboration";
import { resources, workspaceApi, type BusinessRecord } from "@/api/workspace";
import { hasPermission } from "@/routers/permissions";
import { useAuthStore } from "@/stores/auth";
import { reportFailure } from "@/utils/report-failure";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const canEdit = computed(() => hasPermission("project:write", auth.permissions));

const roster = ref<ProjectRoster>();
const project = ref<BusinessRecord>();
const people = ref<PersonOption[]>([]);
const directoryUnavailable = ref(false);
const loading = ref(false);
const saving = ref(false);
const error = ref("");
const draft = ref<string[]>([]);

const id = () => String(route.params.id || "");
const personLabel = (row: ProjectPerson) => `${row.fullName} (${row.account})`;
const personText = (row: ProjectPerson | null) => (row ? personLabel(row) : "未指定");
const avatarColor = (name: string) =>
  ["#3a95ff", "#7b61ff", "#22a06b", "#f59e0b", "#ef6b73"][name.charCodeAt(0) % 5];

/** Header fields come from the project row, which the roster endpoint does not repeat. */
const projectName = computed(() => String(project.value?.name || ""));
const projectCode = computed(() => String(project.value?.code || "—"));
const projectDeadline = computed(() => String(project.value?.deadline || ""));
const statusLabel = computed(() => {
  const field = resources.projects!.fields.find((row) => row.key === "status");
  return field?.options?.find((option) => option.value === project.value?.status)?.label || "—";
});

/**
 * The picker always knows everyone already on the project, even when the user
 * directory request was refused, so removing a member never needs that permission.
 */
const memberOptions = computed(() => {
  const rows = [...people.value];
  for (const member of roster.value?.members || [])
    if (!rows.some((row) => row.value === member.userId))
      rows.push({ label: `${personLabel(member)}（当前成员）`, value: member.userId });
  return rows;
});
const saved = computed(() => (roster.value?.members || []).map((member) => member.userId));
const dirty = computed(() => draft.value.join("\u0000") !== saved.value.join("\u0000"));
const hint = computed(() => {
  if (!canEdit.value) return "没有 project:write 权限，名单只读。";
  if (!dirty.value) return "保存会整份替换成员名单，未选中的人将离开项目。";
  const added = draft.value.filter((value) => !saved.value.includes(value)).length;
  const removed = saved.value.filter((value) => !draft.value.includes(value)).length;
  return `待保存：新增 ${added} 人，移除 ${removed} 人。`;
});

function resetDraft() {
  draft.value = [...saved.value];
}

let generation = 0;
let active = true;
async function load() {
  const record = id();
  if (!record || !route.path.startsWith("/project/")) return;
  const current = ++generation;
  roster.value = undefined;
  error.value = "";
  loading.value = true;
  try {
    const [rows, detail] = await Promise.all([
      loadProjectRoster(record),
      workspaceApi.get("projects", record),
    ]);
    if (current !== generation) return;
    roster.value = rows;
    project.value = detail;
    resetDraft();
  } catch (reason) {
    if (current === generation)
      error.value = reason instanceof Error ? reason.message : "项目成员加载失败";
  } finally {
    if (current === generation) loading.value = false;
  }
}

async function loadDirectory() {
  directoryUnavailable.value = false;
  try {
    people.value = await loadAssignablePeople();
  } catch {
    // Any directory failure leaves the same degraded mode: removals still work,
    // a 403 is the common case but a network error must not look like success.
    directoryUnavailable.value = true;
    people.value = [];
  }
}

async function save() {
  const record = id();
  if (saving.value || !canEdit.value || !roster.value || !dirty.value) return;
  const current = generation;
  saving.value = true;
  try {
    const result = await saveProjectMembers(record, draft.value);
    if (current !== generation) return;
    roster.value = result;
    resetDraft();
    message.success("项目成员已保存");
  } catch (reason) {
    // The draft stays so the user can fix it; the server says what it refused.
    reportFailure(reason, "项目成员保存失败");
  } finally {
    saving.value = false;
  }
}

watch(
  () => route.params.id,
  () => {
    if (active) void load();
  },
  { immediate: true },
);
onActivated(() => {
  if (!active) {
    active = true;
    void load();
  }
});
onDeactivated(() => {
  active = false;
  generation++;
});
onScopeDispose(() => generation++);
void loadDirectory();
</script>

<style scoped lang="less">
.project-member-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8px 6px 20px;
}
.project-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 0 2px;
}
.project-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  color: var(--kui-color-primary);
  border-radius: var(--kui-card-radius, var(--kui-border-radius-card));
  background: var(--kui-theme-fill-bg, var(--kui-color-bg-component-overlay));
  font-size: 22px;
}
.project-identity h2 {
  margin: 4px 0 0;
  color: var(--kui-color-text-title);
  font-size: 17px;
}
.project-identity p {
  margin: 0;
  color: var(--kui-color-text-placeholder);
  font-size: 12px;
}
.project-facts {
  display: grid;
  gap: 12px;
}
.project-facts p {
  display: grid;
  gap: 3px;
  margin: 0;
}
.project-facts small {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.project-facts strong {
  color: var(--kui-color-text-title);
  font-weight: 600;
}
.member-form {
  margin-bottom: 4px;
}
.member-list {
  display: grid;
  gap: 4px;
  margin-bottom: 14px;
}
.member-row {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--kui-color-border);
}
.member-names {
  display: grid;
  gap: 2px;
}
.member-names strong {
  color: var(--kui-color-text-title);
  font-size: 13px;
}
.member-names small {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.member-actions {
  margin-top: 6px;
}
.member-hint {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
</style>

<route lang="yaml">
meta:
  title: "项目成员"
  icon: "FolderKanban"
  showInMenu: false
  activeMenu: "/projects"
</route>

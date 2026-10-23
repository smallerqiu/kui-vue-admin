<template>
  <div class="project-member-page">
    <PageHeader
      :title="roster ? projectName || '项目成员' : '项目成员'"
      description="维护项目成员与项目里程碑；负责人由项目资料决定，不在这里修改。"
    >
      <template #actions>
        <Button :icon="ArrowLeft" @click="router.back()">返回</Button>
      </template>
    </PageHeader>

    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="load">重试</Button>
    </p>

    <Grid v-else :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Card bordered title="项目概况">
          <Skeleton avatar :loading="!roster" :delay="0" :title-width="50" :rows="4" animated>
            <template v-if="roster">
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
            </template>
          </Skeleton>
        </Card>
      </GridItem>

      <GridItem :span="{ xs: 1, lg: 8 }">
        <Card bordered title="项目成员">
          <!-- The picker starts empty and the roster lands into it, so showing it early
               would silently replace whatever was typed in the meantime. -->
          <Skeleton :loading="!roster" :delay="0" :title-width="0" :rows="5" animated>
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
            <div v-if="roster?.members.length" class="member-list">
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
          </Skeleton>
        </Card>
      </GridItem>

      <GridItem :span="{ xs: 1, lg: 12 }">
        <Card bordered title="项目里程碑">
          <!-- A plan the account cannot read is a different answer from a project that has
               no plan yet, so the two states get two sentences and never one another's. -->
          <Skeleton :loading="planPending" :delay="0" :title-width="0" :rows="4" animated>
            <Alert
              v-if="!canReadPlan"
              type="warning"
              show-icon
              title="无法读取项目计划"
              description="当前账号没有 milestone:read 权限，这里显示不了这个项目的里程碑。需要看计划请联系具备该权限的账号。"
            />
            <div v-else-if="planError" class="plan-refused">
              <span>{{ planError }}</span>
              <Button size="small" @click="retryPlan">重试</Button>
            </div>
            <template v-else-if="plan">
              <Alert
                v-if="plan.truncated"
                type="warning"
                show-icon
                title="计划没有读完"
                :description="`一次只读到前 ${MAX_PLAN_MILESTONES} 条，这个项目共有 ${plan.total} 条里程碑。`"
              />
              <div v-if="canWritePlan" class="plan-form">
                <Input
                  v-model="draftTitle"
                  :disabled="savingPlan"
                  placeholder="里程碑标题，例如 需求范围确认"
                />
                <DatePicker
                  v-model="draftDue"
                  value-type="string"
                  :disabled="savingPlan"
                  placeholder="到期日"
                />
                <Space>
                  <Button v-if="editing" theme="plain" :disabled="savingPlan" @click="stopEditing">
                    取消编辑
                  </Button>
                  <Button
                    type="primary"
                    :loading="savingPlan"
                    :disabled="!draftValid"
                    @click="submitDraft"
                  >
                    {{ editing ? "保存里程碑" : "新增里程碑" }}
                  </Button>
                </Space>
              </div>
              <p v-else class="plan-hint">没有 milestone:write 权限，计划只读。</p>

              <!-- The server returns this list in due-date order; the page shows it as it came. -->
              <TimeLine v-if="plan.milestones.length" class="plan-list">
                <TimeLineItem
                  v-for="row in plan.milestones"
                  :key="row.id"
                  :time="row.dueDate"
                  :icon="row.status === 'done' ? CircleCheck : Clock"
                  :color="markColor(row)"
                >
                  <div class="plan-row">
                    <strong>{{ row.title }}</strong>
                    <span class="plan-state">
                      <Tag size="small" :color="row.status === 'done' ? 'green' : 'blue'">
                        {{ row.status === "done" ? "已完成" : "未完成" }}
                      </Tag>
                      <Tag v-if="overdue(row)" size="small" color="red">已过期</Tag>
                    </span>
                    <span v-if="canWritePlan || canDeletePlan" class="plan-ops">
                      <Button
                        v-if="canWritePlan"
                        size="small"
                        theme="plain"
                        :disabled="savingPlan"
                        @click="flip(row)"
                      >
                        {{ row.status === "done" ? "标记未完成" : "标记完成" }}
                      </Button>
                      <Button
                        v-if="canWritePlan"
                        size="small"
                        theme="plain"
                        :disabled="savingPlan"
                        @click="startEditing(row)"
                      >
                        编辑
                      </Button>
                      <Button
                        v-if="canDeletePlan"
                        size="small"
                        theme="plain"
                        :disabled="savingPlan"
                        @click="deletingId = row.id"
                      >
                        删除
                      </Button>
                    </span>
                  </div>
                  <small v-if="editing === row.id" class="plan-editing-hint">
                    上方表单里改的就是这一条，保存会整行提交。
                  </small>
                </TimeLineItem>
              </TimeLine>
              <Empty v-else description="这个项目还没有排过里程碑" />
            </template>
          </Skeleton>
        </Card>
      </GridItem>
    </Grid>

    <Modal
      :model-value="!!deletingId"
      title="删除里程碑"
      :show-close="!savingPlan"
      :mask-closable="!savingPlan"
      :esc-key="!savingPlan"
      @update:model-value="!$event && (deletingId = '')"
    >
      <p>确定删除「{{ deletingTitle }}」？这条计划会从项目里移除，无法撤销。</p>
      <template #footer>
        <Button :disabled="savingPlan" @click="deletingId = ''">取消</Button>
        <Button type="danger" :loading="savingPlan" @click="removeMilestone">确认删除</Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, CircleCheck, Clock, FolderKanban } from "kui-icons";
import { PageHeader, message } from "kui-vue";
import { computed, onDeactivated, onScopeDispose, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  MAX_PLAN_MILESTONES,
  isMilestoneOverdue,
  loadAssignablePeople,
  loadProjectMilestones,
  loadProjectRoster,
  localCalendarDay,
  milestoneDraft,
  saveProjectMembers,
  collaborationApi,
  type MilestoneDraft,
  type MilestonePlan,
  type MilestoneRecord,
  type PersonOption,
  type ProjectPerson,
  type ProjectRoster,
} from "@/api/collaboration";
import { resources, workspaceApi, type BusinessRecord } from "@/api/workspace";
import { usePaneActivate } from "@/composables/use-pane-activate";
import { hasPermission } from "@/routers/permissions";
import { useAuthStore } from "@/stores/auth";
import { reportFailure } from "@/utils/report-failure";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const canEdit = computed(() => hasPermission("project:write", auth.permissions));
/**
 * The plan has three codes of its own. A read the account was not given is reported as
 * unreadable, which is a different answer from a project that has no plan yet.
 */
const canReadPlan = computed(() => hasPermission("milestone:read", auth.permissions));
const canWritePlan = computed(() => hasPermission("milestone:write", auth.permissions));
const canDeletePlan = computed(() => hasPermission("milestone:delete", auth.permissions));

const roster = ref<ProjectRoster>();
const project = ref<BusinessRecord>();
const people = ref<PersonOption[]>([]);
const directoryUnavailable = ref(false);
const saving = ref(false);
const error = ref("");
const draft = ref<string[]>([]);

const plan = ref<MilestonePlan>();
const planError = ref("");
const savingPlan = ref(false);
const draftTitle = ref("");
const draftDue = ref<string | null>(null);
const editing = ref("");
const deletingId = ref("");
/** Overdue is judged against the reader's own calendar day, retaken with every read. */
const today = ref(localCalendarDay());

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

const planPending = computed(() => canReadPlan.value && !plan.value && !planError.value);
const draftValid = computed(() => !!draftTitle.value.trim() && !!draftDue.value);
const deletingTitle = computed(
  () => plan.value?.milestones.find((row) => row.id === deletingId.value)?.title || "这条里程碑",
);
const overdue = (row: MilestoneRecord) => isMilestoneOverdue(row, today.value);
const markColor = (row: MilestoneRecord) =>
  row.status === "done"
    ? "var(--kui-color-success)"
    : overdue(row)
      ? "var(--kui-color-danger)"
      : "var(--kui-color-text-placeholder)";

let generation = 0;
let active = true;
async function load() {
  const record = id();
  if (!record || !route.path.startsWith("/project/")) return;
  const current = ++generation;
  roster.value = undefined;
  error.value = "";
  stopEditing();
  deletingId.value = "";
  void loadPlan(record, current);
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

/**
 * The plan keeps its own failure state: a refused read must not take the roster panel down
 * with it, and a frame still spinning after an error reads as still waiting.
 */
async function loadPlan(record: string, current: number) {
  if (!canReadPlan.value) return;
  plan.value = undefined;
  planError.value = "";
  try {
    const result = await loadProjectMilestones(record);
    if (current !== generation) return;
    plan.value = result;
    today.value = localCalendarDay();
  } catch (reason) {
    if (current === generation)
      planError.value = reason instanceof Error ? reason.message : "项目计划加载失败";
  }
}

function retryPlan() {
  if (savingPlan.value) return;
  void loadPlan(id(), generation);
}

function stopEditing() {
  editing.value = "";
  draftTitle.value = "";
  draftDue.value = null;
}

function startEditing(row: MilestoneRecord) {
  editing.value = row.id;
  draftTitle.value = row.title;
  draftDue.value = row.dueDate;
}

/**
 * A milestone write sends the whole row, because the schema has no partial update, and the
 * panel is re-read afterwards rather than sorted by hand: the order on screen is the order
 * the server's due-date sort named.
 */
async function applyPlan(body: MilestoneDraft, existingId: string) {
  if (savingPlan.value || !canWritePlan.value) return;
  const current = generation;
  savingPlan.value = true;
  try {
    if (existingId) await collaborationApi.updateMilestone(existingId, body);
    else await collaborationApi.createMilestone(body);
    if (current !== generation) return;
    message.success(existingId ? "里程碑已更新" : "里程碑已添加");
    stopEditing();
    await loadPlan(id(), current);
  } catch (reason) {
    // The draft stays so the writer can fix it; the server says what it refused.
    reportFailure(reason, "里程碑保存失败");
  } finally {
    savingPlan.value = false;
  }
}

function submitDraft() {
  const due = draftDue.value;
  const row = plan.value?.milestones.find((item) => item.id === editing.value);
  if (!draftValid.value || !due) return;
  void applyPlan(
    {
      projectId: id(),
      title: draftTitle.value.trim(),
      dueDate: due,
      // Status has its own button; the form never changes it by accident.
      status: row ? row.status : "pending",
    },
    editing.value,
  );
}

function flip(row: MilestoneRecord) {
  void applyPlan(
    { ...milestoneDraft(row), status: row.status === "done" ? "pending" : "done" },
    row.id,
  );
}

async function removeMilestone() {
  const record = deletingId.value;
  if (savingPlan.value || !canDeletePlan.value || !record) return;
  const current = generation;
  savingPlan.value = true;
  try {
    await collaborationApi.deleteMilestone(record);
    if (current !== generation) return;
    deletingId.value = "";
    if (editing.value === record) stopEditing();
    message.success("里程碑已删除");
    await loadPlan(id(), current);
  } catch (reason) {
    reportFailure(reason, "里程碑删除失败");
  } finally {
    savingPlan.value = false;
  }
}

watch(
  () => route.params.id,
  () => {
    if (active) void load();
  },
  { immediate: true },
);
usePaneActivate(() => {
  active = true;
  void load();
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
.plan-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 14px;
}
.plan-refused {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  color: var(--kui-color-danger);
}
.plan-hint {
  margin: 0 0 12px;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.plan-list {
  margin-bottom: 4px;
}
.plan-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}
.plan-row strong {
  color: var(--kui-color-text-title);
  font-size: 13px;
}
.plan-state {
  display: flex;
  gap: 6px;
  align-items: center;
}
.plan-ops {
  display: flex;
  gap: 6px;
  align-items: center;
}
.plan-editing-hint {
  display: block;
  margin-top: 4px;
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

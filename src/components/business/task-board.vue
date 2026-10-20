<template>
  <ListPanel class="task-board-panel" :summary="summary">
    <template #filters>
      <Input
        v-model="keyword"
        placeholder="搜索任务名称"
        :maxlength="200"
        clearable
        style="width: 200px"
      />
      <!-- `block` would make each Select fill the filter row and stack; the row wraps. -->
      <Select
        v-model="priority"
        :options="priorityOptions"
        placeholder="全部优先级"
        clearable
        style="width: 160px"
      />
      <Select
        v-model="projectId"
        :options="projects"
        placeholder="全部项目"
        clearable
        filterable
        style="width: 220px"
      />
    </template>
    <template #actions>
      <Button :loading="loading" @click="reload">刷新</Button>
    </template>

    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <p v-else-if="loading" role="status">正在加载任务…</p>
    <Empty v-else-if="!visible.length" description="没有符合条件的任务" />
    <Kanban
      v-else
      :columns="columns"
      :data="visible"
      row-key="id"
      status-key="status"
      :draggable="canMove && !movingId"
      :min-column-width="264"
      @move="onMove"
    >
      <template #columnTitle="{ column, items }">
        <Flex align="center" :size="8" class="board-column-title">
          <span class="board-column-dot" :style="{ background: column.color }"></span>
          <strong>{{ column.title }}</strong>
          <em>{{ items.length }}</em>
        </Flex>
      </template>
      <template #item="{ item }">
        <article class="board-card" :class="{ 'board-card-overdue': isOverdue(item) }">
          <Flex justify="space-between" align="center" :size="8">
            <Tag :color="priorityOf(item).color" theme="fill">{{ priorityOf(item).label }}</Tag>
            <small v-if="isOverdue(item)" class="board-overdue">已逾期</small>
          </Flex>
          <h3>{{ item.title }}</h3>
          <p>{{ projectNameOf(item) }}</p>
          <Flex justify="space-between" align="center" :size="8" class="board-card-footer">
            <span>
              <Icon :type="Calendar" />
              {{ item.deadline }}
            </span>
            <small v-if="item.id === movingId">保存中…</small>
          </Flex>
        </article>
      </template>
      <template #empty>
        <p class="board-column-empty">拖到此处</p>
      </template>
    </Kanban>
    <p v-if="!canMove" class="board-tip">当前账号没有 task:write 权限，看板只读。</p>
  </ListPanel>
</template>
<script setup lang="ts">
import { Calendar } from "kui-icons";
import {
  message,
  type KanbanColumnData,
  type KanbanItemData,
  type KanbanMoveEvent,
} from "kui-vue";
import { computed, onScopeDispose, ref, watch } from "vue";
import {
  loadProjectOptions,
  loadTaskBoard,
  moveTaskStatus,
  taskPriorityLabels,
  taskPriorityOptions,
  taskStatusColors,
  taskStatusLabels,
  taskStatuses,
  type TaskBoard,
  type TaskPriority,
  type TaskRecord,
  type TaskStatus,
} from "@/api/collaboration";
import { useRemoteData } from "@/composables/use-remote-data";
import { hasPermission } from "@/routers/permissions";
import { useAuthStore } from "@/stores/auth";
import { reportFailure } from "@/utils/report-failure";

const auth = useAuthStore();
/** Without the write permission a drop would only fail after the user let go. */
const canMove = computed(() => hasPermission("task:write", auth.permissions));

const keyword = ref("");
const priority = ref<TaskPriority>();
const projectId = ref<string>();
const projects = ref<{ label: string; value: string }[]>([]);
const { data: board, loading, error, reload } = useRemoteData<TaskBoard>(() =>
  loadTaskBoard(keyword.value),
);

const filtersActive = computed(() => Boolean(priority.value || projectId.value));
const visible = computed(() => {
  const rows = board.value?.tasks || [];
  return rows.filter(
    (task) =>
      (!priority.value || task.priority === priority.value) &&
      (!projectId.value || task.projectId === projectId.value),
  );
});

const summary = computed(() => {
  const result = board.value;
  if (!result) return "拖动卡片可更新任务状态";
  const parts = [`拖动卡片可更新任务状态 · 共 ${result.total} 条任务`];
  if (result.tasks.length < result.total)
    parts.push(`已加载 ${result.tasks.length} 条${result.truncated ? "，请用搜索缩小范围" : ""}`);
  if (filtersActive.value) parts.push(`筛选出 ${visible.value.length} 条`);
  return parts.join(" · ");
});

const columns = computed<KanbanColumnData[]>(() =>
  taskStatuses.map((key) => ({ key, title: taskStatusLabels[key], color: taskStatusColors[key] })),
);
const priorityOptions = taskPriorityOptions;

const asTask = (item: KanbanItemData) => item as unknown as TaskRecord;
const priorityOf = (item: KanbanItemData) =>
  taskPriorityLabels[asTask(item).priority] || taskPriorityLabels.medium;
const projectNameOf = (item: KanbanItemData) => {
  const task = asTask(item);
  return task.projectId
    ? projects.value.find((row) => row.value === task.projectId)?.label || "未命名项目"
    : "未归属项目";
};
/** Dates are naive `YYYY-MM-DD` on both data sources, so a string compare is exact. */
const isOverdue = (item: KanbanItemData) => {
  const task = asTask(item);
  return task.status !== "done" && task.deadline < new Date().toISOString().slice(0, 10);
};

const movingId = ref("");
const write = (id: string, status: TaskStatus) => {
  const result = board.value;
  if (!result) return;
  board.value = {
    ...result,
    tasks: result.tasks.map((task) => (task.id === id ? { ...task, status } : task)),
  };
};

/**
 * The card moves as soon as it is dropped, then the server answers with the
 * status it stored. A rejected move puts the card back — the board never keeps a
 * status the source refused to accept.
 */
async function onMove(event: KanbanMoveEvent) {
  const id = asTask(event.item).id;
  const to = event.to as TaskStatus;
  const from = asTask(event.item).status;
  if (movingId.value || !taskStatuses.includes(to) || from === to) return;
  movingId.value = id;
  write(id, to);
  try {
    const stored = await moveTaskStatus(id, to);
    write(id, stored);
    message.success(`已移到${taskStatusLabels[stored] || stored}`);
  } catch (reason) {
    // The card is back where it started, and the server's own reason says why.
    write(id, from);
    reportFailure(reason, "移动失败");
  } finally {
    movingId.value = "";
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(keyword, () => {
  clearTimeout(timer);
  timer = setTimeout(() => void reload(), 250);
});
watch(
  () => auth.permissions,
  (value) => {
    if (!hasPermission("project:read", value)) projects.value = [];
  },
);
onScopeDispose(() => clearTimeout(timer));

// Project names are a separate permission; cards still work without them.
void loadProjectOptions()
  .then((rows) => (projects.value = rows))
  .catch(() => {
    /* A task-only account keeps seeing ids it cannot name. */
  });
</script>
<style scoped lang="less">
.task-board-panel {
  margin-top: 4px;
}
.board-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--kui-color-border);
  border-radius: var(--kui-card-radius, var(--kui-border-radius-card));
  background: var(--kui-color-bg-container);
}
.board-card h3 {
  margin: 0;
  color: var(--kui-color-text-title);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
}
.board-card p {
  margin: 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.board-card-overdue {
  border-left: 3px solid var(--kui-color-danger);
}
.board-overdue,
.board-card-footer small {
  color: var(--kui-color-danger);
  font-size: 12px;
}
.board-card-footer {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.board-card-footer span {
  display: inline-flex;
  gap: 5px;
  align-items: center;
}
.board-column-title strong {
  color: var(--kui-color-text-title);
  font-size: 14px;
}
.board-column-title em {
  color: var(--kui-color-text-placeholder);
  font-style: normal;
}
.board-column-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.board-column-empty {
  margin: 0;
  padding: 10px 0;
  color: var(--kui-color-text-placeholder);
  text-align: center;
  font-size: 12px;
}
.board-tip {
  margin: 12px 0 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
</style>

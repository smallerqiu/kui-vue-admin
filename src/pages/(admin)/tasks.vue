<template>
  <div class="task-page">
    <PageHeader title="任务中心" description="按看板推进任务，及时识别阻塞与延期风险。">
      <template #actions>
        <Button type="primary" :icon="Plus" @click="openCreate()">新建任务</Button>
      </template>
    </PageHeader>

    <Grid :cols="{ xs: 2, md: 4 }" :x-gap="12" :y-gap="12">
      <GridItem v-for="column in columns" :key="column.value">
        <Card size="small" bordered class="task-stat">
          <span :style="{ background: column.color }"></span>
          <div>
            <strong>{{ tasksByStatus[column.value].length }}</strong>
            <small>{{ column.label }}</small>
          </div>
        </Card>
      </GridItem>
    </Grid>

    <ListPanel
      class="task-board-card"
      :summary="`拖动卡片可更新状态 · ${filteredTasks.length} 项任务`"
    >
      <template #filters>
        <Input v-model="keyword" clearable placeholder="搜索任务、项目或负责人" :icon="Search" />
        <Select v-model="priority" clearable placeholder="全部优先级" :options="priorityOptions" />
        <Select v-model="project" clearable placeholder="全部项目" :options="projectOptions" />
      </template>

      <Kanban :columns="kanbanColumns" :data="filteredTasks" @move="moveTask">
        <template #item="{ item: task }">
          <article class="task-card" @click="openEdit(task)">
            <Flex justify="space-between" align="center">
              <Tag :color="priorityInfo(task.priority).color" theme="fill">
                {{ priorityInfo(task.priority).label }}
              </Tag>
              <small>{{ task.code }}</small>
            </Flex>
            <h3>{{ task.title }}</h3>
            <p>{{ task.project }}</p>
            <div class="task-tags">
              <Tag v-for="tag in task.tags" :key="tag" size="small">{{ tag }}</Tag>
            </div>
            <Flex class="task-card-footer" justify="space-between" align="center">
              <span :class="{ overdue: isOverdue(task) }">
                <Icon :type="Calendar" />
                {{ task.deadline }}
              </span>
              <Tooltip :title="task.owner">
                <Avatar size="small" :style="{ background: avatarColor(task.owner) }">
                  {{ task.owner.slice(-1) }}
                </Avatar>
              </Tooltip>
            </Flex>
          </article>
        </template>
        <template #footer="{ column }">
          <Button block theme="plain" :icon="Plus" @click="openCreate(column.key)">添加任务</Button>
        </template>
      </Kanban>
    </ListPanel>

    <Drawer
      v-model="drawerOpen"
      :title="editingId ? '编辑任务' : '新建任务'"
      :width="500"
      @ok="saveTask"
    >
      <Form :model="form" layout="vertical">
        <FormItem label="任务名称">
          <Input v-model="form.title" clearable placeholder="请输入任务名称" />
        </FormItem>
        <FormItem label="所属项目">
          <Select v-model="form.project" block :options="projectOptions" />
        </FormItem>
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="负责人">
              <Select v-model="form.owner" block :options="ownerOptions" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="截止日期"><DatePicker v-model="form.deadline" block /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="状态">
              <Select v-model="form.status" block :options="columns" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="优先级">
              <Select v-model="form.priority" block :options="priorityOptions" />
            </FormItem>
          </GridItem>
        </Grid>
        <FormItem label="任务标签">
          <InputTag v-model="form.tags" clearable placeholder="输入后按回车" />
        </FormItem>
      </Form>
      <template #footer>
        <Flex justify="space-between">
          <Button v-if="editingId" type="danger" theme="plain" @click="removeTask">删除任务</Button>
          <span v-else></span>
          <Space>
            <Button @click="drawerOpen = false">取消</Button>
            <Button type="primary" @click="saveTask">保存</Button>
          </Space>
        </Flex>
      </template>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import { Calendar, Plus, Search } from "kui-icons";
import { Kanban, message, type KanbanMoveEvent } from "kui-vue";
import { computed, reactive, ref } from "vue";

type TaskStatus = "todo" | "doing" | "review" | "done";
type TaskPriority = "high" | "medium" | "low";
interface TaskItem {
  id: string;
  code: string;
  title: string;
  project: string;
  owner: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
}
const columns: Array<{ label: string; value: TaskStatus; color: string }> = [
  { label: "待处理", value: "todo", color: "#87909c" },
  { label: "进行中", value: "doing", color: "#3a95ff" },
  { label: "待验收", value: "review", color: "#f59e0b" },
  { label: "已完成", value: "done", color: "#22a06b" },
];
const kanbanColumns = columns.map((item) => ({
  key: item.value,
  title: item.label,
  color: item.color,
}));
const priorityMap: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "高", color: "#ef6b73" },
  medium: { label: "中", color: "#f59e0b" },
  low: { label: "低", color: "#3a95ff" },
};
const priorityInfo = (value: TaskPriority) => priorityMap[value];
const priorityOptions = Object.entries(priorityMap).map(([value, item]) => ({
  label: `${item.label}优先级`,
  value,
}));
const projectOptions = ["KUI Vue Pro", "客户数据平台", "移动工作台", "供应链协同"].map((value) => ({
  label: value,
  value,
}));
const ownerOptions = ["陈一", "林夏", "周牧", "宋宁", "方远", "顾言"].map((value) => ({
  label: value,
  value,
}));
const tasks = ref<TaskItem[]>([
  {
    id: "1",
    code: "KUI-132",
    title: "完善权限配置流程",
    project: "KUI Vue Pro",
    owner: "林夏",
    deadline: "2026-08-27",
    status: "todo",
    priority: "high",
    tags: ["权限", "交互"],
  },
  {
    id: "2",
    code: "CDP-86",
    title: "客户画像字段梳理",
    project: "客户数据平台",
    owner: "方远",
    deadline: "2026-08-29",
    status: "todo",
    priority: "medium",
    tags: ["数据"],
  },
  {
    id: "3",
    code: "KUI-128",
    title: "项目中心响应式适配",
    project: "KUI Vue Pro",
    owner: "陈一",
    deadline: "2026-08-25",
    status: "doing",
    priority: "high",
    tags: ["前端", "移动端"],
  },
  {
    id: "4",
    code: "MOB-42",
    title: "移动审批交互联调",
    project: "移动工作台",
    owner: "周牧",
    deadline: "2026-08-31",
    status: "doing",
    priority: "medium",
    tags: ["联调"],
  },
  {
    id: "5",
    code: "KUI-119",
    title: "登录安全策略验收",
    project: "KUI Vue Pro",
    owner: "宋宁",
    deadline: "2026-08-24",
    status: "review",
    priority: "high",
    tags: ["安全", "验收"],
  },
  {
    id: "6",
    code: "SCM-31",
    title: "供应商列表性能优化",
    project: "供应链协同",
    owner: "顾言",
    deadline: "2026-08-22",
    status: "done",
    priority: "low",
    tags: ["性能"],
  },
]);
const keyword = ref("");
const priority = ref<TaskPriority>();
const project = ref<string>();
const drawerOpen = ref(false);
const editingId = ref("");
const form = reactive<{
  title: string;
  project: string;
  owner: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  tags: string[];
}>({
  title: "",
  project: "KUI Vue Pro",
  owner: "陈一",
  deadline: "",
  status: "todo",
  priority: "medium",
  tags: [],
});
const filteredTasks = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return tasks.value.filter(
    (item) =>
      (!query ||
        `${item.title} ${item.project} ${item.owner} ${item.code}`.toLowerCase().includes(query)) &&
      (!priority.value || item.priority === priority.value) &&
      (!project.value || item.project === project.value),
  );
});
const tasksByStatus = computed<Record<TaskStatus, TaskItem[]>>(() => ({
  todo: filteredTasks.value.filter((item) => item.status === "todo"),
  doing: filteredTasks.value.filter((item) => item.status === "doing"),
  review: filteredTasks.value.filter((item) => item.status === "review"),
  done: filteredTasks.value.filter((item) => item.status === "done"),
}));
const avatarColor = (name: string) =>
  ["#3a95ff", "#7b61ff", "#22a06b", "#f59e0b", "#ef6b73"][name.charCodeAt(0) % 5];
const isOverdue = (task: TaskItem) => task.status !== "done" && task.deadline < "2026-08-23";
const resetForm = (status: TaskStatus = "todo") =>
  Object.assign(form, {
    title: "",
    project: "KUI Vue Pro",
    owner: "陈一",
    deadline: "",
    status,
    priority: "medium",
    tags: [],
  });
const openCreate = (status: TaskStatus = "todo") => {
  editingId.value = "";
  resetForm(status);
  drawerOpen.value = true;
};
const openEdit = (task: TaskItem) => {
  editingId.value = task.id;
  Object.assign(form, { ...task, tags: [...task.tags] });
  drawerOpen.value = true;
};
const saveTask = () => {
  if (!form.title.trim()) return message.warning("请输入任务名称");
  const current = tasks.value.find((item) => item.id === editingId.value);
  if (current) Object.assign(current, form);
  else
    tasks.value.unshift({
      id: `${Date.now()}`,
      code: `TASK-${tasks.value.length + 1}`,
      ...form,
      tags: [...form.tags],
    });
  drawerOpen.value = false;
  message.success("任务已保存");
};
const removeTask = () => {
  tasks.value = tasks.value.filter((item) => item.id !== editingId.value);
  drawerOpen.value = false;
  message.success("任务已删除");
};
const moveTask = ({ item, to }: KanbanMoveEvent) => {
  const task = item as unknown as TaskItem;
  task.status = to as TaskStatus;
  message.success(`任务已移至“${columns.find((entry) => entry.value === to)?.label}”`);
};
</script>

<style scoped lang="less">
.task-stat :deep(.k-card-body) {
  display: flex;
  gap: 10px;
  align-items: center;
}
.task-stat > :deep(.k-card-body) > span {
  width: 4px;
  height: 38px;
  border-radius: var(--kui-shape-circle);
}
.task-stat div {
  display: flex;
  flex-direction: column;
}
.task-stat strong {
  color: var(--kui-color-text-title);
  font-size: 20px;
}
.task-stat small {
  color: var(--kui-color-text-description);
}
.task-board-card {
  margin-top: 16px;
}
.task-card {
  padding: 13px;
  border: 1px solid var(--kui-color-border);
  border-radius: var(--kui-card-radius);
  background: var(--kui-color-bg-container);
  box-shadow: var(--kui-shadow-sm);
  cursor: grab;
  transition:
    transform var(--kui-motion-duration-fast),
    border-color var(--kui-motion-duration-fast);
}
.task-card:hover {
  border-color: var(--kui-color-primary);
  transform: translateY(-1px);
}
.task-card:active {
  cursor: grabbing;
}
.task-card small {
  color: var(--kui-color-text-placeholder);
}
.task-card h3 {
  margin: 12px 0 6px;
  color: var(--kui-color-text-title);
  font-size: 14px;
  line-height: 1.5;
}
.task-card p {
  margin: 0 0 12px;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.task-card-footer {
  padding-top: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--kui-color-border);
}
.task-card-footer > span {
  display: flex;
  gap: 4px;
  align-items: center;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.task-card-footer .overdue {
  color: var(--kui-color-danger);
}
</style>

<route lang="yaml">
meta:
  title: "任务中心"
  icon: "ListTodo"
  order: 9
</route>

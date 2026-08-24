<template>
  <div class="project-page">
    <PageHeader title="项目中心" description="集中查看项目进度、成员协作与近期交付。">
      <template #actions>
        <Button type="primary" :icon="Plus" @click="openCreate">新建项目</Button>
      </template>
    </PageHeader>

    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="16" :y-gap="16">
      <GridItem v-for="item in overview" :key="item.label">
        <Card size="small" bordered class="overview-card">
          <span :style="{ color: item.color, background: `${item.color}18` }">
            <Icon :type="item.icon" />
          </span>
          <div>
            <strong>{{ item.value }}</strong>
            <small>{{ item.label }}</small>
          </div>
        </Card>
      </GridItem>
    </Grid>

    <ListPanel class="project-list-card" :summary="`共 ${filteredProjects.length} 个项目`">
      <template #filters>
        <Input v-model="keyword" clearable placeholder="搜索项目名称或负责人" :icon="Search" />
        <RadioGroup v-model="status" theme="card" type="button" :options="statusOptions" />
      </template>

      <Grid :cols="{ xs: 1, md: 2, xl: 3 }" :x-gap="16" :y-gap="16">
        <GridItem v-for="project in filteredProjects" :key="project.id">
          <Card bordered class="project-card">
            <div class="project-card-head">
              <span
                class="project-icon"
                :style="{
                  color: project.color,
                  background: `${project.color}18`,
                }"
              >
                <Icon :type="FolderKanban" />
              </span>
              <div class="project-title">
                <strong>{{ project.name }}</strong>
                <small>{{ project.code }}</small>
              </div>
              <Tag :color="statusMap[project.status].color" theme="fill">
                {{ statusMap[project.status].label }}
              </Tag>
            </div>
            <p>{{ project.description }}</p>
            <Flex justify="space-between" class="project-meta">
              <span>
                <Icon :type="User" />
                {{ project.owner }}
              </span>
              <span>
                <Icon :type="Calendar" />
                {{ project.deadline }}
              </span>
            </Flex>
            <div class="project-progress">
              <Flex justify="space-between">
                <span>整体进度</span>
                <strong>{{ project.progress }}%</strong>
              </Flex>
              <Progress :percent="project.progress" :show-info="false" size="small" />
            </div>
            <Flex justify="space-between" align="center" class="project-footer">
              <AvatarGroup :max-count="4" size="small">
                <Avatar
                  v-for="member in project.members"
                  :key="member"
                  :style="{ background: avatarColor(member) }"
                >
                  {{ member.slice(-1) }}
                </Avatar>
              </AvatarGroup>
              <Button size="small" theme="plain" :icon="ArrowRight" @click="openDetail(project)">
                查看详情
              </Button>
            </Flex>
          </Card>
        </GridItem>
      </Grid>
      <Empty v-if="!filteredProjects.length" description="没有匹配的项目" />
    </ListPanel>

    <Drawer v-model="drawerOpen" title="新建项目" :width="480" @ok="createProject">
      <Form :model="form" layout="vertical">
        <FormItem label="项目名称">
          <Input v-model="form.name" clearable placeholder="请输入项目名称" />
        </FormItem>
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="项目代号">
              <Input v-model="form.code" clearable placeholder="例如 KUI-PRO" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="负责人"><Input v-model="form.owner" clearable /></FormItem>
          </GridItem>
        </Grid>
        <FormItem label="项目说明">
          <TextArea v-model="form.description" :rows="4" placeholder="简要描述项目目标" />
        </FormItem>
        <FormItem label="计划交付日期"><DatePicker v-model="form.deadline" block /></FormItem>
      </Form>
    </Drawer>

    <Drawer
      v-model="detailOpen"
      :title="selectedProject?.name || '项目详情'"
      :width="560"
      :footer="false"
    >
      <template v-if="selectedProject">
        <div class="detail-heading">
          <span
            class="project-icon"
            :style="{
              color: selectedProject.color,
              background: `${selectedProject.color}18`,
            }"
          >
            <Icon :type="FolderKanban" />
          </span>
          <div>
            <strong>{{ selectedProject.name }}</strong>
            <small>{{ selectedProject.code }}</small>
          </div>
          <Tag :color="statusMap[selectedProject.status].color" theme="fill">
            {{ statusMap[selectedProject.status].label }}
          </Tag>
        </div>
        <p class="detail-description">{{ selectedProject.description }}</p>
        <Grid :cols="2" :x-gap="12" :y-gap="12" class="detail-facts">
          <GridItem>
            <small>负责人</small>
            <strong>{{ selectedProject.owner }}</strong>
          </GridItem>
          <GridItem>
            <small>计划交付</small>
            <strong>{{ selectedProject.deadline || "待确认" }}</strong>
          </GridItem>
          <GridItem>
            <small>项目成员</small>
            <strong>{{ selectedProject.members.length }} 人</strong>
          </GridItem>
          <GridItem>
            <small>当前进度</small>
            <strong>{{ selectedProject.progress }}%</strong>
          </GridItem>
        </Grid>
        <div class="detail-section">
          <Flex justify="space-between">
            <strong>交付进度</strong>
            <span>{{ selectedProject.progress }}%</span>
          </Flex>
          <Progress :percent="selectedProject.progress" :show-info="false" />
        </div>
        <div class="detail-section">
          <strong>项目成员</strong>
          <div class="member-list">
            <div v-for="member in selectedProject.members" :key="member">
              <Avatar :style="{ background: avatarColor(member) }">{{ member.slice(-1) }}</Avatar>
              <span>{{ member }}</span>
              <small>{{ member === selectedProject.owner ? "负责人" : "项目成员" }}</small>
            </div>
          </div>
        </div>
        <div class="detail-section">
          <strong>近期里程碑</strong>
          <TimeLine>
            <TimeLineItem
              v-for="item in projectMilestones"
              :key="item.title"
              :icon="item.state === 'done' ? CircleCheck : Clock"
              :color="
                item.state === 'done'
                  ? 'var(--kui-color-success)'
                  : 'var(--kui-color-text-placeholder)'
              "
              :time="item.date"
            >
              <strong>{{ item.title }}</strong>
            </TimeLineItem>
          </TimeLine>
        </div>
        <Space class="detail-actions">
          <Button v-if="selectedProject.status !== 'done'" type="primary" @click="advanceProject">
            推进进度
          </Button>
          <Button v-if="selectedProject.status === 'paused'" @click="setProjectStatus('active')">
            恢复项目
          </Button>
          <Button v-else-if="selectedProject.status !== 'done'" @click="setProjectStatus('paused')">
            暂停项目
          </Button>
        </Space>
      </template>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import {
  ArrowRight,
  Calendar,
  CircleCheck,
  CirclePause,
  Clock,
  FolderKanban,
  Plus,
  Search,
  User,
} from "kui-icons";
import { message, type IconType } from "kui-vue";
import { computed, reactive, ref } from "vue";

type ProjectStatus = "active" | "planning" | "paused" | "done";
interface ProjectItem {
  id: string;
  name: string;
  code: string;
  description: string;
  owner: string;
  deadline: string;
  progress: number;
  status: ProjectStatus;
  members: string[];
  color: string;
}
interface MilestoneItem {
  title: string;
  date: string;
  state: "done" | "pending";
}
const statusMap: Record<ProjectStatus, { label: string; color: string }> = {
  active: { label: "进行中", color: "#3a95ff" },
  planning: { label: "规划中", color: "#7b61ff" },
  paused: { label: "已暂停", color: "#f59e0b" },
  done: { label: "已完成", color: "#22a06b" },
};
const projects = ref<ProjectItem[]>([
  {
    id: "1",
    name: "KUI Vue Pro",
    code: "KUI-PRO",
    description: "面向中后台场景的企业级管理系统与最佳实践。",
    owner: "陈一",
    deadline: "2026-09-18",
    progress: 72,
    status: "active",
    members: ["陈一", "林夏", "周牧", "宋宁", "顾言"],
    color: "#3a95ff",
  },
  {
    id: "2",
    name: "客户数据平台",
    code: "CDP-2026",
    description: "统一客户画像、行为分析和精细化运营能力。",
    owner: "林夏",
    deadline: "2026-10-08",
    progress: 46,
    status: "active",
    members: ["林夏", "方远", "宋宁"],
    color: "#7b61ff",
  },
  {
    id: "3",
    name: "移动工作台",
    code: "MOBILE-HUB",
    description: "聚合审批、待办和经营数据的移动端工作台。",
    owner: "周牧",
    deadline: "2026-09-30",
    progress: 18,
    status: "planning",
    members: ["周牧", "顾言"],
    color: "#14b8a6",
  },
  {
    id: "4",
    name: "财务结算升级",
    code: "FIN-NEXT",
    description: "升级对账、结算与经营报表的自动化流程。",
    owner: "宋宁",
    deadline: "2026-08-31",
    progress: 100,
    status: "done",
    members: ["宋宁", "陈一", "方远"],
    color: "#22a06b",
  },
  {
    id: "5",
    name: "供应链协同",
    code: "SCM-CLOUD",
    description: "连接采购、库存和履约环节的协作平台。",
    owner: "方远",
    deadline: "2026-11-12",
    progress: 34,
    status: "paused",
    members: ["方远", "顾言", "林夏"],
    color: "#f59e0b",
  },
]);
const overview = computed<Array<{ label: string; value: number; color: string; icon: IconType[] }>>(
  () => [
    {
      label: "全部项目",
      value: projects.value.length,
      color: "#3a95ff",
      icon: FolderKanban,
    },
    {
      label: "进行中",
      value: projects.value.filter((item) => item.status === "active").length,
      color: "#7b61ff",
      icon: Clock,
    },
    {
      label: "已完成",
      value: projects.value.filter((item) => item.status === "done").length,
      color: "#22a06b",
      icon: CircleCheck,
    },
    {
      label: "已暂停",
      value: projects.value.filter((item) => item.status === "paused").length,
      color: "#f59e0b",
      icon: CirclePause,
    },
  ],
);
const statusOptions = [
  { label: "全部", value: "all" },
  ...Object.entries(statusMap).map(([value, item]) => ({
    label: item.label,
    value,
  })),
];
const keyword = ref("");
const status = ref("all");
const drawerOpen = ref(false);
const detailOpen = ref(false);
const selectedProject = ref<ProjectItem>();
const form = reactive({
  name: "",
  code: "",
  owner: "",
  description: "",
  deadline: "",
});
const filteredProjects = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return projects.value.filter(
    (item) =>
      (status.value === "all" || item.status === status.value) &&
      (!query || `${item.name} ${item.code} ${item.owner}`.toLowerCase().includes(query)),
  );
});
const avatarColor = (name: string) =>
  ["#3a95ff", "#7b61ff", "#22a06b", "#f59e0b", "#ef6b73"][name.charCodeAt(0) % 5];
const openCreate = () => {
  Object.assign(form, {
    name: "",
    code: "",
    owner: "",
    description: "",
    deadline: "",
  });
  drawerOpen.value = true;
};
const openDetail = (project: ProjectItem) => {
  selectedProject.value = project;
  detailOpen.value = true;
};
const projectMilestones = computed<MilestoneItem[]>(() => {
  const progress = selectedProject.value?.progress || 0;
  return [
    {
      title: "需求范围确认",
      date: "2026-08-08",
      state: progress >= 20 ? "done" : "pending",
    },
    {
      title: "核心功能联调",
      date: "2026-08-28",
      state: progress >= 60 ? "done" : "pending",
    },
    {
      title: "验收与正式发布",
      date: selectedProject.value?.deadline || "待确认",
      state: progress >= 100 ? "done" : "pending",
    },
  ];
});
const setProjectStatus = (nextStatus: ProjectStatus) => {
  if (!selectedProject.value) return;
  selectedProject.value.status = nextStatus;
  message.success(nextStatus === "paused" ? "项目已暂停" : "项目已恢复");
};
const advanceProject = () => {
  if (!selectedProject.value) return;
  selectedProject.value.progress = Math.min(100, selectedProject.value.progress + 10);
  selectedProject.value.status = selectedProject.value.progress === 100 ? "done" : "active";
  message.success(selectedProject.value.progress === 100 ? "项目已完成" : "项目进度已更新");
};
const createProject = () => {
  if (!form.name.trim() || !form.owner.trim()) return message.warning("请填写项目名称和负责人");
  projects.value.unshift({
    id: `${Date.now()}`,
    ...form,
    code: form.code || `PRO-${projects.value.length + 1}`,
    progress: 0,
    status: "planning",
    members: [form.owner],
    color: "#3a95ff",
  });
  drawerOpen.value = false;
  message.success("项目创建成功");
};
</script>

<style scoped lang="less">
.overview-card :deep(.k-card-body) {
  display: flex;
  gap: 12px;
  align-items: center;
}
.overview-card span {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: var(--kui-control-radius);
  font-size: 20px;
}
.overview-card div {
  display: flex;
  flex-direction: column;
}
.overview-card strong {
  color: var(--kui-color-text-title);
  font-size: 22px;
}
.overview-card small {
  color: var(--kui-color-text-description);
}
.project-list-card {
  margin-top: 16px;
}
.project-card {
  height: 100%;
}
.project-card-head {
  display: flex;
  gap: 10px;
  align-items: center;
}
.project-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: var(--kui-control-radius);
  font-size: 19px;
}
.project-title {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.project-title strong {
  overflow: hidden;
  color: var(--kui-color-text-title);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.project-title small {
  color: var(--kui-color-text-placeholder);
}
.project-card p {
  min-height: 44px;
  margin: 16px 0;
  color: var(--kui-color-text-description);
  line-height: 1.6;
}
.project-meta {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.project-meta span {
  display: flex;
  gap: 5px;
  align-items: center;
}
.project-progress {
  margin-top: 18px;
}
.project-progress span {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.project-progress strong {
  color: var(--kui-color-text-title);
  font-size: 12px;
}
.project-footer {
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px solid var(--kui-color-border);
}
.detail-heading {
  display: flex;
  gap: 12px;
  align-items: center;
}
.detail-heading > div {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}
.detail-heading > div strong {
  color: var(--kui-color-text-title);
  font-size: 17px;
}
.detail-heading small,
.detail-description,
.detail-section span {
  color: var(--kui-color-text-description);
}
.detail-description {
  margin: 18px 0;
  line-height: 1.7;
}
.detail-facts > div {
  padding: 12px;
  border-radius: var(--kui-control-radius);
  background: var(--kui-theme-fill-bg);
}
.detail-facts small,
.detail-facts strong {
  display: block;
}
.detail-facts small {
  margin-bottom: 5px;
  color: var(--kui-color-text-description);
}
.detail-facts strong {
  color: var(--kui-color-text-title);
}
.detail-section {
  padding-top: 20px;
  margin-top: 20px;
  border-top: 1px solid var(--kui-color-border);
}
.detail-section > strong {
  display: block;
  margin-bottom: 12px;
  color: var(--kui-color-text-title);
}
.member-list {
  display: grid;
  gap: 10px;
}
.member-list > div {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}
.member-list span {
  color: var(--kui-color-text);
}
.member-list small {
  color: var(--kui-color-text-description);
}
.detail-actions {
  margin-top: 24px;
}
</style>

<route lang="yaml">
meta:
  title: "项目中心"
  icon: "FolderKanban"
  order: 8
</route>

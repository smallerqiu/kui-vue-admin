<template>
  <div class="dashboard-page">
    <Flex class="dashboard-heading" align="center" justify="space-between" wrap>
      <div>
        <h1>工作台</h1>
        <p>欢迎回来，{{ userName }}。这里是今天的业务概览。</p>
      </div>
      <Space wrap>
        <Tag theme="fill" :icon="CalendarDays">{{ today }}</Tag>
        <Button :icon="RefreshCw" @click="refreshData">刷新数据</Button>
        <Button type="primary" :icon="Plus">新建任务</Button>
      </Space>
    </Flex>

    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="16" :y-gap="16">
      <GridItem v-for="item in metrics" :key="item.title">
        <StatCard class="metric-card" :title="item.title" :items="[item.data]" bordered reverse />
      </GridItem>
    </Grid>

    <Grid class="dashboard-content" :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Card title="访问趋势" bordered class="panel-card">
          <template #extra>
            <Space size="small">
              <Tag theme="fill">近 7 天</Tag>
              <Button size="small" theme="plain" :icon="ArrowUpRight">详情</Button>
            </Space>
          </template>
          <div class="trend-summary">
            <div><span>总访问量</span><strong>48,260</strong></div>
            <div><span>独立访客</span><strong>12,846</strong></div>
          </div>
          <TrendChart :data="trend" aria-label="最近七天访问趋势图" />
        </Card>
      </GridItem>

      <GridItem :span="{ xs: 1, lg: 4 }">
        <Card title="项目进度" bordered class="panel-card">
          <template #extra><Button size="small" theme="plain">全部项目</Button></template>
          <div class="project-list">
            <div v-for="project in projects" :key="project.name" class="project-item">
              <Flex justify="space-between" align="center">
                <div>
                  <strong>{{ project.name }}</strong>
                  <p>{{ project.owner }} · {{ project.deadline }}</p>
                </div>
                <Tag :theme="project.status === '进行中' ? 'fill' : 'plain'">{{ project.status }}</Tag>
              </Flex>
              <Progress :percent="project.percent" :show-info="false" size="small" />
            </div>
          </div>
        </Card>
      </GridItem>

      <GridItem :span="{ xs: 1, lg: 7 }">
        <Card title="近期活动" bordered class="panel-card">
          <template #extra><Button size="small" theme="plain">查看全部</Button></template>
          <div class="activity-list">
            <div v-for="activity in activities" :key="activity.text" class="activity-item">
              <Avatar :size="34" :style="{ background: activity.color }">{{ activity.user.slice(0, 1) }}</Avatar>
              <div class="activity-content">
                <p><strong>{{ activity.user }}</strong> {{ activity.text }}</p>
                <span><Icon :type="Clock" /> {{ activity.time }}</span>
              </div>
              <Tag size="small" theme="fill">{{ activity.type }}</Tag>
            </div>
          </div>
        </Card>
      </GridItem>

      <GridItem :span="{ xs: 1, lg: 5 }">
        <Card title="快捷入口" bordered class="panel-card">
          <div class="quick-actions">
            <button v-for="action in quickActions" :key="action.label" type="button">
              <span><Icon :type="action.icon" /></span>{{ action.label }}
            </button>
          </div>
          <div class="notice-box">
            <Icon :type="Bell" />
            <div><strong>系统提醒</strong><p>本周有 3 个项目即将到期，请及时处理。</p></div>
          </div>
        </Card>
      </GridItem>
    </Grid>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import TrendChart from "@/components/charts/TrendChart.vue";
import { Activity, ArrowUpRight, Bell, CalendarDays, ChartNoAxesCombined, Clock, FolderKanban, Plus, RefreshCw, ShoppingCart, Users, Wallet } from "kui-icons";
import { message, type IconType, type StatNumberItem } from "kui-vue";
import { computed } from "vue";

const authStore = useAuthStore();
const userName = computed(() => authStore.user.fullName || authStore.user.name || "管理员");
const today = new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date());

const metrics: Array<{ title: string; data: StatNumberItem }> = [
  { title: "今日订单", data: { value: 1286, separator: ",", desc: "较昨日", trend: "+12.6%", trendStatus: "success" } },
  { title: "销售额", data: { value: 86540, separator: ",", prefix: "¥", desc: "本月累计", trend: "+8.2%", trendStatus: "success" } },
  { title: "新增用户", data: { value: 368, separator: ",", desc: "较昨日", trend: "+5.4%", trendStatus: "success" } },
  { title: "待处理事项", data: { value: 24, desc: "需要关注", trend: "6 项即将超时", trendStatus: "warning" } },
];
const trend = [
  { label: "周一", value: 5.2 }, { label: "周二", value: 6.8 },
  { label: "周三", value: 6.1 }, { label: "周四", value: 8.4 },
  { label: "周五", value: 7.6 }, { label: "周六", value: 9.2 },
  { label: "周日", value: 10.4 },
];
const projects = [
  { name: "移动端改版", owner: "产品中心", deadline: "8 月 28 日", percent: 78, status: "进行中" },
  { name: "数据平台升级", owner: "研发中心", deadline: "9 月 05 日", percent: 56, status: "进行中" },
  { name: "品牌官网", owner: "设计中心", deadline: "8 月 20 日", percent: 100, status: "已完成" },
];
const activities = [
  { user: "林晓", text: "提交了移动端首页设计稿", time: "10 分钟前", type: "设计", color: "#3a95ff" },
  { user: "陈默", text: "完成了订单服务接口联调", time: "35 分钟前", type: "研发", color: "#7b61ff" },
  { user: "周宁", text: "创建了 8 月运营复盘任务", time: "1 小时前", type: "任务", color: "#22a06b" },
  { user: "王一", text: "更新了客户增长数据报表", time: "2 小时前", type: "数据", color: "#f59e0b" },
];
const quickActions: Array<{ label: string; icon: IconType[] }> = [
  { label: "订单管理", icon: ShoppingCart }, { label: "用户中心", icon: Users },
  { label: "项目管理", icon: FolderKanban }, { label: "财务报表", icon: Wallet },
  { label: "数据分析", icon: ChartNoAxesCombined }, { label: "操作日志", icon: Activity },
];
const refreshData = () => message.success("数据已更新");
</script>

<style scoped lang="less">
.dashboard-page { max-width: 1600px; margin: 0 auto; padding: 8px 6px 20px; }
.dashboard-heading {
  gap: 16px; margin-bottom: 18px;
  h1 { margin: 0 0 5px; color: var(--kui-color-text-title); font-size: 24px; line-height: 1.3; }
  p { margin: 0; color: var(--kui-color-text-description); }
}
.metric-card, .panel-card { height: 100%; box-sizing: border-box; }
.dashboard-content { margin-top: 16px; }
.trend-summary {
  display: flex; gap: 48px; margin-bottom: 20px;
  span { display: block; color: var(--kui-color-text-description); font-size: 12px; }
  strong { display: block; margin-top: 4px; color: var(--kui-color-text-title); font-size: 22px; }
}
.project-list { display: grid; gap: 22px; }
.project-item {
  strong { color: var(--kui-color-text-title); font-weight: 600; }
  p { margin: 4px 0 10px; color: var(--kui-color-text-description); font-size: 12px; }
}
.activity-list { display: grid; }
.activity-item {
  display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 13px 0; border-bottom: 1px solid var(--kui-color-border);
  &:first-child { padding-top: 2px; }
  &:last-child { padding-bottom: 0; border-bottom: 0; }
}
.activity-content {
  min-width: 0;
  p { overflow: hidden; margin: 0 0 5px; color: var(--kui-color-text); text-overflow: ellipsis; white-space: nowrap; }
  span { display: flex; gap: 4px; align-items: center; color: var(--kui-color-text-description); font-size: 12px; }
}
.quick-actions {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  button {
    display: flex; flex-direction: column; gap: 8px; align-items: center; padding: 13px 6px; color: var(--kui-color-text); font: inherit; border: 0; border-radius: var(--kui-control-radius); background: transparent; cursor: pointer; transition: background var(--kui-motion-duration-fast);
    &:hover { background: var(--kui-color-item-hover); }
    span { display: grid; width: 34px; height: 34px; place-items: center; color: var(--kui-color-primary); border-radius: inherit; background: var(--kui-theme-fill-bg); font-size: 17px; }
  }
}
.notice-box {
  display: flex; gap: 12px; align-items: flex-start; margin-top: 18px; padding: 14px; color: var(--kui-color-primary); border-radius: var(--kui-card-radius); background: var(--kui-theme-fill-bg);
  strong { color: var(--kui-color-text-title); }
  p { margin: 4px 0 0; color: var(--kui-color-text-description); font-size: 12px; line-height: 1.6; }
}
@media (max-width: 640px) {
  .dashboard-heading { align-items: flex-start; }
  .trend-summary { gap: 24px; }
  .quick-actions { grid-template-columns: repeat(2, 1fr); }
}
</style>

<route lang="yaml">
meta:
  title: "仪表盘"
  icon: "Gauge"
  order: 1
  showInMenu: true
</route>

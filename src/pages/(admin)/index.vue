<template>
  <div class="pro-list-page">
    <PageHeader
      title="工作台"
      :description="`欢迎回来，${displayName}。这里是今天的业务概览。`"
    >
      <template #actions>
        <Space wrap>
          <Tag theme="fill" :icon="CalendarDays">{{ today }}</Tag>
          <Button :icon="RefreshCw" :loading="loading" @click="reload">刷新数据</Button>
        </Space>
      </template>
    </PageHeader>

    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>

    <template v-else>
      <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="16" :y-gap="16">
        <GridItem v-for="card in cards" :key="card.title">
          <StatCard class="card-fill" :title="card.title" :items="[card.item]" bordered reverse />
        </GridItem>
        <!-- The four positions are held open by skeletons until the read answers. Replacing the whole
             body with a line of text made the page arrive twice: once as a sentence, then as a
             layout that popped in over it. -->
        <GridItem v-for="position in pendingStats" :key="position">
          <Skeleton class="stat-shell" loading :delay="0" :title-width="45" :rows="2" animated />
        </GridItem>
      </Grid>

      <Grid class="dashboard-content" :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
        <GridItem :span="{ xs: 1, lg: 8 }">
          <Card title="近 7 天收款趋势" bordered class="card-fill">
            <template #extra><Tag theme="fill">日切按 UTC</Tag></template>
            <Skeleton :loading="!data" :delay="0" :title-width="30" :rows="1" animated>
              <div class="trend-summary">
                <div>
                  <span>七日收款</span>
                  <strong>¥ {{ formatMoney(trendRevenue) }}</strong>
                </div>
                <div>
                  <span>七日订单</span>
                  <strong>{{ trendOrders }}</strong>
                </div>
              </div>
            </Skeleton>
            <!-- The line is the one component here that can report its own wait: it keeps its 250px
                 box and draws ECharts' waiting state inside it, so an empty plot means the buckets are
                 on their way rather than that the week earned nothing. -->
            <TrendChart :data="revenueTrend" name="收款" suffix=" 元" :loading="!data" />
          </Card>
        </GridItem>

        <GridItem :span="{ xs: 1, lg: 4 }">
          <Card title="项目进度" bordered class="card-fill">
            <template #extra>
              <Button
                v-if="projectRows"
                size="small"
                theme="plain"
                @click="router.push('/projects')"
              >
                全部项目
              </Button>
            </template>
            <!-- Gated on the read rather than on `loading`: until the aggregate answers, the page does
                 not know whether this account may open 项目 either, so a 无法读取 line would be a claim
                 about a permission nobody has been asked about yet. -->
            <Skeleton :loading="!data" :delay="0" :title-width="50" :rows="3" animated>
              <p v-if="!projectRows" class="panel-empty">当前账号无法读取项目</p>
              <p v-else-if="!projectRows.length" class="panel-empty">暂无在跟进的项目。</p>
              <div v-else class="project-list">
                <div v-for="project in projectRows" :key="project.id" class="project-item">
                  <Flex justify="space-between" align="center" wrap size="small">
                    <strong>{{ project.name }}</strong>
                    <Tag size="small" :color="statusColor(project.status)">
                      {{ projectStatusLabel(project.status) }}
                    </Tag>
                  </Flex>
                  <p>{{ projectLine(project) }}</p>
                  <Progress :percent="project.progress ?? 0" :show-info="false" size="small" />
                </div>
              </div>
            </Skeleton>
          </Card>
        </GridItem>

        <GridItem :span="{ xs: 1, lg: 7 }">
          <Card title="近期活动" bordered class="card-fill">
            <template #extra>
              <Button
                v-if="activityRows"
                size="small"
                theme="plain"
                @click="router.push('/system/logs')"
              >
                查看全部
              </Button>
            </template>
            <Skeleton avatar :loading="!data" :delay="0" :title-width="40" :rows="4" animated>
              <p v-if="!activityRows" class="panel-empty">当前账号无法读取操作日志</p>
              <p v-else-if="!activityRows.length" class="panel-empty">最近没有操作记录。</p>
              <div v-else class="activity-list">
                <div v-for="activity in activityRows" :key="activity.id" class="activity-item">
                  <Avatar :size="34">{{ (activity.actorName || "—").slice(0, 1) }}</Avatar>
                  <div class="activity-content">
                    <p>
                      <strong>{{ activity.actorName || "已注销账号" }}</strong>
                      {{ activity.operation }}
                    </p>
                    <span>
                      <Icon :type="Clock" />
                      {{ formatDateTime(activity.createdAt) }}
                    </span>
                  </div>
                  <Tag size="small" theme="plain">{{ activity.moduleName }}</Tag>
                </div>
              </div>
            </Skeleton>
          </Card>
        </GridItem>

        <GridItem :span="{ xs: 1, lg: 5 }">
          <Card title="快捷入口" bordered class="card-fill">
            <div class="quick-actions">
              <FeatureCard
                v-for="entry in entries"
                :key="entry.path"
                :icon="entry.icon"
                :title="entry.label"
                :color="entry.color"
                size="small"
                direction="vertical"
                theme="plain"
                clickable
                @click="router.push(entry.path)"
              />
            </div>
            <!-- The shortcuts come from the account's permissions, so they are on the page from the
                 first frame; only the four queues below them wait on the read. -->
            <Skeleton :loading="!data" :delay="0" :title-width="25" :rows="4" animated>
              <div class="notice-box">
                <Icon :type="Bell" />
                <div class="notice-body">
                  <strong>需要关注</strong>
                  <div v-for="queue in queues" :key="queue.label" class="notice-row">
                    <span>{{ queue.label }}</span>
                    <!-- A queue this account may not read stays in the list: a row that said 0 would
                       report an empty queue nobody was allowed to look at. -->
                    <span v-if="queue.value === null" class="notice-closed">无读取权限</span>
                    <Button v-else size="small" theme="plain" @click="router.push(queue.path)">
                      {{ queue.value }} 项
                    </Button>
                  </div>
                </div>
              </div>
            </Skeleton>
          </Card>
        </GridItem>
      </Grid>

      <Card class="dashboard-content" title="数据总览" bordered>
        <!-- Grouping belongs to money and to money only: `revenue` is the one decimal text the
             server sends here, and the counts stay the digits it answered. `toLocaleString()` on a
             count would follow the operator's OS locale, which is the shape of a number changing
             with the machine it is read on. -->
        <Skeleton :loading="!data" :delay="0" :title-width="0" :rows="2" animated>
          <template v-if="data">
            <Descriptions :column="3" size="small">
              <DescriptionsItem label="订单总数">{{ data.orders }}</DescriptionsItem>
              <DescriptionsItem label="累计净收款金额">
                ¥ {{ formatMoney(data.revenue) }}
              </DescriptionsItem>
              <DescriptionsItem label="客户总数">{{ data.customers }}</DescriptionsItem>
              <DescriptionsItem label="商品总数">{{ data.products }}</DescriptionsItem>
              <DescriptionsItem label="项目总数">{{ data.projects }}</DescriptionsItem>
              <DescriptionsItem label="任务总数">{{ data.tasks }}</DescriptionsItem>
            </Descriptions>
          </template>
        </Skeleton>
      </Card>

      <p class="dashboard-note">
        统计范围遵循当前账号的数据权限；金额是已收款订单扣除退款后的净额；今日与本月按 UTC 日切，
        比较窗口取等长区间，上一窗口没有数据时不给百分比。
      </p>
    </template>
  </div>
</template>
<script setup lang="ts">
import TrendChart from "@/components/charts/TrendChart.vue";
import { systemApi, type DashboardProject } from "@/api/system";
import { projectStatusLabel } from "@/api/workspace";
import { useRemoteData } from "@/composables/use-remote-data";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { formatDateTime, formatMoney } from "@/utils/common";
import {
  Activity,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FolderKanban,
  RefreshCw,
  ShoppingCart,
  Users,
  Wallet,
} from "kui-icons";
import type { IconType, StatNumberItem } from "kui-vue";
import Big from "big.js";
import { computed } from "vue";
import { useRouter } from "vue-router";

const auth = useAuthStore(),
  router = useRouter();
const { data, loading, error, reload } = useRemoteData(systemApi.dashboard);

const displayName = computed(() => auth.user.fullName || auth.user.name || "管理员");
/**
 * The server cuts 今日 and 本月 at UTC midnight, so the header names the day those cards count.
 * Printing the browser's own date instead would put two dates on one screen that disagree for part
 * of every day.
 */
const today = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "UTC",
  month: "long",
  day: "numeric",
  weekday: "short",
}).format(new Date());

/**
 * One server figure plus the percentage the server computed for it. A change of null means the
 * comparison window had no baseline at all, so the card says what was missing rather than drawing an
 * arrow over an invented 0%.
 */
function figure(item: {
  value: number;
  precision: number;
  prefix?: string;
  separator?: string;
  change: number | null;
  desc: string;
  noBaseline: string;
}): StatNumberItem {
  const direction = item.change === null || item.change === 0 ? 0 : Math.sign(item.change);
  return {
    value: item.value,
    precision: item.precision,
    prefix: item.prefix,
    separator: item.separator,
    desc: item.change === null ? item.noBaseline : item.desc,
    trend:
      item.change === null
        ? ""
        : `${item.change > 0 ? "+" : ""}${item.change.toFixed(1)}%`,
    trendStatus: direction > 0 ? "success" : direction < 0 ? "danger" : "default",
  };
}

const cards = computed(() => {
  const figures = data.value;
  if (!figures) return [];
  return [
    {
      title: "今日订单",
      item: figure({
        value: figures.ordersToday,
        precision: 0,
        change: figures.ordersTodayChange,
        desc: "较昨日同时段",
        noBaseline: "昨日同时段还没有订单",
      }),
    },
    {
      title: "本月净收款",
      item: figure({
        value: Number(figures.revenueMonth),
        precision: 2,
        prefix: "¥",
        separator: ",",
        change: figures.revenueMonthChange,
        desc: "较上月同期",
        noBaseline: "上月同期还没有收款",
      }),
    },
    {
      title: "本月新增客户",
      item: figure({
        value: figures.customersThisMonth,
        precision: 0,
        change: figures.customersThisMonthChange,
        desc: "较上月同期",
        noBaseline: "上月同期还没有新增客户",
      }),
    },
    {
      title: "待审批申请",
      item: {
        value: figures.approvalsPending ?? 0,
        precision: 0,
        desc: figures.approvalsPending === null ? "当前账号无法读取审批" : "等待处理",
      },
    },
  ];
});

/**
 * The four card positions while the figures are in flight. They hold the row's shape so the page
 * arrives as numbers rather than as a layout that grows from a line of text.
 */
const pendingStats = computed(() => (data.value ? [] : [1, 2, 3, 4]));

/**
 * The seven buckets the server sent for the running week, added as decimals: the total above the
 * line is the sum of the same seven points the line draws, so the two figures cannot disagree with
 * each other or with 经营分析. An empty week sums to 0.00, which is what the buckets answered.
 */
const trendRevenue = computed(() =>
  (data.value?.trend ?? [])
    .map((point) => Big(point.revenue))
    .reduce((sum, amount) => sum.plus(amount), Big(0))
    .toNumber(),
);
const trendOrders = computed(
  () => (data.value?.trend ?? []).reduce((total, point) => total + point.orders, 0),
);
/** Buckets are UTC days; the axis only drops the century, same as 经营分析 draws it. */
const revenueTrend = computed(() =>
  (data.value?.trend ?? []).map((point) => ({
    label: `${point.bucket.slice(5, 7)}/${point.bucket.slice(8, 10)}`,
    value: Number(point.revenue),
  })),
);

/** A panel is null when the account may not open the page it comes from, and empty when it may. */
const projectRows = computed(() => data.value?.recentProjects ?? null);
const activityRows = computed(() => data.value?.activities ?? null);

const statusColors: Record<string, string> = {
  planning: "gray",
  active: "blue",
  paused: "orange",
  done: "green",
};
const statusColor = (value: string | null) => (value && statusColors[value]) || "gray";
/** 负责团队 and 截止日期 are what the panel has room to say; a missing one is the row being empty. */
const projectLine = (project: DashboardProject) =>
  `${project.teamName || "未分配团队"} · ${project.deadline ? `截止 ${project.deadline}` : "未设截止日期"}`;

const queues = computed(() => {
  const figures = data.value;
  if (!figures) return [];
  return [
    { label: "待发货订单", value: figures.ordersAwaitingShipment, path: "/commerce/orders" },
    { label: "待审批申请", value: figures.approvalsPending, path: "/approvals" },
    { label: "待处理售后", value: figures.afterSalesPending, path: "/commerce/after-sales" },
    { label: "逾期任务", value: figures.tasksOverdue, path: "/tasks" },
  ];
});

const entrySpecs: Array<{
  label: string;
  path: string;
  permission: string;
  icon: IconType[];
  color: string;
}> = [
  {
    label: "订单管理",
    path: "/commerce/orders",
    permission: "order:read",
    icon: ShoppingCart,
    color: "#3a95ff",
  },
  {
    label: "客户管理",
    path: "/crm/customers",
    permission: "customer:read",
    icon: Users,
    color: "#7b61ff",
  },
  {
    label: "项目管理",
    path: "/projects",
    permission: "project:read",
    icon: FolderKanban,
    color: "#14b8a6",
  },
  {
    label: "审批中心",
    path: "/approvals",
    permission: "approval:read",
    icon: ClipboardCheck,
    color: "#f59e0b",
  },
  {
    label: "经营分析",
    path: "/data/analytics",
    permission: "dashboard:read",
    icon: Wallet,
    color: "#22a06b",
  },
  {
    label: "操作日志",
    path: "/system/logs",
    permission: "system:log:read",
    icon: Activity,
    color: "#ef6b73",
  },
];

/** Entries the account can actually open: a card that leads to a refused page is not a shortcut. */
const entries = computed(() =>
  entrySpecs.filter((entry) => hasPermission(entry.permission, auth.permissions)),
);
</script>
<style scoped lang="less">
.card-fill {
  height: 100%;
  box-sizing: border-box;
}
/* The same surface a bordered StatCard draws, so a pending figure occupies the box it is about to
   fill rather than a bare patch of page. */
.stat-shell {
  height: 100%;
  box-sizing: border-box;
  padding: 16px;
  border: 1px solid var(--kui-color-border);
  border-radius: var(--kui-border-radius-card);
  background-color: var(--kui-color-bg-component);
}
.dashboard-content {
  margin-top: 16px;
}
.trend-summary {
  display: flex;
  gap: 48px;
  margin-bottom: 20px;
  span {
    display: block;
    color: var(--kui-color-text-description);
    font-size: 12px;
  }
  strong {
    display: block;
    margin-top: 4px;
    color: var(--kui-color-text-title);
    font-size: 22px;
    font-variant-numeric: tabular-nums;
  }
}
.panel-empty {
  margin: 0;
  padding: 24px 0;
  color: var(--kui-color-text-description);
  text-align: center;
}
.project-list {
  display: grid;
  gap: 22px;
}
.project-item {
  strong {
    color: var(--kui-color-text-title);
    font-weight: 600;
  }
  p {
    margin: 6px 0 10px;
    color: var(--kui-color-text-description);
    font-size: 12px;
  }
}
.activity-list {
  display: grid;
}
.activity-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 13px 0;
  border-bottom: 1px solid var(--kui-color-border);
  &:first-child {
    padding-top: 2px;
  }
  &:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }
}
.activity-content {
  min-width: 0;
  p {
    overflow: hidden;
    margin: 0 0 5px;
    color: var(--kui-color-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  span {
    display: flex;
    gap: 4px;
    align-items: center;
    color: var(--kui-color-text-description);
    font-size: 12px;
  }
}
.quick-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  :deep(.k-feature-card) {
    height: 100%;
  }
}
.notice-box {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-top: 18px;
  padding: 14px;
  border-radius: var(--kui-border-radius-card);
  background: var(--kui-color-bg-container);
  strong {
    color: var(--kui-color-text-title);
  }
}
.notice-body {
  flex: 1;
  min-width: 0;
}
.notice-row {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.notice-closed {
  color: var(--kui-color-text-disabled);
}
.dashboard-note {
  margin: 16px 0 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
  line-height: 1.6;
}
@media (max-width: 640px) {
  .trend-summary {
    gap: 24px;
  }
  .quick-actions {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
<route lang="yaml">
meta:
  title: "工作台"
  icon: "Gauge"
  order: 1
  showInMenu: true
</route>

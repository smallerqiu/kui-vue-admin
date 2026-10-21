<template>
  <div class="pro-list-page">
    <PageHeader
      title="工作台"
      :description="'欢迎回来，' + (auth.user.fullName || auth.user.name || '')"
    >
      <template #actions><Button :loading="loading" @click="reload">刷新</Button></template>
    </PageHeader>
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <p v-else-if="loading">正在加载业务汇总…</p>
    <Grid v-if="data" :cols="{ xs: 1, sm: 2, lg: 3 }" :x-gap="16" :y-gap="16">
      <GridItem v-for="metric in metrics" :key="metric.key">
        <Card :title="metric.label" bordered>
          <strong class="metric">{{
            metric.money ? formatMoney(data[metric.key]) : data[metric.key]
          }}</strong>
        </Card>
      </GridItem>
    </Grid>
    <p>统计范围遵循当前账号的数据权限；金额为已收款订单扣除退款后的累计净额，不是今日销售额。</p>
    <Card title="快捷入口" bordered>
      <Space wrap>
        <Button v-for="link in links" :key="link.path" @click="router.push(link.path)">
          {{ link.label }}
        </Button>
      </Space>
    </Card>
  </div>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { systemApi, type Dashboard } from "@/api/system";
import { useRemoteData } from "@/composables/use-remote-data";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { formatMoney } from "@/utils/common";
const auth = useAuthStore(),
  router = useRouter();
const { data, loading, error, reload } = useRemoteData(systemApi.dashboard);
const metrics: { key: keyof Dashboard; label: string; money?: boolean }[] = [
  { key: "orders", label: "订单总数" },
  // The one money figure on this page, and the server sends it as decimal text like every other
  // amount: grouped here, counted as plain digits everywhere else.
  { key: "revenue", label: "累计净收款金额", money: true },
  { key: "customers", label: "客户总数" },
  { key: "products", label: "商品总数" },
  { key: "projects", label: "项目总数" },
  { key: "tasks", label: "任务总数" },
];
const links = computed(() =>
  [
    { path: "/projects", label: "项目", permission: "project:read" },
    { path: "/tasks", label: "任务", permission: "task:read" },
    { path: "/approvals", label: "审批", permission: "approval:read" },
    { path: "/calendar", label: "日程", permission: "calendar:read" },
    { path: "/system/logs", label: "操作日志", permission: "system:log:read" },
  ].filter((link) => hasPermission(link.permission, auth.permissions)),
);
</script>
<style scoped>
.metric {
  font-size: 28px;
  font-variant-numeric: tabular-nums;
}
</style>
<route lang="yaml">
meta:
  title: "工作台"
  icon: "Gauge"
  order: 1
  showInMenu: true
</route>

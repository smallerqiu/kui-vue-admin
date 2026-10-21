<template>
  <div class="pro-list-page">
    <PageHeader title="经营分析" description="收入、订单与渠道表现，全部来自订单数据。">
      <template #actions>
        <Segmented v-model="range" :options="rangeOptions" />
        <Button :icon="Download" :disabled="!data" @click="exportCsv">导出趋势 CSV</Button>
      </template>
    </PageHeader>

    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <p v-else-if="loading">正在加载经营数据…</p>

    <template v-if="data">
      <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="16" :y-gap="16">
        <GridItem v-for="card in cards" :key="card.title">
          <StatCard :title="card.title" :items="[card.item]" bordered reverse />
        </GridItem>
      </Grid>

      <p v-if="empty" class="analytics-note">所选周期内没有订单，下面各图保持为空。</p>
      <p v-else class="analytics-note">
        金额是已收款订单扣除退款后的净额，统计范围遵循当前账号的数据权限；对比周期为
        {{ windowLabel }}。
      </p>

      <Grid class="analytics-content" :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
        <GridItem :span="{ xs: 1, lg: 8 }">
          <Card title="收入趋势" bordered class="panel-card">
            <template #extra>
              <Tag theme="fill">{{ periodLabel }}</Tag>
            </template>
            <TrendChart :data="revenueTrend" name="收入" suffix=" 万" color="#7b61ff" />
          </Card>
        </GridItem>
        <GridItem :span="{ xs: 1, lg: 4 }">
          <Card title="订单渠道" bordered class="panel-card">
            <DonutChart :data="channels" unit=" 单" />
          </Card>
        </GridItem>

        <GridItem :span="{ xs: 1, lg: 7 }">
          <Card title="订单履约漏斗" bordered class="panel-card">
            <div class="funnel-list">
              <div v-for="(stage, index) in funnel" :key="stage.name" class="funnel-item">
                <Flex justify="space-between">
                  <span>{{ stage.label }}</span>
                  <strong>{{ stage.value.toLocaleString() }}</strong>
                </Flex>
                <div class="funnel-track">
                  <span :style="{ width: `${stage.percent}%`, background: stage.color }"></span>
                </div>
                <small v-if="index < funnel.length - 1">转化率 {{ stage.rate }}</small>
              </div>
            </div>
          </Card>
        </GridItem>
        <GridItem :span="{ xs: 1, lg: 5 }">
          <Card title="支付方式" bordered class="panel-card">
            <DonutChart :data="paymentMethods" unit=" 单" />
          </Card>
        </GridItem>
      </Grid>
    </template>
  </div>
</template>

<script setup lang="ts">
import DonutChart from "@/components/charts/DonutChart.vue";
import TrendChart from "@/components/charts/TrendChart.vue";
import { analyticsToCsv, loadAnalyticsReport, type AnalyticsRange } from "@/api/reports";
import { useRemoteData } from "@/composables/use-remote-data";
import { downloadCsv } from "@/utils/csv";
import { Download } from "kui-icons";
import Big from "big.js";
import type { StatNumberItem } from "kui-vue";
import { PageHeader } from "kui-vue";
import { computed, ref, watch } from "vue";

const rangeOptions: Array<{ label: string; value: AnalyticsRange }> = [
  { label: "近 7 天", value: "7d" },
  { label: "近 30 天", value: "30d" },
  { label: "本年度", value: "year" },
];
const range = ref<AnalyticsRange>("30d");
const { data, loading, error, reload } = useRemoteData(() => loadAnalyticsReport(range.value));
watch(range, () => void reload());

const periodLabel = computed(
  () => rangeOptions.find((item) => item.value === range.value)?.label ?? "",
);
const empty = computed(() => !data.value?.trend.some((point) => point.orders > 0));
/** Buckets are UTC; the labels only drop the century to keep the axis readable. */
const bucketLabel = (value: string) =>
  data.value?.bucket === "month" ? `${Number(value.slice(5, 7))} 月` : `${value.slice(5, 7)}/${value.slice(8, 10)}`;
const windowLabel = computed(() =>
  data.value ? `${data.value.previousStart.slice(0, 10)} 至 ${data.value.previousEnd.slice(0, 10)}（UTC）` : "",
);

const yuanToWan = (value: string | null) => (value === null ? 0 : Number(Big(value).div(10000).round(2)));

const changeText = (value: number | null) =>
  value === null ? "" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

interface CardSpec {
  title: string;
  value: number;
  precision: number;
  prefix?: string;
  suffix?: string;
  separator?: string;
  change: number | null;
  /** Refunds rising is bad, so this card colours a positive change as danger. */
  invert?: boolean;
  /** Set when the metric itself has no value to report, e.g. no paid orders yet. */
  unavailable?: string;
}
function toCard(spec: CardSpec): { title: string; item: StatNumberItem } {
  if (spec.unavailable) {
    return {
      title: spec.title,
      item: {
        value: 0,
        precision: spec.precision,
        prefix: spec.prefix,
        suffix: spec.suffix,
        desc: spec.unavailable,
      },
    };
  }
  const good = spec.change !== null && (spec.invert ? spec.change < 0 : spec.change > 0);
  const bad = spec.change !== null && (spec.invert ? spec.change > 0 : spec.change < 0);
  return {
    title: spec.title,
    item: {
      value: spec.value,
      precision: spec.precision,
      prefix: spec.prefix,
      suffix: spec.suffix,
      separator: spec.separator,
      desc: spec.change === null ? "上期无可比数据" : "较上期",
      trend: changeText(spec.change),
      trendStatus: good ? "success" : bad ? "danger" : "default",
    },
  };
}
const cards = computed(() => {
  const metrics = data.value?.metrics;
  if (!metrics) return [];
  const average = metrics.averageOrderValue;
  const refund = metrics.refundRate;
  return [
    toCard({
      title: "营业收入",
      value: yuanToWan(metrics.revenue.current),
      precision: 2,
      prefix: "¥",
      suffix: "万",
      change: metrics.revenue.change,
    }),
    toCard({
      title: "订单量",
      value: metrics.orders.current,
      precision: 0,
      suffix: " 单",
      change: metrics.orders.change,
    }),
    toCard({
      title: "客单价",
      value: average.current === null ? 0 : Number(average.current),
      precision: 2,
      prefix: "¥",
      separator: ",",
      change: average.change,
      unavailable: average.current === null ? "所选周期没有已支付订单" : undefined,
    }),
    toCard({
      title: "退款率",
      value: refund.current === null ? 0 : refund.current,
      precision: 2,
      suffix: "%",
      change: refund.change,
      invert: true,
      unavailable: refund.current === null ? "所选周期没有收款" : undefined,
    }),
  ];
});

const revenueTrend = computed(() =>
  (data.value?.trend ?? []).map((point) => ({
    label: bucketLabel(point.bucket),
    value: yuanToWan(point.revenue),
  })),
);

// The server reports stored values verbatim; unrecorded ones group under an empty name.
const unnamed = (name: string) => (name ? name : "未记录");
const donutColors = ["#54a9ff", "#7b61ff", "#22a06b", "#f59e0b", "#e85d75", "#8c8c8c"];
const toDonut = (rows: Array<{ name: string; value: number }>) =>
  rows.map((row, index) => ({
    name: unnamed(row.name),
    value: row.value,
    color: donutColors[index % donutColors.length],
  }));
const channels = computed(() => toDonut(data.value?.channels ?? []));
const paymentMethods = computed(() => toDonut(data.value?.paymentMethods ?? []));

const stageLabels: Record<string, string> = {
  submitted: "提交订单",
  paid: "完成支付",
  shipped: "已发货",
  completed: "订单完成",
};
const stageColors = ["#54a9ff", "#7b61ff", "#22a06b", "#f59e0b"];
const funnel = computed(() => {
  const stages = data.value?.fulfillment ?? [];
  const first = stages[0]?.value ?? 0;
  return stages.map((stage, index) => {
    const next = stages[index + 1];
    return {
      name: stage.name,
      label: stageLabels[stage.name] ?? stage.name,
      value: stage.value,
      percent: first === 0 ? 0 : Math.round((stage.value / first) * 100),
      color: stageColors[index % stageColors.length],
      rate:
        !next || stage.value === 0 ? "—" : `${((next.value / stage.value) * 100).toFixed(1)}%`,
    };
  });
});

function exportCsv() {
  if (!data.value) return;
  downloadCsv(
    analyticsToCsv(data.value),
    `analytics-${data.value.range}-${data.value.end.slice(0, 10)}.csv`,
  );
}
</script>

<style scoped lang="less">
.analytics-content {
  margin-top: 16px;
}
.analytics-note {
  margin: 12px 0 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.panel-card {
  height: 100%;
  box-sizing: border-box;
}
.funnel-list {
  display: grid;
  gap: 18px;
}
.funnel-item {
  position: relative;
}
.funnel-item small {
  position: absolute;
  right: 0;
  bottom: -16px;
  color: var(--kui-color-text-description);
  font-size: 11px;
}
.funnel-track {
  overflow: hidden;
  height: 9px;
  margin-top: 8px;
  border-radius: var(--kui-shape-circle);
  background: var(--kui-color-bg-component);
}
.funnel-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
}
</style>

<route lang="yaml">
meta:
  title: "经营分析"
  icon: "ChartLine"
  order: 1
</route>

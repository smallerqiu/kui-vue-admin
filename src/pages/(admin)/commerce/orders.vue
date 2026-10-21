<template>
  <div class="pro-list-page">
    <PageHeader title="订单管理" description="查询和跟踪全部交易订单。"></PageHeader>
    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="12" :y-gap="12" class="order-stats">
      <GridItem v-for="card in cards" :key="card.title">
        <StatCard :title="card.title" :items="[card.item]" bordered reverse />
      </GridItem>
    </Grid>
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <ListPanel :summary="`${total} 条订单`">
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="订单号、客户或商品名称"
          :icon="Search"
          style="width: 200px"
        />
        <Select v-model="status" clearable placeholder="全部状态" :options="statusOptions" />
        <Input v-model="paymentMethod" clearable placeholder="支付方式（精确匹配）" />
        <Input v-model="source" clearable placeholder="订单来源（精确匹配）" />
        <DatePicker v-model="dateRange" mode="dateRange" placeholder="下单日期（UTC）" />
      </template>
      <template #actions>
        <Space>
          <Button theme="plain" @click="resetFilters">重置</Button>
          <TableColumnSetting
            v-model:hidden-keys="hiddenColumnKeys"
            :columns="columns"
            :disabled-keys="['id', 'action']"
            title="列设置"
            reset-text="重置"
          />
        </Space>
      </template>
      <Table
        :data="orders"
        :loading="loading"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 1220 }"
      >
        <template #id="{ record }">
          <div class="order-number">
            <button type="button" :title="record.id" @click="openDetail(record)">
              {{ shortId(record.id) }}
            </button>
            <small>{{ formatDateTime(record.createdAt) }}</small>
          </div>
        </template>
        <template #buyer="{ record }">
          <div class="buyer-cell">
            <strong>{{ record.customer }}</strong>
            <span>{{ joinParts(record.contact, record.phone) }}</span>
          </div>
        </template>
        <template #items="{ record }">
          <div class="order-items">
            <div v-for="item in record.items" :key="item.id" class="order-item">
              <Image
                :src="item.image"
                :width="48"
                :height="48"
                :img-style="{ objectFit: 'cover' }"
              />
              <div>
                <strong>{{ item.name }}</strong>
                <small>{{ item.specs }} · {{ item.sku }}</small>
              </div>
              <span>¥{{ money(item.price) }} × {{ item.quantity }}</span>
            </div>
          </div>
        </template>
        <template #paidAmount="{ record }">
          <div class="amount-cell">
            <strong>¥ {{ money(record.paidAmount) }}</strong>
            <small>共 {{ itemCount(record) }} 件</small>
          </div>
        </template>
        <template #status="{ value }">
          <Tag :color="statusColor(value)">{{ statusLabel(value) }}</Tag>
        </template>
        <template #action="{ record }">
          <Space compact>
            <Button size="small" theme="plain" :icon="Eye" @click="openDetail(record)">详情</Button>
            <Button
              v-if="record.status === 'pending' && canClose"
              :disabled="busy"
              size="small"
              color="red"
              theme="plain"
              @click="closePendingOrder(record)"
            >
              关闭
            </Button>
          </Space>
        </template>
      </Table>
      <Page v-model:page="page" :page-size="pageSize" :total="total" :disabled="loading" />
    </ListPanel>
  </div>
</template>

<script setup lang="ts">
import { commerceApi, orderStatusOptions, type OrderRecord, type OrderSummary } from "@/api/commerce";
import { useResourcePage } from "@/composables/use-resource-page";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { Eye, Search } from "kui-icons";
import { message, modal, PageHeader, type Column, type StatNumberItem } from "kui-vue";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import { reportFailure } from "@/utils/report-failure";
import { formatDateTime, joinParts, shortId } from "@/utils/common";

const router = useRouter();
const auth = useAuthStore();
const canClose = computed(() => hasPermission("order:close", auth.user?.permissions || []));
const keyword = ref("");
const status = ref<string>();
const paymentMethod = ref("");
const source = ref("");
const dateRange = ref<[number, number]>();
const busy = ref(false);
const {
  items: orders,
  total,
  page,
  pageSize,
  loading,
  error,
  reload,
} = useResourcePage<OrderRecord>("/orders", () => ({
  keyword: keyword.value.trim(),
  status: status.value,
  paymentMethod: paymentMethod.value.trim(),
  source: source.value.trim(),
  startDate: dateRange.value?.[0] ? dayjs(dateRange.value[0]).format("YYYY-MM-DD") : undefined,
  endDate: dateRange.value?.[1] ? dayjs(dateRange.value[1]).format("YYYY-MM-DD") : undefined,
}));
const summary = ref<OrderSummary>();
const loadSummary = async () => {
  try {
    summary.value = await commerceApi.summary();
  } catch (reason) {
    // No numbers rather than invented ones: the cards stay off the page and the server's own words
    // say why.
    reportFailure(reason, "订单统计加载失败");
  }
};
onMounted(loadSummary);
// One aggregate read, and each card is the row set the list filter of that meaning selects -- the
// 待发货 card is `paid` because that is this status ladder's word for "paid, not shipped yet".
const cards = computed<Array<{ title: string; item: StatNumberItem }>>(() => {
  const data = summary.value;
  if (!data) return [];
  return [
    { title: "今日订单", item: { value: data.today, desc: "全部渠道" } },
    { title: "待付款", item: { value: data.byStatus.pending, desc: "等待客户支付" } },
    { title: "待发货", item: { value: data.byStatus.paid, desc: "需要仓库处理" } },
    {
      title: "退款申请",
      item: {
        value: data.refundRequests ?? 0,
        desc: data.refundRequests === null ? "当前账号无法读取售后" : "需要售后处理",
      },
    },
  ];
});
const columns: Column[] = [
  { title: "订单号", key: "id", width: 210 },
  { title: "买家", key: "buyer", width: 180 },
  { title: "商品明细", key: "items", width: 450 },
  { title: "实付金额", key: "paidAmount", width: 130 },
  { title: "状态", key: "status", width: 100 },
  { title: "操作", key: "action", width: 170, fixed: "right" },
];
const statusOptions = orderStatusOptions;
// Money arrives as a two-decimal string, and a string's `toLocaleString` is Object.prototype's: it
// hands the digits back ungrouped, so 12345.00 never becomes 12,345.00 on its own.
const money = (value: unknown) =>
  Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hiddenColumnKeys = ref<string[]>([]);
const statusLabel = (value: string) =>
  statusOptions.find((item) => item.value === value)?.label || value;
const statusColor = (value: string) =>
  ({ pending: "orange", paid: "blue", shipped: "cyan", completed: "green", refunded: "red" })[
    value
  ] || "gray";
const resetFilters = () => {
  keyword.value = "";
  status.value = undefined;
  paymentMethod.value = "";
  source.value = "";
  dateRange.value = undefined;
};
const itemCount = (record: OrderRecord) =>
  record.items.reduce((total, item) => total + item.quantity, 0);
const openDetail = (record: OrderRecord) => router.push(`/order/${record.id}`);
const closePendingOrder = (record: OrderRecord) =>
  modal.confirm({
    title: "关闭订单",
    content: `确定关闭订单 ${record.id} 吗？关闭后客户将无法继续支付。`,
    onOk: async () => {
      if (busy.value) return;
      busy.value = true;
      try {
        await commerceApi.action(record.id, "close", undefined);
        message.success("订单已关闭");
        // The closed order leaves both the list and the 待付款 card, so neither keeps a number it
        // has just made false.
        await Promise.all([reload(), loadSummary()]);
      } catch (reason) {
        // The row is re-read only after a success, so the order stays as it was.
        reportFailure(reason, "关闭失败");
      } finally {
        busy.value = false;
      }
    },
  });
</script>

<style scoped lang="less">
.pro-list-page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 8px 6px 20px;
}
.order-stats {
  margin-bottom: 16px;
}
.order-number,
.buyer-cell,
.amount-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.order-number button {
  padding: 0;
  color: var(--kui-color-primary);
  font: inherit;
  font-weight: 600;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.order-number small,
.buyer-cell span,
.amount-cell small,
.order-item small {
  color: var(--kui-color-text-description);
}
.order-items {
  display: grid;
  gap: 9px;
}
.order-item {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}
.order-item :deep(.k-image) {
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
}
.order-item > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
.order-item strong,
.order-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-item > span {
  color: var(--kui-color-text-description);
  font-size: 12px;
  white-space: nowrap;
}
.amount-cell strong {
  color: var(--kui-color-text-title);
  font-size: 15px;
}
</style>

<route lang="yaml">
meta:
  title: "订单管理"
  icon: "ReceiptText"
  order: 1
</route>

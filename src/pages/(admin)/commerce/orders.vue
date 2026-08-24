<template>
  <div class="pro-list-page">
    <PageHeader title="订单管理" description="查询和跟踪全部交易订单。">
      <template #actions><Button :icon="Download">导出订单</Button></template>
    </PageHeader>
    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="12" :y-gap="12" class="order-stats">
      <GridItem v-for="item in stats" :key="item.title">
        <StatCard :title="item.title" :items="[item.data]" bordered reverse />
      </GridItem>
    </Grid>
    <ListPanel :summary="`${filteredOrders.length} 条订单`">
      <template #filters>
        <Input v-model="keyword" clearable placeholder="订单号、客户或商品名称" :icon="Search" />
        <Select v-model="status" clearable placeholder="全部状态" :options="statusOptions" />
        <Select
          v-model="paymentMethod"
          clearable
          placeholder="支付方式"
          :options="paymentOptions"
        />
        <Select v-model="source" clearable placeholder="订单来源" :options="sourceOptions" />
        <DatePicker v-model="dateRange" mode="dateRange" placeholder="下单时间" />
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
        :data="filteredOrders"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 1220 }"
      >
        <template #id="{ record }">
          <div class="order-number">
            <button type="button" @click="openDetail(record)">
              {{ record.id }}
            </button>
            <small>{{ record.createdAt }}</small>
          </div>
        </template>
        <template #buyer="{ record }">
          <div class="buyer-cell">
            <strong>{{ record.customer }}</strong>
            <span>{{ record.buyer }} · {{ record.phone }}</span>
          </div>
        </template>
        <template #items="{ record }">
          <div class="order-items">
            <div v-for="item in record.items" :key="item.id" class="order-item">
              <Image :src="item.image" :width="48" :height="48" fit="cover" />
              <div>
                <strong>{{ item.name }}</strong>
                <small>{{ item.specs }} · {{ item.sku }}</small>
              </div>
              <span>¥{{ item.price.toLocaleString() }} × {{ item.quantity }}</span>
            </div>
          </div>
        </template>
        <template #paidAmount="{ record }">
          <div class="amount-cell">
            <strong>¥ {{ record.paidAmount.toLocaleString() }}</strong>
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
              v-if="record.status === 'pending'"
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
    </ListPanel>
  </div>
</template>

<script setup lang="ts">
import { orderStatusOptions, type OrderRecord } from "@/data/orders";
import { useOrderStore } from "@/stores/orders";
import { Download, Eye, Search } from "kui-icons";
import { message, modal, PageHeader, type Column, type StatNumberItem } from "kui-vue";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const orderStore = useOrderStore();
const { orders } = storeToRefs(orderStore);

const stats: Array<{ title: string; data: StatNumberItem }> = [
  {
    title: "今日订单",
    data: { value: 1286, separator: ",", desc: "全部渠道" },
  },
  { title: "待付款", data: { value: 38, desc: "等待客户支付" } },
  { title: "待发货", data: { value: 126, desc: "需要仓库处理" } },
  {
    title: "退款申请",
    data: {
      value: 8,
      desc: "需要售后处理",
      trend: "2 项即将超时",
      trendStatus: "warning",
    },
  },
];
const columns: Column[] = [
  { title: "订单号", key: "id", width: 185 },
  { title: "买家", key: "buyer", width: 180 },
  { title: "商品明细", key: "items", width: 450 },
  { title: "实付金额", key: "paidAmount", width: 130 },
  { title: "状态", key: "status", width: 100 },
  { title: "操作", key: "action", width: 170, fixed: "right" },
];
const statusOptions = orderStatusOptions;
const keyword = ref("");
const status = ref<string>();
const paymentMethod = ref<string>();
const source = ref<string>();
const dateRange = ref<string[]>([]);
const paymentOptions = [...new Set(orders.value.map((item) => item.paymentMethod))].map(
  (value) => ({ label: value, value }),
);
const sourceOptions = [...new Set(orders.value.map((item) => item.source))].map((value) => ({
  label: value,
  value,
}));
const hiddenColumnKeys = ref<string[]>([]);
const filteredOrders = computed(() =>
  orders.value.filter((item) => {
    const query = keyword.value.trim().toLowerCase();
    const orderDate = item.createdAt.slice(0, 10);
    return (
      (!query ||
        item.id.toLowerCase().includes(query) ||
        item.customer.toLowerCase().includes(query) ||
        item.items.some((product) => product.name.toLowerCase().includes(query))) &&
      (!status.value || item.status === status.value) &&
      (!paymentMethod.value || item.paymentMethod === paymentMethod.value) &&
      (!source.value || item.source === source.value) &&
      (!dateRange.value[0] || orderDate >= dateRange.value[0]) &&
      (!dateRange.value[1] || orderDate <= dateRange.value[1])
    );
  }),
);
const statusLabel = (value: string) =>
  statusOptions.find((item) => item.value === value)?.label || value;
const statusColor = (value: string) =>
  ({
    pending: "orange",
    paid: "blue",
    shipped: "cyan",
    completed: "green",
    refund: "red",
  })[value] || "gray";
const resetFilters = () => {
  keyword.value = "";
  status.value = undefined;
  paymentMethod.value = undefined;
  source.value = undefined;
  dateRange.value = [];
};
const itemCount = (record: OrderRecord) =>
  record.items.reduce((total, item) => total + item.quantity, 0);
const openDetail = (record: OrderRecord) => router.push(`/order/${record.id}`);
const closePendingOrder = (record: OrderRecord) =>
  modal.confirm({
    title: "关闭订单",
    content: `确定关闭订单 ${record.id} 吗？关闭后客户将无法继续支付。`,
    onOk: () => {
      if (orderStore.closeOrder(record.id)) message.success("订单已关闭");
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
  border-radius: var(--kui-control-radius);
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

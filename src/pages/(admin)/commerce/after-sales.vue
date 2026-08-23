<template>
  <div class="pro-list-page">
    <PageHeader title="售后管理" description="处理退款、退货退款与售后审核。" />
    <Grid
      :cols="{ xs: 2, lg: 4 }"
      :x-gap="12"
      :y-gap="12"
      class="after-sale-stats"
    >
      <GridItem v-for="item in stats" :key="item.title"
        ><StatCard
          :title="item.title"
          :items="[{ value: item.value, desc: item.desc }]"
          bordered
          reverse
      /></GridItem>
    </Grid>
    <ListPanel :summary="`${filteredRecords.length} 条售后记录`">
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="售后单号、订单号或客户"
          :icon="Search"
        />
        <Select
          v-model="status"
          clearable
          placeholder="全部状态"
          :options="statusOptions"
        />
        <Select
          v-model="type"
          clearable
          placeholder="售后类型"
          :options="typeOptions"
        />
      </template>
      <template #actions
        ><Button theme="plain" @click="resetFilters">重置</Button></template
      >
      <Table
        :data="filteredRecords"
        :columns="columns"
        row-key="id"
        :scroll="{ x: 980 }"
      >
        <template #id="{ record }"
          ><div class="sale-number">
            <strong>{{ record.id }}</strong
            ><button
              type="button"
              @click="router.push(`/order/${record.orderId}`)"
            >
              {{ record.orderId }}
            </button>
          </div></template
        >
        <template #type="{ value }"
          ><Tag theme="fill">{{ typeLabel(value) }}</Tag></template
        >
        <template #amount="{ value }"
          ><strong>¥ {{ Number(value).toLocaleString() }}</strong></template
        >
        <template #status="{ value }"
          ><Tag :color="statusInfo(value).color">{{
            statusInfo(value).label
          }}</Tag></template
        >
        <template #action="{ record }">
          <Space compact
            ><Button
              size="small"
              theme="plain"
              :icon="Eye"
              @click="openDetail(record)"
              >详情</Button
            ><Button
              v-if="record.status === 'pending'"
              size="small"
              type="primary"
              @click="openReview(record, true)"
              >同意</Button
            ><Button
              v-if="record.status === 'approved'"
              size="small"
              type="primary"
              @click="refund(record)"
              >确认退款</Button
            ></Space
          >
        </template>
      </Table>
    </ListPanel>

    <Drawer v-model="detailOpen" title="售后详情" :width="560" :footer="false">
      <template v-if="activeRecord">
        <Descriptions :column="1" bordered size="small"
          ><DescriptionsItem label="售后单号">{{
            activeRecord.id
          }}</DescriptionsItem
          ><DescriptionsItem label="关联订单">{{
            activeRecord.orderId
          }}</DescriptionsItem
          ><DescriptionsItem label="客户">{{
            activeRecord.customer
          }}</DescriptionsItem
          ><DescriptionsItem label="售后类型">{{
            typeLabel(activeRecord.type)
          }}</DescriptionsItem
          ><DescriptionsItem label="申请金额"
            >¥ {{ activeRecord.amount.toLocaleString() }}</DescriptionsItem
          ><DescriptionsItem label="申请原因">{{
            activeRecord.reason
          }}</DescriptionsItem
          ><DescriptionsItem label="审核结果">{{
            statusInfo(activeRecord.status).label
          }}</DescriptionsItem
          ><DescriptionsItem v-if="activeRecord.reviewNote" label="审核备注">{{
            activeRecord.reviewNote
          }}</DescriptionsItem></Descriptions
        >
        <Space v-if="activeRecord.status === 'pending'" class="detail-actions"
          ><Button type="primary" @click="openReview(activeRecord, true)"
            >同意售后</Button
          ><Button
            type="danger"
            theme="plain"
            @click="openReview(activeRecord, false)"
            >驳回申请</Button
          ></Space
        >
      </template>
    </Drawer>
    <Modal
      v-model="reviewOpen"
      :title="reviewApproved ? '同意售后' : '驳回售后'"
      :width="440"
      @ok="submitReview"
      ><Form layout="vertical"
        ><FormItem label="审核备注"
          ><TextArea
            v-model="reviewNote"
            :rows="4"
            :placeholder="
              reviewApproved ? '填写退款或退货说明' : '请填写驳回原因'
            " /></FormItem></Form
    ></Modal>
  </div>
</template>

<script setup lang="ts">
import { useOrderStore } from "@/stores/orders";
import type { AfterSaleRecord } from "@/data/orders";
import { Eye, Search } from "kui-icons";
import { message, modal, type Column } from "kui-vue";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const orderStore = useOrderStore();
const { afterSales } = storeToRefs(orderStore);
const columns: Column[] = [
  { title: "售后单", key: "id", width: 190 },
  { title: "客户", key: "customer", width: 150 },
  { title: "类型", key: "type", width: 110 },
  { title: "退款金额", key: "amount", width: 120 },
  { title: "申请原因", key: "reason", width: 250 },
  { title: "申请时间", key: "createdAt", width: 150 },
  { title: "状态", key: "status", width: 100 },
  { title: "操作", key: "action", width: 170, fixed: "right" },
];
const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: "待审核", color: "orange" },
  approved: { label: "待退款", color: "blue" },
  rejected: { label: "已驳回", color: "red" },
  refunded: { label: "已退款", color: "green" },
};
const statusOptions = Object.entries(statusMap).map(([value, item]) => ({
  value,
  label: item.label,
}));
const typeOptions = [
  { label: "仅退款", value: "refund" },
  { label: "退货退款", value: "return_refund" },
];
const keyword = ref("");
const status = ref<string>();
const type = ref<string>();
const filteredRecords = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return afterSales.value.filter(
    (item) =>
      (!query ||
        `${item.id}${item.orderId}${item.customer}`
          .toLowerCase()
          .includes(query)) &&
      (!status.value || item.status === status.value) &&
      (!type.value || item.type === type.value),
  );
});
const stats = computed(() => [
  {
    title: "待审核",
    value: afterSales.value.filter((item) => item.status === "pending").length,
    desc: "需要及时处理",
  },
  {
    title: "待退款",
    value: afterSales.value.filter((item) => item.status === "approved").length,
    desc: "等待财务退款",
  },
  {
    title: "已退款",
    value: afterSales.value.filter((item) => item.status === "refunded").length,
    desc: "退款已完成",
  },
  {
    title: "申请金额",
    value: afterSales.value.reduce((sum, item) => sum + item.amount, 0),
    desc: "累计售后金额",
  },
]);
const typeLabel = (value: string) =>
  typeOptions.find((item) => item.value === value)?.label || value;
const statusInfo = (value: string) =>
  statusMap[value] || { label: value, color: "gray" };
const resetFilters = () => {
  keyword.value = "";
  status.value = undefined;
  type.value = undefined;
};
const detailOpen = ref(false);
const activeRecord = ref<AfterSaleRecord>();
const reviewOpen = ref(false);
const reviewApproved = ref(true);
const reviewNote = ref("");
const openDetail = (record: AfterSaleRecord) => {
  activeRecord.value = record;
  detailOpen.value = true;
};
const openReview = (record: AfterSaleRecord, approved: boolean) => {
  activeRecord.value = record;
  reviewApproved.value = approved;
  reviewNote.value = "";
  reviewOpen.value = true;
};
const submitReview = () => {
  if (!reviewApproved.value && !reviewNote.value.trim())
    return message.warning("请填写驳回原因");
  if (
    activeRecord.value &&
    orderStore.reviewAfterSale(
      activeRecord.value.id,
      reviewApproved.value,
      reviewNote.value,
    )
  ) {
    reviewOpen.value = false;
    message.success(reviewApproved.value ? "售后申请已通过" : "售后申请已驳回");
  }
};
const refund = (record: AfterSaleRecord) =>
  modal.confirm({
    title: "确认退款",
    content: `确认已向客户退款 ¥${record.amount.toLocaleString()} 吗？`,
    onOk: () => {
      if (orderStore.completeRefund(record.id))
        message.success("退款状态已更新");
    },
  });
</script>

<style scoped lang="less">
.after-sale-stats {
  margin-bottom: 16px;
}
.sale-number {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sale-number button {
  padding: 0;
  color: var(--kui-color-primary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  border: 0;
  background: none;
  cursor: pointer;
}
.detail-actions {
  margin-top: 20px;
}
</style>

<route lang="yaml">
meta:
  title: "售后管理"
  icon: "RefreshCcw"
  order: 3
</route>

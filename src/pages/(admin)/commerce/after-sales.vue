<template>
  <div class="pro-list-page">
    <PageHeader title="售后管理" description="处理退款、退货退款与售后审核。" />
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <ListPanel>
      <template #summary>
        <!-- Nothing has been counted while the list is in flight, and a refused read leaves the
             server's sentence above as the only thing this page may claim: the strip waits for an
             answer instead of reading "0 条售后记录" for a number nobody counted. -->
        <Skeleton v-if="!error" :loading="loading" :delay="0" :title-width="0" :rows="1" style="min-width: 100px" animated>
          {{ total }} 条售后记录
        </Skeleton>
      </template>
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="售后单号、订单号或客户"
          :icon="Search"
          style="width: 200px"
        />
        <Select v-model="status" clearable placeholder="全部状态" :options="statusOptions" />
        <Select v-model="type" clearable placeholder="售后类型" :options="typeOptions" />
      </template>
      <template #actions><Button theme="plain" @click="resetFilters">重置</Button></template>
      <Table
        :data="afterSales"
        :loading="loading"
        :columns="columns"
        row-key="id"
        :scroll="{ x: 980 }"
      >
        <template #id="{ record }">
          <div class="sale-number">
            <strong :title="record.id">{{ shortId(record.id) }}</strong>
            <button
              type="button"
              :title="record.orderId"
              @click="router.push(`/order/${record.orderId}`)"
            >
              {{ shortId(record.orderId) }}
            </button>
          </div>
        </template>
        <template #createdAt="{ value }">
          {{ formatDateTime(value) }}
        </template>
        <template #type="{ value }">
          <Tag theme="fill">{{ typeLabel(value) }}</Tag>
        </template>
        <template #amount="{ value }">
          <strong>¥ {{ formatMoney(value) }}</strong>
        </template>
        <template #status="{ value }">
          <Tag :color="statusInfo(value).color">{{ statusInfo(value).label }}</Tag>
        </template>
        <template #action="{ record }">
          <Space compact>
            <Button size="small" theme="plain" :icon="Eye" @click="openDetail(record)">详情</Button>
            <Button
              v-if="record.status === 'pending' && allowed('after-sale:review')"
              :disabled="saving"
              size="small"
              type="primary"
              @click="openReview(record, true)"
            >
              同意
            </Button>
            <Button
              v-if="record.status === 'approved' && allowed('after-sale:refund')"
              :disabled="saving"
              size="small"
              type="primary"
              @click="refund(record)"
            >
              登记退款结果
            </Button>
          </Space>
        </template>
      </Table>
      <!-- The strip above the table is where this page states its count, so the pager does not
           repeat it: while the first page is in flight its own total reads "Total 0 items". -->
      <Page v-model:page="page" :page-size="pageSize" :total="total" :show-total="false" :disabled="loading" />
    </ListPanel>

    <Modal
      v-model="refundOpen"
      title="登记外部退款结果"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <p>请先确认已在银行或支付平台完成退款。本操作仅登记结果，不实际转账。</p>
      <p>金额：¥ {{ formatMoney(activeRecord?.amount) }}</p>
      <FormItem label="外部退款凭证号">
        <Input v-model="refundReference" placeholder="银行或支付平台的退款流水号" />
      </FormItem>
      <template #footer>
        <Button :disabled="saving" @click="refundOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="submitRefund">确认已退款并登记</Button>
      </template>
    </Modal>
    <Drawer v-model="detailOpen" title="售后详情" :width="560" :footer="false">
      <template v-if="activeRecord">
        <Descriptions :column="1" bordered size="small">
          <DescriptionsItem label="售后单号">{{ activeRecord.id }}</DescriptionsItem>
          <DescriptionsItem label="关联订单">{{ activeRecord.orderId }}</DescriptionsItem>
          <DescriptionsItem label="客户">{{ activeRecord.customer }}</DescriptionsItem>
          <DescriptionsItem label="售后类型">{{ typeLabel(activeRecord.type) }}</DescriptionsItem>
          <DescriptionsItem label="申请金额">
            ¥ {{ formatMoney(activeRecord.amount) }}
          </DescriptionsItem>
          <DescriptionsItem label="申请原因">{{ activeRecord.reason }}</DescriptionsItem>
          <DescriptionsItem label="审核结果">
            {{ statusInfo(activeRecord.status).label }}
          </DescriptionsItem>
          <DescriptionsItem v-if="activeRecord.reviewNote" label="审核备注">
            {{ activeRecord.reviewNote }}
          </DescriptionsItem>
        </Descriptions>
        <Space
          v-if="activeRecord.status === 'pending' && allowed('after-sale:review')"
          class="detail-actions"
        >
          <Button type="primary" @click="openReview(activeRecord, true)">同意售后</Button>
          <Button type="danger" theme="plain" @click="openReview(activeRecord, false)">
            驳回申请
          </Button>
        </Space>
      </template>
    </Drawer>
    <Modal
      v-model="reviewOpen"
      :title="reviewApproved ? '同意售后' : '驳回售后'"
      :width="440"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <template #footer>
        <Button :disabled="saving" @click="reviewOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="submitReview">提交审核</Button>
      </template>
      <Form layout="vertical">
        <FormItem label="审核备注">
          <TextArea
            v-model="reviewNote"
            :rows="4"
            :placeholder="reviewApproved ? '填写退款或退货说明' : '请填写驳回原因'"
          />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { commerceApi, type AfterSaleRecord } from "@/api/commerce";
import { useResourcePage } from "@/composables/use-resource-page";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";

import { Eye, Search } from "kui-icons";
import { message, type Column } from "kui-vue";

import { ref } from "vue";
import { useRouter } from "vue-router";
import { reportFailure } from "@/utils/report-failure";
import { formatDateTime, formatMoney, shortId } from "@/utils/common";

const router = useRouter();
const auth = useAuthStore();
const allowed = (code: string) => hasPermission(code, auth.user?.permissions || []);
const saving = ref(false);
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
const {
  items: afterSales,
  total,
  page,
  pageSize,
  loading,
  error,
  reload,
} = useResourcePage<AfterSaleRecord>("/after-sales", () => ({
  keyword: keyword.value.trim(),
  status: status.value,
  type: type.value,
}));
const typeLabel = (value: string) =>
  typeOptions.find((item) => item.value === value)?.label || value;
const statusInfo = (value: string) => statusMap[value] || { label: value, color: "gray" };
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
  if (saving.value) return;
  activeRecord.value = record;
  detailOpen.value = true;
};
const openReview = (record: AfterSaleRecord, approved: boolean) => {
  if (saving.value) return;
  activeRecord.value = record;
  reviewApproved.value = approved;
  reviewNote.value = "";
  reviewOpen.value = true;
};
const refundOpen = ref(false);
const refundReference = ref("");
const submitReview = async () => {
  if (saving.value || !activeRecord.value) return;
  if (!reviewApproved.value && !reviewNote.value.trim()) return message.warning("请填写驳回原因");
  saving.value = true;
  try {
    await commerceApi.review(activeRecord.value.id, reviewApproved.value, reviewNote.value);
    reviewOpen.value = false;
    detailOpen.value = false;
    message.success("审核结果已保存");
    await reload();
  } catch (reason) {
    // Review notes stay on screen, and the server's sentence explains the refusal.
    reportFailure(reason, "审核失败");
  } finally {
    saving.value = false;
  }
};
const refund = (record: AfterSaleRecord) => {
  if (saving.value) return;
  activeRecord.value = record;
  refundReference.value = record.refundReference || "";
  refundOpen.value = true;
};
const submitRefund = async () => {
  if (saving.value || !activeRecord.value) return;
  if (!refundReference.value.trim()) return message.warning("请填写外部退款凭证号");
  saving.value = true;
  try {
    await commerceApi.refund(activeRecord.value.id, refundReference.value.trim());
    refundOpen.value = false;
    detailOpen.value = false;
    message.success("退款结果已登记（未发起转账）");
    await reload();
  } catch (reason) {
    // The same reference is kept so the retry stays idempotent.
    reportFailure(reason, "退款登记失败");
  } finally {
    saving.value = false;
  }
};
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

<template>
  <div class="pro-list-page">
    <PageHeader title="客户管理" description="统一管理企业客户、跟进状态和客户价值。">
      <template #actions>
        <Button v-if="canEdit" type="primary" :icon="UserRoundPlus" @click="drawerOpen = true">新增客户</Button>
      </template>
    </PageHeader>
    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="12" :y-gap="12" class="customer-stats">
      <GridItem v-for="card in cards" :key="card.title">
        <StatCard :title="card.title" :items="[card.item]" bordered reverse />
      </GridItem>
      <!-- The four cards are one aggregate read, so until it lands the row is drawn as four empty
           frames: a card that has not been asked yet must not read as somebody counting zero. -->
      <GridItem v-for="slot in pendingCards" :key="`customer-stat-pending-${slot}`">
        <Card bordered class="customer-stat-pending">
          <Skeleton loading :delay="0" :title-width="35" :rows="2" animated />
        </Card>
      </GridItem>
    </Grid>
    <p v-if="error" role="alert">{{ error }} <Button @click="reload">重试</Button></p>
    <ListPanel>
      <template #summary>
        <!-- Nothing has been counted while the list is in flight, and a refused read leaves the
             server's sentence above as the only thing this page may claim: the strip waits for an
             answer instead of reading "0 家客户" for a number nobody counted. -->
        <Skeleton v-if="!error" :loading="loading" :delay="0" :title-width="0" :rows="1" style="min-width: 100px" animated>
          {{ total }} 家客户
        </Skeleton>
      </template>
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="搜索客户、联系人或城市"
          :icon="Search"
          style="width: 200px"
        />
        <Select v-model="level" clearable placeholder="全部等级" :options="levelOptions" />
        <Select v-model="status" clearable placeholder="全部状态" :options="statusOptions" />
      </template>
      <template #actions>
        <Space>
          <Button theme="plain" @click="resetFilters">重置</Button>
          <TableColumnSetting
            v-model:hidden-keys="hiddenColumnKeys"
            :columns="columns"
            :disabled-keys="['customer', 'action']"
            title="列设置"
            reset-text="重置"
          />
        </Space>
      </template>
      <Table
        :data="customerData"
        :loading="loading"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 1440 }"
      >
        <template #customer="{ record }">
          <button class="customer-cell" type="button" @click="openDetail(record)">
            <span style="background: var(--kui-color-primary)"><Icon :type="Building2" /></span>
            <div>
              <strong>{{ record.name }}</strong>
              <small>{{ joinParts(record.email, record.industry) }}</small>
            </div>
          </button>
        </template>
        <template #level="{ value }">
          <Tag :color="levelColor(value)">{{ levelLabel(value) }}</Tag>
        </template>
        <template #status="{ value }">
          <Badge :status="statusBadge(value)" :text="statusLabel(value)" />
        </template>
        <template #ownerName="{ value }">{{ value || "—" }}</template>
        <template #annualValue="{ value }">¥{{ formatMoney(value) }}</template>
        <template #lastContactAt="{ value }">{{ formatDateTime(value) }}</template>
        <template #action="{ record }">
          <Button size="small" theme="plain" :icon="Eye" @click="openDetail(record)">详情</Button>
        </template>
      </Table>
      <!-- The strip above the table is where this page states its count, so the pager does not
           repeat it: while the first page is in flight its own total reads "Total 0 items". -->
      <Page v-model:page="page" :page-size="pageSize" :total="total" :show-total="false" :disabled="loading" />
    </ListPanel>

    <Drawer v-model="drawerOpen" title="新增客户" :width="480" :closable="!saving" :mask-closable="!saving" :esc-key="!saving">
      <template #footer>
        <Button :disabled="saving" @click="drawerOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="createCustomer">保存</Button>
      </template>
      <Form :model="form" layout="vertical">
        <FormItem label="企业名称"><Input v-model="form.name" clearable /></FormItem>
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="所属行业"><Input v-model="form.industry" clearable /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="客户等级">
              <Select v-model="form.level" block :options="levelOptions" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="联系人"><Input v-model="form.contact" clearable /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="联系电话"><Input v-model="form.phone" clearable /></FormItem>
          </GridItem>
        </Grid>
        <FormItem label="联系邮箱"><Input v-model="form.email" clearable /></FormItem>
      </Form>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import { catalogApi, type Customer, type CustomerSummary } from "@/api/catalog";
import { useResourcePage } from "@/composables/use-resource-page";
import { Building2, Eye, Search, UserRoundPlus } from "kui-icons";
import {
  message,
  PageHeader,
  type BadgeStatusType,
  type Column,
  type StatNumberItem,
} from "kui-vue";
import Big from "big.js";
import { computed, onMounted, reactive, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { useRouter } from "vue-router";
import { reportFailure } from "@/utils/report-failure";
import { joinParts, formatDateTime, formatMoney } from "@/utils/common";

const router = useRouter();
const auth = useAuthStore();
const canEdit = computed(() => hasPermission("customer:write", auth.user?.permissions || []));
const columns: Column[] = [
  { title: "客户", key: "customer", width: 290 },
  { title: "等级", key: "level", width: 110 },
  { title: "状态", key: "status", width: 110 },
  { title: "负责人", key: "ownerName", width: 120 },
  { title: "联系人", key: "contact", width: 100 },
  { title: "电话", key: "phone", width: 140 },
  { title: "城市", key: "city", width: 110 },
  { title: "订单数", key: "orderCount", width: 90 },
  { title: "年价值", key: "annualValue", width: 130 },
  { title: "最近联系", key: "lastContactAt", width: 150 },
  { title: "操作", key: "action", width: 90, fixed: "right" },
];
const levelOptions = [
  { label: "战略客户", value: "strategic" },
  { label: "企业客户", value: "enterprise" },
  { label: "成长客户", value: "growth" },
];
const statusOptions = [
  { label: "合作中", value: "active" },
  { label: "跟进中", value: "follow" },
  { label: "风险关注", value: "risk" },
];
const keyword = ref("");
const level = ref<Customer["level"]>();
const status = ref<Customer["status"]>();
const { items: customerData, total, page, pageSize, loading, error, reload } = useResourcePage<Customer>(
  "/customers", () => ({ keyword: keyword.value.trim(), level: level.value, status: status.value }),
);
const summary = ref<CustomerSummary>();
// A refused read has to stop the frames too: a skeleton that keeps pretending to wait would say
// the number is on its way when the server already answered "no".
const summaryFailed = ref(false);
const loadSummary = async () => {
  summaryFailed.value = false;
  try {
    summary.value = await catalogApi.customerSummary();
  } catch (reason) {
    // No numbers rather than invented ones: the cards stay off the page and the server's own words
    // say why.
    summaryFailed.value = true;
    reportFailure(reason, "客户统计加载失败");
  }
};
onMounted(loadSummary);
const pendingCards = computed(() => (summary.value || summaryFailed.value ? 0 : 4));
// Master draws the value in 万, and the server sends the same two-decimal text the 年价值 column
// carries, so the only thing decided here is the unit the card prints in.
const wan = (value: string) => Number(Big(value).div(10000).round(2));
const trendText = (value: number | null) =>
  value === null ? "" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
// Four cards, one aggregate read, and each of them is the row set the list answers for that same
// question: the unfiltered total, the row set the 等级 dropdown selects, the sum of the 年价值 column
// over every page, and the calendar month a row's own `createdAt` falls in. The list's own counter
// beside it is a different number on purpose -- it follows the filters on screen, these do not.
const cards = computed<Array<{ title: string; item: StatNumberItem }>>(() => {
  const data = summary.value;
  if (!data) return [];
  // 较上月 is measured against where the count stood at the end of last month, which is the row set
  // the server calls `beforeThisMonth` -- not against a total this month's deletions already moved.
  // Both are counts, so the only float in this page is the display rounding below.
  const growth =
    data.beforeThisMonth > 0
      ? ((data.total - data.beforeThisMonth) / data.beforeThisMonth) * 100
      : null;
  const value = Big(data.annualValue);
  // A share of revenue means something only once there is revenue to share, and the two figures
  // divided here are decimal text rather than counts.
  const share = value.eq(0)
    ? null
    : Number(Big(data.strategicAnnualValue).div(value).times(100).round(0));
  return [
    {
      title: "客户总数",
      item: {
        value: data.total,
        separator: ",",
        desc: growth === null ? "上月末还没有客户" : "较上月",
        trend: trendText(growth),
        trendStatus: growth === null ? "default" : growth >= 0 ? "success" : "danger",
      },
    },
    {
      title: "战略客户",
      item: {
        value: data.byLevel.strategic,
        desc: share === null ? "客户订单还没有收入" : `贡献 ${share}% 收入`,
      },
    },
    {
      title: "本月新增",
      item: { value: data.monthlyAdded, desc: `上月新增 ${data.lastMonthlyAdded} 家` },
    },
    {
      title: "客户年价值",
      item: {
        value: wan(data.annualValue),
        precision: 2,
        prefix: "¥",
        suffix: "万",
        desc: "全部客户订单合计",
      },
    },
  ];
});
const saving = ref(false);
const drawerOpen = ref(false);
const hiddenColumnKeys = ref<string[]>([]);
const form = reactive({
  name: "",
  industry: "",
  level: "growth" as Customer["level"],
  status: "follow" as Customer["status"],
  city: "",
  contact: "",
  phone: "",
  email: "",
});
const levelLabel = (value: string) =>
  levelOptions.find((item) => item.value === value)?.label || value;
const levelColor = (value: string) =>
  ({ strategic: "purple", enterprise: "blue", growth: "green" })[value] || "gray";
const statusLabel = (value: string) =>
  statusOptions.find((item) => item.value === value)?.label || value;
const statusBadge = (value: string): BadgeStatusType =>
  (({ active: "success", follow: "processing", risk: "warning" })[value] ||
    "default") as BadgeStatusType;
const resetFilters = () => {
  keyword.value = "";
  level.value = undefined;
  status.value = undefined;
};
const openDetail = (record: Customer) => router.push(`/customer/${record.id}`);
const createCustomer = async () => {
  if (saving.value) return;
  if (!form.name.trim() || !form.contact.trim()) return message.warning("请填写企业名称和联系人");
  saving.value = true;
  try {
    await catalogApi.saveCustomer(form);
    drawerOpen.value = false;
    Object.assign(form, { name: "", industry: "", level: "growth", contact: "", phone: "", email: "", city: "", status: "follow" });
    message.success("客户已创建");
    await Promise.all([reload(), loadSummary()]);
  } catch (reason) {
    // The form stays for a retry, and the refusal says why.
    reportFailure(reason, "保存失败");
  }
  finally { saving.value = false; }
};
</script>

<style scoped lang="less">
.customer-stats {
  margin-bottom: 16px;
}
.customer-cell {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.customer-cell > span {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  color: #fff;
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
}
.customer-cell > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.customer-cell strong {
  color: var(--kui-color-text-title);
}
.customer-cell small {
  color: var(--kui-color-text-description);
}
</style>

<route lang="yaml">
meta:
  title: "客户管理"
  icon: "Building2"
  order: 1
</route>

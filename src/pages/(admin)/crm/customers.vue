<template>
  <div class="pro-list-page">
    <PageHeader title="客户管理" description="统一管理企业客户、跟进状态和客户价值。">
      <template #actions>
        <Button type="primary" :icon="UserRoundPlus" @click="drawerOpen = true">新增客户</Button>
      </template>
    </PageHeader>
    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="12" :y-gap="12" class="customer-stats">
      <GridItem v-for="item in stats" :key="item.title">
        <StatCard :title="item.title" :items="[item.data]" bordered reverse />
      </GridItem>
    </Grid>
    <ListPanel :summary="`${filteredCustomers.length} 家客户`">
      <template #filters>
        <Input v-model="keyword" clearable placeholder="搜索客户、联系人或城市" :icon="Search" />
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
        :data="filteredCustomers"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 1050 }"
      >
        <template #customer="{ record }">
          <button class="customer-cell" type="button" @click="openDetail(record)">
            <span :style="{ background: record.color }"><Icon :type="Building2" /></span>
            <div>
              <strong>{{ record.name }}</strong>
              <small>{{ record.id }} · {{ record.industry }}</small>
            </div>
          </button>
        </template>
        <template #level="{ value }">
          <Tag :color="levelColor(value)">{{ levelLabel(value) }}</Tag>
        </template>
        <template #status="{ value }">
          <Badge :status="statusBadge(value)" :text="statusLabel(value)" />
        </template>
        <template #annualValue="{ value }">
          <strong>¥ {{ Number(value).toLocaleString() }}</strong>
        </template>
        <template #action="{ record }">
          <Button size="small" theme="plain" :icon="Eye" @click="openDetail(record)">详情</Button>
        </template>
      </Table>
    </ListPanel>

    <Drawer v-model="drawerOpen" title="新增客户" :width="480" @ok="createCustomer">
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
import {
  customers,
  type CustomerLevel,
  type CustomerRecord,
  type CustomerStatus,
} from "@/data/customers";
import { Building2, Eye, Search, UserRoundPlus } from "kui-icons";
import {
  message,
  PageHeader,
  type BadgeStatusType,
  type Column,
  type StatNumberItem,
} from "kui-vue";
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const customerData = ref([...customers]);
const stats: Array<{ title: string; data: StatNumberItem }> = [
  {
    title: "客户总数",
    data: {
      value: 1286,
      separator: ",",
      desc: "较上月",
      trend: "+8.6%",
      trendStatus: "success",
    },
  },
  { title: "战略客户", data: { value: 86, desc: "贡献 42% 收入" } },
  { title: "本月新增", data: { value: 38, desc: "目标完成率 76%" } },
  {
    title: "客户年价值",
    data: { value: 714, prefix: "¥", suffix: "万", desc: "预测年度收入" },
  },
];
const columns: Column[] = [
  { title: "客户", key: "customer", width: 290 },
  { title: "等级", key: "level", width: 110 },
  { title: "状态", key: "status", width: 110 },
  { title: "负责人", key: "owner", width: 100 },
  { title: "联系人", key: "contact", width: 100 },
  { title: "订单数", key: "orders", width: 90 },
  { title: "年价值", key: "annualValue", width: 130 },
  { title: "最近联系", key: "lastContact", width: 130 },
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
const level = ref<CustomerLevel>();
const status = ref<CustomerStatus>();
const drawerOpen = ref(false);
const hiddenColumnKeys = ref<string[]>([]);
const form = reactive({
  name: "",
  industry: "",
  level: "growth" as CustomerLevel,
  contact: "",
  phone: "",
  email: "",
});
const filteredCustomers = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return customerData.value.filter(
    (item) =>
      (!query || `${item.name}${item.contact}${item.city}`.toLowerCase().includes(query)) &&
      (!level.value || item.level === level.value) &&
      (!status.value || item.status === status.value),
  );
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
const openDetail = (record: CustomerRecord) => router.push(`/customer/${record.id}`);
const createCustomer = () => {
  if (!form.name.trim() || !form.contact.trim()) return message.warning("请填写企业名称和联系人");
  customerData.value.unshift({
    id: `C${Date.now()}`,
    ...form,
    status: "follow",
    owner: "待分配",
    city: "-",
    annualValue: 0,
    orders: 0,
    lastContact: "刚刚",
    color: "#3a95ff",
  });
  drawerOpen.value = false;
  message.success("客户已创建");
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
  border-radius: var(--kui-control-radius);
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

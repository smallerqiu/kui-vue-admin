<template>
  <div class="pro-list-page">
    <PageHeader title="订单管理" description="查询和跟踪全部交易订单。">
      <template #actions><Button :icon="Download">导出订单</Button></template>
    </PageHeader>
    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="12" :y-gap="12" class="order-stats">
      <GridItem v-for="item in stats" :key="item.title"><StatCard :title="item.title" :items="[item.data]" bordered reverse /></GridItem>
    </Grid>
    <Card bordered>
      <Space class="filter-bar" wrap>
        <Input v-model="keyword" clearable placeholder="订单号或客户名称" :icon="Search" />
        <Select v-model="status" clearable placeholder="全部状态" :options="statusOptions" />
      </Space>
      <Table :data="filteredOrders" :columns="columns" row-key="id" :scroll="{ x: 900 }">
        <template #id="{ record }"><button class="order-id" type="button" @click="openDetail(record)">{{ record.id }}</button></template>
        <template #amount="{ value }">¥ {{ Number(value).toLocaleString() }}</template>
        <template #status="{ value }"><Tag :color="statusColor(value)">{{ statusLabel(value) }}</Tag></template>
        <template #action="{ record }"><Button size="small" theme="plain" :icon="Eye" @click="openDetail(record)">详情</Button></template>
      </Table>
    </Card>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "@/components/system/page-header.vue";
import { Download, Eye, Search } from "kui-icons";
import type { Column, StatNumberItem } from "kui-vue";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

const stats: Array<{ title: string; data: StatNumberItem }> = [
  { title: "今日订单", data: { value: 1286, separator: ",", desc: "全部渠道" } },
  { title: "待付款", data: { value: 38, desc: "等待客户支付" } },
  { title: "待发货", data: { value: 126, desc: "需要仓库处理" } },
  { title: "退款申请", data: { value: 8, desc: "需要售后处理", trend: "2 项即将超时", trendStatus: "warning" } },
];
const columns: Column[] = [
  { title: "订单号", key: "id", width: 170 }, { title: "客户", key: "customer", width: 130 },
  { title: "商品", key: "product", width: 230 }, { title: "金额", key: "amount", width: 120 },
  { title: "状态", key: "status", width: 100 }, { title: "下单时间", key: "createdAt", width: 170 },
  { title: "操作", key: "action", width: 100, fixed: "right" },
];
const orders = [
  { id: "K202608230018", customer: "杭州云帆科技", product: "企业协作平台专业版", amount: 12800, status: "paid", createdAt: "2026-08-23 10:26" },
  { id: "K202608230017", customer: "上海简墨设计", product: "团队空间扩容包", amount: 2399, status: "pending", createdAt: "2026-08-23 10:08" },
  { id: "K202608230016", customer: "成都木棉网络", product: "数据分析服务年度版", amount: 28600, status: "shipped", createdAt: "2026-08-23 09:35" },
  { id: "K202608220096", customer: "深圳海洲智能", product: "企业协作平台基础版", amount: 6800, status: "refund", createdAt: "2026-08-22 17:42" },
  { id: "K202608220095", customer: "武汉星点传媒", product: "团队空间扩容包", amount: 1599, status: "completed", createdAt: "2026-08-22 16:19" },
];
const statusOptions = [
  { label: "待付款", value: "pending" }, { label: "已付款", value: "paid" },
  { label: "已发货", value: "shipped" }, { label: "已完成", value: "completed" }, { label: "退款中", value: "refund" },
];
const keyword = ref("");
const status = ref<string>();
const filteredOrders = computed(() => orders.filter((item) => {
  const query = keyword.value.trim().toLowerCase();
  return (!query || item.id.toLowerCase().includes(query) || item.customer.toLowerCase().includes(query)) && (!status.value || item.status === status.value);
}));
const statusLabel = (value: string) => statusOptions.find((item) => item.value === value)?.label || value;
const statusColor = (value: string) => ({ pending: "orange", paid: "blue", shipped: "cyan", completed: "green", refund: "red" }[value] || "gray");
const openDetail = (record: { id: string }) => router.push(`/order/${record.id}`);
</script>

<style scoped lang="less">
.pro-list-page { max-width: 1600px; margin: 0 auto; padding: 8px 6px 20px; }
.order-stats { margin-bottom: 16px; }
.filter-bar { margin-bottom: 16px; }
.order-id { padding: 0; color: var(--kui-color-primary); font: inherit; font-weight: 600; border: 0; background: transparent; cursor: pointer; }
</style>

<route lang="yaml">
meta:
  title: "订单管理"
  icon: "ReceiptText"
  order: 1
</route>

<template>
  <div class="customer-detail-page">
    <PageHeader :title="customer.name" :description="`${customer.id} · ${customer.industry}`">
      <template #actions><Button :icon="ArrowLeft" @click="router.back()">返回</Button><Button :icon="Phone">联系客户</Button><Button type="primary" :icon="Plus">新建商机</Button></template>
    </PageHeader>
    <Grid :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16">
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Space vertical block :size="16">
          <Card bordered><div class="company-profile"><span :style="{ background: customer.color }"><Icon :type="Building2" /></span><h2>{{ customer.name }}</h2><Space><Tag color="purple">{{ levelLabel }}</Tag><Badge :status="statusBadge" :text="statusLabel" /></Space></div><Divider /><div class="company-meta"><p><Icon :type="ContactRound" /> {{ customer.contact }} · {{ customer.owner }}负责</p><p><Icon :type="Phone" /> {{ customer.phone }}</p><p><Icon :type="Mail" /> {{ customer.email }}</p><p><Icon :type="MapPin" /> {{ customer.city }}</p></div></Card>
          <Card title="客户健康度" bordered><div class="health-score"><strong>86</strong><span>健康</span></div><Progress :percent="86" :show-info="false" color="#22a06b" /><p class="health-tip">近期互动活跃，订单履约情况良好。</p></Card>
        </Space>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Grid :cols="{ xs: 1, sm: 3 }" :x-gap="12" :y-gap="12" class="value-grid">
          <GridItem><StatCard title="年度客户价值" :items="[{ value: customer.annualValue, prefix: '¥', separator: ',', desc: '预计年度收入' }]" bordered reverse /></GridItem>
          <GridItem><StatCard title="累计订单" :items="[{ value: customer.orders, desc: '历史成交订单' }]" bordered reverse /></GridItem>
          <GridItem><StatCard title="合作时长" :items="[{ value: 26, suffix: '个月', desc: '自 2024 年 6 月' }]" bordered reverse /></GridItem>
        </Grid>
        <Card title="业务动态" bordered class="activity-card">
          <div class="business-events">
            <div v-for="item in events" :key="item.title"><span><Icon :type="item.icon" /></span><div><strong>{{ item.title }}</strong><p>{{ item.description }}</p><small>{{ item.time }}</small></div></div>
          </div>
        </Card>
        <Card title="最近订单" bordered>
          <Table :data="recentOrders" :columns="orderColumns" row-key="id">
            <template #amount="{ value }">¥ {{ Number(value).toLocaleString() }}</template>
            <template #status><Tag color="green">已完成</Tag></template>
          </Table>
        </Card>
      </GridItem>
    </Grid>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "@/components/system/page-header.vue";
import { customers } from "@/data/customers";
import { ArrowLeft, Building2, CheckCheck, ContactRound, FileText, Mail, MapPin, Phone, Plus, ShoppingCart } from "kui-icons";
import type { BadgeStatusType, Column, IconType } from "kui-vue";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute(); const router = useRouter();
const customer = computed(() => customers.find((item) => item.id === route.params.id) || customers[0]);
const levelLabel = computed(() => ({ strategic: "战略客户", enterprise: "企业客户", growth: "成长客户" }[customer.value.level]));
const statusLabel = computed(() => ({ active: "合作中", follow: "跟进中", risk: "风险关注" }[customer.value.status]));
const statusBadge = computed(() => ({ active: "success", follow: "processing", risk: "warning" }[customer.value.status] as BadgeStatusType));
const events: Array<{ title: string; description: string; time: string; icon: IconType[] }> = [
  { title: "完成订单交付", description: "企业协作平台专业版已完成授权交付", time: "今天 11:20", icon: CheckCheck },
  { title: "客户回访", description: "客户对数据报表功能提出了新需求", time: "昨天 16:40", icon: ContactRound },
  { title: "签署续约合同", description: "年度服务续约合同已完成电子签署", time: "8 月 18 日", icon: FileText },
  { title: "创建订单", description: "购买企业协作平台专业版", time: "8 月 12 日", icon: ShoppingCart },
];
const orderColumns: Column[] = [{ title: "订单号", key: "id" }, { title: "产品", key: "product" }, { title: "金额", key: "amount", width: 120 }, { title: "状态", key: "status", width: 100 }, { title: "日期", key: "date", width: 120 }];
const recentOrders = [{ id: "K202608230018", product: "企业协作平台专业版", amount: 12800, status: "completed", date: "2026-08-23" }, { id: "K202607160086", product: "数据分析服务年度版", amount: 28600, status: "completed", date: "2026-07-16" }, { id: "K202606080042", product: "团队空间扩容包", amount: 2399, status: "completed", date: "2026-06-08" }];
</script>

<style scoped lang="less">
.customer-detail-page { max-width: 1400px; margin: 0 auto; padding: 8px 6px 20px; }.company-profile { display: flex; flex-direction: column; align-items: center; padding: 10px; }.company-profile > span { display: grid; width: 68px; height: 68px; place-items: center; color: #fff; border-radius: var(--kui-card-radius); font-size: 28px; }.company-profile h2 { margin: 14px 0 10px; color: var(--kui-color-text-title); }.company-meta { display: grid; gap: 12px; }.company-meta p { display: flex; gap: 8px; align-items: center; margin: 0; color: var(--kui-color-text-description); }.health-score { display: flex; gap: 8px; align-items: baseline; margin-bottom: 12px; }.health-score strong { color: var(--kui-color-success); font-size: 30px; }.health-score span { color: var(--kui-color-text-description); }.health-tip { margin: 10px 0 0; color: var(--kui-color-text-description); font-size: 12px; }.value-grid { margin-bottom: 16px; }.activity-card { margin-bottom: 16px; }.business-events { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; }.business-events > div { display: grid; grid-template-columns: auto 1fr; gap: 11px; padding: 13px 0; border-bottom: 1px solid var(--kui-color-border); }.business-events > div > span { display: grid; width: 34px; height: 34px; place-items: center; color: var(--kui-color-primary); border-radius: var(--kui-control-radius); background: var(--kui-theme-fill-bg); }.business-events p { margin: 4px 0; color: var(--kui-color-text-description); }.business-events small { color: var(--kui-color-text-placeholder); }
@media (max-width: 680px) { .business-events { grid-template-columns: 1fr; } }
</style>

<route lang="yaml">
meta:
  title: "客户详情"
  icon: "Building2"
  showInMenu: false
  activeMenu: "/crm/customers"
</route>

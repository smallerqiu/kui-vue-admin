<template>
  <div class="order-detail-page">
    <PageHeader :title="`订单 ${order.id}`" description="查看订单状态、客户信息和操作记录。">
      <template #actions>
        <Button :icon="ArrowLeft" @click="router.back()">返回</Button>
        <Button v-if="order.status === 'paid'" type="primary" :icon="Truck" @click="shipOrder">确认发货</Button>
        <Button v-if="order.status !== 'refund'" color="red" theme="outline" @click="requestRefund">发起退款</Button>
      </template>
    </PageHeader>

    <Card bordered class="status-card">
      <Flex justify="space-between" align="center" wrap>
        <div class="status-summary">
          <span class="status-icon"><Icon :type="statusIcon" /></span>
          <div><Space><h2>{{ statusLabel }}</h2><Tag :color="statusColor">{{ statusLabel }}</Tag></Space><p>{{ statusDescription }}</p></div>
        </div>
        <div class="order-total"><span>订单金额</span><strong>¥ {{ order.amount.toLocaleString() }}</strong></div>
      </Flex>
      <Steps :current="stepCurrent" :status="order.status === 'refund' ? 'error' : 'process'" :items="stepItems" />
    </Card>

    <Grid :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16" class="detail-grid">
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Space vertical block :size="16">
          <Card title="商品信息" bordered>
            <div class="product-row">
              <span class="product-cover"><Icon :type="Package" /></span>
              <div><strong>{{ order.product }}</strong><p>规格：企业年度授权 · 数量：1</p><small>SKU：KUI-PRO-YEAR</small></div>
              <strong>¥ {{ order.amount.toLocaleString() }}</strong>
            </div>
          </Card>
          <Card title="订单信息" bordered>
            <Descriptions :column="2" bordered size="small">
              <DescriptionsItem label="订单编号">{{ order.id }}</DescriptionsItem>
              <DescriptionsItem label="创建时间">{{ order.createdAt }}</DescriptionsItem>
              <DescriptionsItem label="支付方式">企业网银</DescriptionsItem>
              <DescriptionsItem label="支付时间">2026-08-23 10:28:16</DescriptionsItem>
              <DescriptionsItem label="发票类型">增值税专用发票</DescriptionsItem>
              <DescriptionsItem label="订单来源">官方网站</DescriptionsItem>
              <DescriptionsItem label="客户备注" :span="2">请将授权文件发送至企业管理员邮箱。</DescriptionsItem>
            </Descriptions>
          </Card>
        </Space>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Space vertical block :size="16">
          <Card title="客户信息" bordered>
            <div class="customer-head"><Avatar :size="42" style="background: #3a95ff">杭</Avatar><div><strong>{{ order.customer }}</strong><p>企业认证客户</p></div></div>
            <Divider />
            <div class="customer-meta"><span>联系人<strong>张经理</strong></span><span>联系电话<strong>138 **** 6682</strong></span><span>联系邮箱<strong>service@example.com</strong></span></div>
          </Card>
          <Card title="操作记录" bordered>
            <div class="order-timeline">
              <div v-for="(event, index) in events" :key="event.title" :class="{ active: index === 0 }">
                <i></i><strong>{{ event.title }}</strong><p>{{ event.description }}</p><small>{{ event.time }}</small>
              </div>
            </div>
          </Card>
        </Space>
      </GridItem>
    </Grid>
  </div>
</template>

<script setup lang="ts">
import PageHeader from "@/components/system/page-header.vue";
import { ArrowLeft, CircleCheck, Clock, Package, RotateCcw, Truck } from "kui-icons";
import { message, modal, type IconType } from "kui-vue";
import { computed, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute(); const router = useRouter();
const order = reactive({ id: String(route.params.id), customer: "杭州云帆科技", product: "企业协作平台专业版", amount: 12800, status: "paid", createdAt: "2026-08-23 10:26:08" });
const statusMap: Record<string, { label: string; description: string; color: string; icon: IconType[]; step: number }> = {
  pending: { label: "待付款", description: "订单等待客户完成支付。", color: "orange", icon: Clock, step: 0 },
  paid: { label: "已付款", description: "客户已完成支付，请及时安排发货。", color: "blue", icon: CircleCheck, step: 1 },
  shipped: { label: "已发货", description: "授权文件已经发送给客户。", color: "cyan", icon: Truck, step: 2 },
  completed: { label: "已完成", description: "订单交易已经完成。", color: "green", icon: CircleCheck, step: 3 },
  refund: { label: "退款中", description: "退款申请正在处理中。", color: "red", icon: RotateCcw, step: 1 },
};
const currentStatus = computed(() => statusMap[order.status]);
const statusLabel = computed(() => currentStatus.value.label); const statusDescription = computed(() => currentStatus.value.description);
const statusColor = computed(() => currentStatus.value.color); const statusIcon = computed(() => currentStatus.value.icon); const stepCurrent = computed(() => currentStatus.value.step);
const stepItems = [{ title: "提交订单", description: "08-23 10:26" }, { title: "完成支付", description: "08-23 10:28" }, { title: "交付授权" }, { title: "交易完成" }];
const events = reactive([
  { title: "订单支付成功", description: "企业网银支付 ¥12,800", time: "今天 10:28" },
  { title: "订单已创建", description: "客户通过官方网站提交订单", time: "今天 10:26" },
]);
const shipOrder = () => modal.confirm({ title: "确认发货", content: "确认已经向客户交付授权文件吗？", onOk: () => { order.status = "shipped"; events.unshift({ title: "订单已发货", description: "管理员确认交付授权文件", time: "刚刚" }); message.success("订单已更新为已发货"); } });
const requestRefund = () => modal.confirm({ title: "发起退款", content: "退款后订单将进入售后处理流程，确定继续吗？", onOk: () => { order.status = "refund"; events.unshift({ title: "提交退款申请", description: "管理员主动发起退款", time: "刚刚" }); message.success("退款申请已提交"); } });
</script>

<style scoped lang="less">
.order-detail-page { max-width: 1400px; margin: 0 auto; padding: 8px 6px 20px; }.detail-grid { margin-top: 16px; }
.status-card { margin-bottom: 0; }.status-card :deep(.k-steps) { margin-top: 24px; }
.status-summary { display: flex; gap: 13px; align-items: center; }.status-summary h2 { margin: 0; color: var(--kui-color-text-title); font-size: 18px; }.status-summary p { margin: 5px 0 0; color: var(--kui-color-text-description); }
.status-icon { display: grid; width: 46px; height: 46px; place-items: center; color: var(--kui-color-primary); border-radius: var(--kui-control-radius); background: var(--kui-theme-fill-bg); font-size: 22px; }
.order-total { text-align: right; }.order-total span { display: block; color: var(--kui-color-text-description); }.order-total strong { display: block; margin-top: 3px; color: var(--kui-color-text-title); font-size: 24px; }
.product-row { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; align-items: center; }.product-cover { display: grid; width: 58px; height: 58px; place-items: center; color: #fff; border-radius: var(--kui-control-radius); background: linear-gradient(135deg, #54a9ff, #7b61ff); font-size: 24px; }.product-row p { margin: 5px 0; color: var(--kui-color-text-description); }.product-row small { color: var(--kui-color-text-placeholder); }
.customer-head { display: flex; gap: 11px; align-items: center; }.customer-head p { margin: 3px 0 0; color: var(--kui-color-text-description); }.customer-meta { display: grid; gap: 12px; }.customer-meta span { display: flex; justify-content: space-between; gap: 12px; color: var(--kui-color-text-description); }.customer-meta strong { color: var(--kui-color-text); font-weight: 500; }
.order-timeline { padding-left: 6px; }.order-timeline > div { position: relative; padding: 0 0 22px 21px; border-left: 1px solid var(--kui-color-border); }.order-timeline > div:last-child { padding-bottom: 0; }.order-timeline i { position: absolute; top: 4px; left: -5px; width: 9px; height: 9px; border-radius: 50%; background: var(--kui-color-border); }.order-timeline .active i { background: var(--kui-color-primary); box-shadow: 0 0 0 4px var(--kui-color-primary-8); }.order-timeline p { margin: 4px 0; color: var(--kui-color-text-description); }.order-timeline small { color: var(--kui-color-text-placeholder); }
@media (max-width: 600px) { .product-row { grid-template-columns: auto 1fr; }.product-row > strong { grid-column: 2; }.order-total { width: 100%; margin-top: 12px; text-align: left; }.status-card :deep(.k-steps) { overflow-x: auto; } }
</style>

<route lang="yaml">
meta:
  title: "订单详情"
  icon: "ReceiptText"
  showInMenu: false
  activeMenu: "/commerce/orders"
</route>

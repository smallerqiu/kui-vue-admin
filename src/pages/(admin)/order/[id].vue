<template>
  <div class="order-detail-page">
    <PageHeader
      :title="`订单 ${order.id}`"
      description="查看订单状态、客户信息和操作记录。"
    >
      <template #actions>
        <Button :icon="ArrowLeft" @click="router.back()">返回</Button>
        <Button v-if="order.status === 'pending'" @click="openPrice"
          >调整价格</Button
        >
        <Button
          v-if="order.status === 'pending'"
          color="red"
          theme="outline"
          @click="closeOrder"
          >关闭订单</Button
        >
        <Button
          v-if="['paid', 'partial_shipped'].includes(order.status)"
          type="primary"
          :icon="Truck"
          @click="openShipping"
          >订单发货</Button
        >
        <Button
          v-if="!['pending', 'closed', 'refund'].includes(order.status)"
          color="red"
          theme="outline"
          @click="openAfterSale"
          >发起售后</Button
        >
      </template>
    </PageHeader>

    <Card bordered class="status-card">
      <Flex justify="space-between" align="center" wrap>
        <div class="status-summary">
          <span class="status-icon"><Icon :type="statusIcon" /></span>
          <div>
            <Space
              ><h2>{{ statusLabel }}</h2>
              <Tag :color="statusColor">{{ statusLabel }}</Tag></Space
            >
            <p>{{ statusDescription }}</p>
          </div>
        </div>
        <div class="order-total">
          <span>实付金额</span
          ><strong>¥ {{ order.paidAmount.toLocaleString() }}</strong>
        </div>
      </Flex>
      <Steps
        :current="stepCurrent"
        :status="order.status === 'refund' ? 'error' : 'process'"
        :items="stepItems"
      />
    </Card>

    <Grid :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16" class="detail-grid">
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Space vertical block :size="16">
          <Card title="商品信息" bordered>
            <div class="product-list">
              <div
                v-for="item in order.items"
                :key="item.id"
                class="product-row"
              >
                <Image :src="item.image" :width="64" :height="64" fit="cover" />
                <div>
                  <strong>{{ item.name }}</strong>
                  <p>{{ item.specs }}</p>
                  <small>SKU：{{ item.sku }}</small>
                </div>
                <div class="product-price">
                  <strong>¥ {{ item.price.toLocaleString() }}</strong
                  ><span>× {{ item.quantity }}</span>
                </div>
              </div>
            </div>
            <div class="amount-summary">
              <span
                >商品金额<strong
                  >¥ {{ order.goodsAmount.toLocaleString() }}</strong
                ></span
              >
              <span
                >运费<strong>{{
                  order.freight ? `¥ ${order.freight}` : "免运费"
                }}</strong></span
              >
              <span
                >优惠<strong class="discount"
                  >- ¥ {{ order.discount.toLocaleString() }}</strong
                ></span
              >
              <span class="paid"
                >实付款<strong
                  >¥ {{ order.paidAmount.toLocaleString() }}</strong
                ></span
              >
            </div>
          </Card>
          <Card title="收货与配送" bordered>
            <template #extra
              ><Button size="small" theme="plain" @click="openAddress"
                >修改地址</Button
              ></template
            >
            <Descriptions :column="2" bordered size="small">
              <DescriptionsItem label="收货人">{{
                order.contact
              }}</DescriptionsItem>
              <DescriptionsItem label="联系电话">{{
                order.phone
              }}</DescriptionsItem>
              <DescriptionsItem label="收货地址" :span="2">{{
                order.address
              }}</DescriptionsItem>
              <DescriptionsItem label="配送方式">{{
                order.shippingCompany || "待选择"
              }}</DescriptionsItem>
              <DescriptionsItem label="物流单号">{{
                order.trackingNo || "尚未发货"
              }}</DescriptionsItem>
            </Descriptions>
          </Card>
          <Card title="订单信息" bordered>
            <template #extra
              ><Button size="small" theme="plain" @click="openRemark"
                >商家备注</Button
              ></template
            >
            <Descriptions :column="2" bordered size="small">
              <DescriptionsItem label="订单编号">{{
                order.id
              }}</DescriptionsItem>
              <DescriptionsItem label="创建时间">{{
                order.createdAt
              }}</DescriptionsItem>
              <DescriptionsItem label="支付方式">{{
                order.paymentMethod
              }}</DescriptionsItem>
              <DescriptionsItem label="支付时间">{{
                order.paymentAt || "尚未支付"
              }}</DescriptionsItem>
              <DescriptionsItem label="订单来源">{{
                order.source
              }}</DescriptionsItem>
              <DescriptionsItem label="商品件数"
                >{{ itemCount }} 件</DescriptionsItem
              >
              <DescriptionsItem label="客户备注" :span="2">{{
                order.note || "无"
              }}</DescriptionsItem>
              <DescriptionsItem label="商家备注" :span="2">{{
                order.merchantRemark || "无"
              }}</DescriptionsItem>
            </Descriptions>
          </Card>
          <Card v-if="order.shipments?.length" title="发货记录" bordered>
            <div
              v-for="shipment in order.shipments"
              :key="shipment.id"
              class="shipment-row"
            >
              <div>
                <strong
                  >{{ shipment.company }} · {{ shipment.trackingNo }}</strong
                ><small>{{ shipment.createdAt }}</small>
              </div>
              <Tag color="blue"
                >{{
                  shipment.items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  )
                }}
                件商品</Tag
              >
            </div>
          </Card>
        </Space>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Space vertical block :size="16">
          <Card title="客户信息" bordered>
            <div class="customer-head">
              <Avatar :size="42" style="background: #3a95ff">{{
                order.customer.slice(0, 1)
              }}</Avatar>
              <div>
                <strong>{{ order.customer }}</strong>
                <p>企业认证客户</p>
              </div>
            </div>
            <Divider />
            <div class="customer-meta">
              <span
                >下单人<strong>{{ order.buyer }}</strong></span
              ><span
                >联系人<strong>{{ order.contact }}</strong></span
              ><span
                >联系电话<strong>{{ order.phone }}</strong></span
              >
            </div>
          </Card>
          <Card title="操作记录" bordered>
            <div class="order-timeline">
              <div
                v-for="(event, index) in events"
                :key="event.title"
                :class="{ active: index === 0 }"
              >
                <i></i><strong>{{ event.title }}</strong>
                <p>{{ event.description }}</p>
                <small>{{ event.time }}</small>
              </div>
            </div>
          </Card>
        </Space>
      </GridItem>
    </Grid>

    <Drawer
      v-model="shippingOpen"
      title="订单发货"
      :width="500"
      @ok="submitShipping"
    >
      <Form layout="vertical">
        <Grid :cols="2" :x-gap="12">
          <GridItem
            ><FormItem label="物流公司"
              ><Select
                v-model="shippingForm.company"
                block
                :options="shippingCompanies" /></FormItem
          ></GridItem>
          <GridItem
            ><FormItem label="物流单号"
              ><Input
                v-model="shippingForm.trackingNo"
                clearable
                placeholder="请输入物流单号" /></FormItem
          ></GridItem>
        </Grid>
        <FormItem label="本次发货商品">
          <div class="shipping-products">
            <div v-for="item in shippableItems" :key="item.id">
              <Image :src="item.image" :width="44" :height="44" fit="cover" />
              <div>
                <strong>{{ item.name }}</strong
                ><small
                  >待发
                  {{ item.quantity - (item.shippedQuantity || 0) }} 件</small
                >
              </div>
              <InputNumber
                v-model="shippingForm.quantities[item.id]"
                :min="0"
                :max="item.quantity - (item.shippedQuantity || 0)"
              />
            </div>
          </div>
        </FormItem>
      </Form>
    </Drawer>

    <Modal
      v-model="addressOpen"
      title="修改收货信息"
      :width="500"
      @ok="saveAddress"
    >
      <Form layout="vertical"
        ><Grid :cols="2" :x-gap="12"
          ><GridItem
            ><FormItem label="收货人"
              ><Input v-model="addressForm.contact" /></FormItem></GridItem
          ><GridItem
            ><FormItem label="联系电话"
              ><Input v-model="addressForm.phone" /></FormItem></GridItem></Grid
        ><FormItem label="详细地址"
          ><TextArea v-model="addressForm.address" :rows="3" /></FormItem
      ></Form>
    </Modal>
    <Modal
      v-model="priceOpen"
      title="调整订单价格"
      :width="420"
      @ok="savePrice"
    >
      <Form layout="vertical"
        ><FormItem label="优惠金额"
          ><InputNumber
            v-model="priceDiscount"
            :min="0"
            :max="order.goodsAmount + order.freight"
            prefix="¥"
        /></FormItem>
        <p class="price-preview">
          调整后应付：<strong
            >¥
            {{
              (
                order.goodsAmount +
                order.freight -
                priceDiscount
              ).toLocaleString()
            }}</strong
          >
        </p></Form
      >
    </Modal>
    <Modal v-model="remarkOpen" title="商家备注" :width="440" @ok="saveRemark">
      <TextArea
        v-model="merchantRemark"
        :rows="4"
        placeholder="仅后台人员可见"
      />
    </Modal>
    <Modal
      v-model="afterSaleOpen"
      title="发起售后"
      :width="500"
      @ok="submitAfterSale"
    >
      <Form layout="vertical"
        ><FormItem label="售后类型"
          ><RadioGroup
            v-model="afterSaleForm.type"
            :options="afterSaleTypes" /></FormItem
        ><FormItem label="售后商品"
          ><CheckboxGroup
            v-model="afterSaleForm.itemIds"
            direction="vertical"
            :options="afterSaleItemOptions" /></FormItem
        ><FormItem label="退款金额"
          ><InputNumber
            v-model="afterSaleForm.amount"
            :min="0"
            :max="order.paidAmount"
            prefix="¥" /></FormItem
        ><FormItem label="售后原因"
          ><TextArea v-model="afterSaleForm.reason" :rows="3" /></FormItem
      ></Form>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { PageHeader } from "kui-vue";
import type { OrderRecord } from "@/data/orders";
import { useOrderStore } from "@/stores/orders";
import { ArrowLeft, CircleCheck, Clock, RotateCcw, Truck } from "kui-icons";
import { message, modal, type IconType } from "kui-vue";
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();
const orderStore = useOrderStore();
const requestedId = String(route.params.id);
const order = computed<OrderRecord>(
  () => orderStore.getOrder(requestedId) || orderStore.orders[0],
);
const statusMap: Record<
  string,
  {
    label: string;
    description: string;
    color: string;
    icon: IconType[];
    step: number;
  }
> = {
  pending: {
    label: "待付款",
    description: "订单等待客户完成支付。",
    color: "orange",
    icon: Clock,
    step: 0,
  },
  paid: {
    label: "待发货",
    description: "客户已完成支付，请及时安排出库发货。",
    color: "blue",
    icon: CircleCheck,
    step: 1,
  },
  partial_shipped: {
    label: "部分发货",
    description: "部分商品已经发货，请继续处理剩余商品。",
    color: "cyan",
    icon: Truck,
    step: 2,
  },
  shipped: {
    label: "已发货",
    description: "商品已经交付物流，等待客户签收。",
    color: "cyan",
    icon: Truck,
    step: 2,
  },
  completed: {
    label: "已完成",
    description: "订单交易已经完成。",
    color: "green",
    icon: CircleCheck,
    step: 3,
  },
  refund: {
    label: "退款中",
    description: "退款申请正在处理中。",
    color: "red",
    icon: RotateCcw,
    step: 1,
  },
  closed: {
    label: "已关闭",
    description: "订单已关闭，无法继续支付。",
    color: "gray",
    icon: Clock,
    step: 0,
  },
};
const currentStatus = computed(() => statusMap[order.value.status]);
const statusLabel = computed(() => currentStatus.value.label);
const statusDescription = computed(() => currentStatus.value.description);
const statusColor = computed(() => currentStatus.value.color);
const statusIcon = computed(() => currentStatus.value.icon);
const stepCurrent = computed(() => currentStatus.value.step);
const stepItems = [
  { title: "提交订单", description: "08-23 10:26" },
  { title: "完成支付", description: "08-23 10:28" },
  { title: "商品出库" },
  { title: "确认收货" },
];
const itemCount = computed(() =>
  order.value.items.reduce((total, item) => total + item.quantity, 0),
);
const events = reactive([
  {
    title: "订单支付成功",
    description: `${order.value.paymentMethod}支付 ¥${order.value.paidAmount.toLocaleString()}`,
    time: order.value.paymentAt || "-",
  },
  {
    title: "订单已创建",
    description: "客户通过官方网站提交订单",
    time: "今天 10:26",
  },
]);
const shippingOpen = ref(false);
const addressOpen = ref(false);
const priceOpen = ref(false);
const remarkOpen = ref(false);
const afterSaleOpen = ref(false);
const shippingCompanies = ["顺丰速运", "京东物流", "中通快递", "圆通速递"].map(
  (value) => ({ label: value, value }),
);
const shippingForm = reactive({
  company: "顺丰速运",
  trackingNo: "",
  quantities: {} as Record<string, number>,
});
const shippableItems = computed(() =>
  order.value.items.filter(
    (item) => (item.shippedQuantity || 0) < item.quantity,
  ),
);
const openShipping = () => {
  shippingForm.trackingNo = "";
  shippingForm.quantities = {};
  shippableItems.value.forEach((item) => {
    shippingForm.quantities[item.id] =
      item.quantity - (item.shippedQuantity || 0);
  });
  shippingOpen.value = true;
};
const submitShipping = () => {
  if (!shippingForm.company || !shippingForm.trackingNo.trim())
    return message.warning("请填写物流公司和物流单号");
  if (
    !orderStore.shipOrder(
      order.value.id,
      shippingForm.company,
      shippingForm.trackingNo,
      shippingForm.quantities,
    )
  )
    return message.warning("请至少选择一件待发商品");
  const count = Object.values(shippingForm.quantities).reduce(
    (total, value) => total + Number(value || 0),
    0,
  );
  events.unshift({
    title: "订单已发货",
    description: `${shippingForm.company} · ${shippingForm.trackingNo} · ${count} 件`,
    time: "刚刚",
  });
  shippingOpen.value = false;
  message.success("发货信息已保存");
};
const addressForm = reactive({ contact: "", phone: "", address: "" });
const openAddress = () => {
  Object.assign(addressForm, {
    contact: order.value.contact,
    phone: order.value.phone,
    address: order.value.address,
  });
  addressOpen.value = true;
};
const saveAddress = () => {
  if (
    !addressForm.contact.trim() ||
    !addressForm.phone.trim() ||
    !addressForm.address.trim()
  )
    return message.warning("请填写完整收货信息");
  orderStore.updateAddress(order.value.id, addressForm);
  addressOpen.value = false;
  message.success("收货信息已更新");
};
const priceDiscount = ref(0);
const merchantRemark = ref("");
const openPrice = () => {
  priceDiscount.value = order.value.discount;
  priceOpen.value = true;
};
const savePrice = () => {
  orderStore.adjustPrice(order.value.id, priceDiscount.value);
  priceOpen.value = false;
  message.success("订单价格已调整");
};
const openRemark = () => {
  merchantRemark.value = order.value.merchantRemark || "";
  remarkOpen.value = true;
};
const saveRemark = () => {
  orderStore.setMerchantRemark(order.value.id, merchantRemark.value);
  remarkOpen.value = false;
  message.success("商家备注已保存");
};
const closeOrder = () =>
  modal.confirm({
    title: "关闭订单",
    content: "关闭后客户将无法继续支付，确定继续吗？",
    onOk: () => {
      if (orderStore.closeOrder(order.value.id)) message.success("订单已关闭");
    },
  });
const afterSaleTypes = [
  { label: "仅退款", value: "refund" },
  { label: "退货退款", value: "return_refund" },
];
const afterSaleForm = reactive<{
  type: "refund" | "return_refund";
  itemIds: string[];
  amount: number;
  reason: string;
}>({ type: "refund", itemIds: [], amount: 0, reason: "" });
const afterSaleItemOptions = computed(() =>
  order.value.items.map((item) => ({
    label: `${item.name}（${item.sku}）`,
    value: item.id,
  })),
);
const openAfterSale = () => {
  Object.assign(afterSaleForm, {
    type: "refund",
    itemIds: order.value.items.map((item) => item.id),
    amount: order.value.paidAmount,
    reason: "",
  });
  afterSaleOpen.value = true;
};
const submitAfterSale = () => {
  if (!afterSaleForm.itemIds.length || !afterSaleForm.reason.trim())
    return message.warning("请选择商品并填写售后原因");
  orderStore.createAfterSale({
    orderId: order.value.id,
    type: afterSaleForm.type,
    itemIds: [...afterSaleForm.itemIds],
    amount: afterSaleForm.amount,
    reason: afterSaleForm.reason,
  });
  afterSaleOpen.value = false;
  events.unshift({
    title: "提交售后申请",
    description: `退款金额 ¥${afterSaleForm.amount.toLocaleString()}`,
    time: "刚刚",
  });
  message.success("售后申请已创建");
};
</script>

<style scoped lang="less">
.order-detail-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 8px 6px 20px;
}
.detail-grid {
  margin-top: 16px;
}
.status-card {
  margin-bottom: 0;
}
.status-card :deep(.k-steps) {
  margin-top: 24px;
}
.status-summary {
  display: flex;
  gap: 13px;
  align-items: center;
}
.status-summary h2 {
  margin: 0;
  color: var(--kui-color-text-title);
  font-size: 18px;
}
.status-summary p {
  margin: 5px 0 0;
  color: var(--kui-color-text-description);
}
.status-icon {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  color: var(--kui-color-primary);
  border-radius: var(--kui-control-radius);
  background: var(--kui-theme-fill-bg);
  font-size: 22px;
}
.order-total {
  text-align: right;
}
.order-total span {
  display: block;
  color: var(--kui-color-text-description);
}
.order-total strong {
  display: block;
  margin-top: 3px;
  color: var(--kui-color-text-title);
  font-size: 24px;
}
.product-list {
  display: grid;
  gap: 0;
}
.product-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 14px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--kui-color-border);
}
.product-row:first-child {
  padding-top: 0;
}
.product-row:last-child {
  border-bottom: 0;
}
.product-row :deep(.k-image) {
  border-radius: var(--kui-control-radius);
}
.product-row p {
  margin: 5px 0;
  color: var(--kui-color-text-description);
}
.product-row small {
  color: var(--kui-color-text-placeholder);
}
.product-price {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}
.product-price span {
  color: var(--kui-color-text-description);
}
.amount-summary {
  display: grid;
  gap: 8px;
  justify-content: end;
  padding-top: 14px;
  border-top: 1px solid var(--kui-color-border);
}
.amount-summary span {
  display: flex;
  min-width: 230px;
  justify-content: space-between;
  gap: 28px;
  color: var(--kui-color-text-description);
}
.amount-summary strong {
  color: var(--kui-color-text-title);
}
.amount-summary .discount {
  color: var(--kui-color-danger);
}
.amount-summary .paid {
  align-items: baseline;
  color: var(--kui-color-text-title);
}
.amount-summary .paid strong {
  color: var(--kui-color-primary);
  font-size: 20px;
}
.customer-head {
  display: flex;
  gap: 11px;
  align-items: center;
}
.customer-head p {
  margin: 3px 0 0;
  color: var(--kui-color-text-description);
}
.customer-meta {
  display: grid;
  gap: 12px;
}
.customer-meta span {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--kui-color-text-description);
}
.customer-meta strong {
  color: var(--kui-color-text);
  font-weight: 500;
}
.order-timeline {
  padding-left: 6px;
}
.order-timeline > div {
  position: relative;
  padding: 0 0 22px 21px;
  border-left: 1px solid var(--kui-color-border);
}
.order-timeline > div:last-child {
  padding-bottom: 0;
}
.order-timeline i {
  position: absolute;
  top: 4px;
  left: -5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--kui-color-border);
}
.order-timeline .active i {
  background: var(--kui-color-primary);
  box-shadow: 0 0 0 4px var(--kui-color-primary-8);
}
.order-timeline p {
  margin: 4px 0;
  color: var(--kui-color-text-description);
}
.order-timeline small {
  color: var(--kui-color-text-placeholder);
}
.shipment-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--kui-color-border);
}
.shipment-row:last-child {
  border-bottom: 0;
}
.shipment-row > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.shipment-row small {
  color: var(--kui-color-text-description);
}
.shipping-products {
  display: grid;
  gap: 10px;
  width: 100%;
}
.shipping-products > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 110px;
  gap: 10px;
  align-items: center;
  padding: 10px;
  border-radius: var(--kui-control-radius);
  background: var(--kui-theme-fill-bg);
}
.shipping-products > div > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
.shipping-products small {
  color: var(--kui-color-text-description);
}
.price-preview {
  padding: 12px;
  color: var(--kui-color-text-description);
  border-radius: var(--kui-control-radius);
  background: var(--kui-theme-fill-bg);
}
.price-preview strong {
  color: var(--kui-color-primary);
  font-size: 18px;
}
@media (max-width: 600px) {
  .product-row {
    grid-template-columns: auto 1fr;
  }
  .product-row > strong {
    grid-column: 2;
  }
  .order-total {
    width: 100%;
    margin-top: 12px;
    text-align: left;
  }
  .status-card :deep(.k-steps) {
    overflow-x: auto;
  }
}
</style>

<route lang="yaml">
meta:
  title: "订单详情"
  icon: "ReceiptText"
  showInMenu: false
  activeMenu: "/commerce/orders"
</route>

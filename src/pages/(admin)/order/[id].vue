<template>
  <div v-if="order" class="order-detail-page">
    <PageHeader
      :title="`订单 ${shortId(order.id)}`"
      description="查看订单状态、客户信息和操作记录。"
    >
      <template #actions>
        <Button
          v-if="order.status === 'pending' && allowed('order:payment')"
          :disabled="saving"
          @click="paymentOpen = true"
        >
          登记收款
        </Button>
        <Button :icon="ArrowLeft" @click="router.back()">返回</Button>
        <Button
          v-if="order.status === 'pending' && allowed('order:adjust')"
          :disabled="saving"
          @click="openPrice"
        >
          调整价格
        </Button>
        <Button
          v-if="order.status === 'pending' && allowed('order:close')"
          :disabled="saving"
          color="red"
          theme="outline"
          @click="closeOrder"
        >
          关闭订单
        </Button>
        <Button
          v-if="['paid', 'partial_shipped'].includes(order.status) && allowed('order:ship')"
          :disabled="saving"
          type="primary"
          :icon="Truck"
          @click="openShipping"
        >
          订单发货
        </Button>
        <Button
          v-if="
            ['paid', 'partial_shipped', 'shipped', 'completed'].includes(order.status) &&
            allowed('after-sale:write')
          "
          :disabled="saving"
          color="red"
          theme="outline"
          @click="openAfterSale"
        >
          发起售后
        </Button>
      </template>
    </PageHeader>

    <Card bordered class="status-card">
      <Flex justify="space-between" align="center" wrap>
        <div class="status-summary">
          <span class="status-icon"><Icon :type="statusIcon" /></span>
          <div>
            <Space>
              <h2>{{ statusLabel }}</h2>
              <Tag :color="statusColor">{{ statusLabel }}</Tag>
            </Space>
            <p>{{ statusDescription }}</p>
          </div>
        </div>
        <div class="order-total">
          <span>订单金额</span>
          <strong>¥ {{ formatMoney(order.paidAmount) }}</strong>
        </div>
      </Flex>
      <Steps
        :current="stepCurrent"
        :status="['refunded', 'closed'].includes(order.status) ? 'error' : 'process'"
        :items="stepItems"
      />
    </Card>

    <Grid :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16" class="detail-grid">
      <GridItem :span="{ xs: 1, lg: 8 }">
        <Space vertical block :size="16">
          <Card title="商品信息" bordered>
            <div class="product-list">
              <div v-for="item in order.items" :key="item.id" class="product-row">
                <Image
                  :src="item.image"
                  :width="64"
                  :height="64"
                  :img-style="{ objectFit: 'cover' }"
                />
                <div>
                  <strong>{{ item.name }}</strong>
                  <p>{{ item.specs }}</p>
                  <small>SKU：{{ item.sku }}</small>
                </div>
                <div class="product-price">
                  <strong>¥ {{ formatMoney(item.price) }}</strong>
                  <span>× {{ item.quantity }}</span>
                </div>
              </div>
            </div>
            <div class="amount-summary">
              <span>
                商品金额
                <strong>¥ {{ formatMoney(order.goodsAmount) }}</strong>
              </span>
              <span>
                运费
                <strong>
                  {{ hasFreight(order.freight) ? `¥ ${formatMoney(order.freight)}` : "免运费" }}
                </strong>
              </span>
              <span>
                优惠
                <strong class="discount">- ¥ {{ formatMoney(order.discount) }}</strong>
              </span>
              <span class="paid">
                订单应付
                <strong>¥ {{ formatMoney(order.paidAmount) }}</strong>
              </span>
              <span>
                已登记退款
                <strong>¥ {{ formatMoney(order.refundedAmount) }}</strong>
              </span>
            </div>
          </Card>
          <Card title="收货与配送" bordered>
            <template #extra>
              <Button
                v-if="['pending', 'paid'].includes(order.status) && allowed('order:address')"
                :disabled="saving"
                size="small"
                theme="plain"
                @click="openAddress"
              >
                修改地址
              </Button>
            </template>
            <Descriptions :column="2" bordered size="small">
              <DescriptionsItem label="收货人">{{ order.contact }}</DescriptionsItem>
              <DescriptionsItem label="联系电话">{{ order.phone }}</DescriptionsItem>
              <DescriptionsItem label="收货地址" :span="2">{{ order.address }}</DescriptionsItem>
              <DescriptionsItem label="配送方式">
                {{ order.shipments.at(-1)?.company || "待选择" }}
              </DescriptionsItem>
              <DescriptionsItem label="物流单号">
                {{ order.shipments.at(-1)?.trackingNo || "尚未发货" }}
              </DescriptionsItem>
            </Descriptions>
          </Card>
          <Card title="订单信息" bordered>
            <template #extra>
              <Button
                v-if="allowed('order:remark')"
                :disabled="saving"
                size="small"
                theme="plain"
                @click="openRemark"
              >
                商家备注
              </Button>
            </template>
            <Descriptions :column="2" bordered size="small">
              <DescriptionsItem label="订单编号">{{ order.id }}</DescriptionsItem>
              <DescriptionsItem label="创建时间">
                {{ formatDateTime(order.createdAt) }}
              </DescriptionsItem>
              <DescriptionsItem label="支付方式">{{ order.paymentMethod }}</DescriptionsItem>
              <DescriptionsItem label="支付时间">
                {{ order.paymentAt ? formatDateTime(order.paymentAt) : "尚未支付" }}
              </DescriptionsItem>
              <DescriptionsItem label="订单来源">{{ order.source }}</DescriptionsItem>
              <DescriptionsItem label="商品件数">{{ itemCount }} 件</DescriptionsItem>
              <DescriptionsItem label="客户备注" :span="2">
                {{ order.note || "无" }}
              </DescriptionsItem>
              <DescriptionsItem label="商家备注" :span="2">
                {{ order.merchantRemark || "无" }}
              </DescriptionsItem>
            </Descriptions>
          </Card>
          <Card v-if="order.shipments?.length" title="发货记录" bordered>
            <div v-for="shipment in order.shipments" :key="shipment.id" class="shipment-row">
              <div>
                <strong>{{ shipment.company }} · {{ shipment.trackingNo }}</strong>
                <small>{{ formatDateTime(shipment.createdAt) }}</small>
              </div>
              <Tag color="blue">
                {{ shipment.items.reduce((total, item) => total + item.quantity, 0) }} 件商品
              </Tag>
            </div>
          </Card>
        </Space>
      </GridItem>
      <GridItem :span="{ xs: 1, lg: 4 }">
        <Space vertical block :size="16">
          <Card title="客户信息" bordered>
            <div class="customer-head">
              <Avatar :size="42" style="background: #3a95ff">
                {{ order.customer.slice(0, 1) }}
              </Avatar>
              <div>
                <strong>{{ order.customer }}</strong>
              </div>
            </div>
            <Divider />
            <div class="customer-meta">
              <span>
                联系人
                <strong>{{ order.contact }}</strong>
              </span>
              <span>
                联系电话
                <strong>{{ order.phone }}</strong>
              </span>
            </div>
          </Card>
          <Card title="操作记录" bordered>
            <div class="order-timeline">
              <div
                v-for="(event, index) in events"
                :key="event.title"
                :class="{ active: index === 0 }"
              >
                <i></i>
                <strong>{{ event.title }}</strong>
                <p>{{ event.description }}</p>
                <small>{{ formatDateTime(event.time) }}</small>
              </div>
            </div>
          </Card>
        </Space>
      </GridItem>
    </Grid>

    <Modal
      v-model="paymentOpen"
      title="登记外部收款结果"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <p>请先确认已在线下或支付平台收款。本操作只更新订单状态，不会发起扣款。</p>
      <FormItem label="收款方式">
        <Input v-model="paymentMethod" placeholder="例如：银行转账" />
      </FormItem>
      <template #footer>
        <Button :disabled="saving" @click="paymentOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="savePayment">确认已收款并登记</Button>
      </template>
    </Modal>
    <Drawer
      v-model="shippingOpen"
      title="订单发货"
      :width="500"
      :closable="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <template #footer>
        <Button :disabled="saving" @click="shippingOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="submitShipping">确认提交</Button>
      </template>
      <Form layout="vertical">
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="物流公司">
              <Select v-model="shippingForm.company" block :options="shippingCompanies" />
            </FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="物流单号">
              <Input v-model="shippingForm.trackingNo" clearable placeholder="请输入物流单号" />
            </FormItem>
          </GridItem>
        </Grid>
        <FormItem label="本次发货商品">
          <div class="shipping-products">
            <div v-for="item in shippableItems" :key="item.id">
              <Image
                :src="item.image"
                :width="44"
                :height="44"
                :img-style="{ objectFit: 'cover' }"
              />
              <div>
                <strong>{{ item.name }}</strong>
                <small>待发 {{ item.quantity - (item.shippedQuantity || 0) }} 件</small>
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
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <template #footer>
        <Button :disabled="saving" @click="addressOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="saveAddress">确认提交</Button>
      </template>
      <Form layout="vertical">
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="收货人"><Input v-model="addressForm.contact" /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="联系电话"><Input v-model="addressForm.phone" /></FormItem>
          </GridItem>
        </Grid>
        <FormItem label="详细地址"><TextArea v-model="addressForm.address" :rows="3" /></FormItem>
      </Form>
    </Modal>
    <Modal
      v-model="priceOpen"
      title="调整订单价格"
      :width="420"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <template #footer>
        <Button :disabled="saving" @click="priceOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="savePrice">确认提交</Button>
      </template>
      <Form layout="vertical">
        <FormItem label="优惠金额">
          <Input v-model="priceDiscount" placeholder="0.00" />
        </FormItem>
        <p class="price-preview">
          调整后应付：
          <strong>¥ {{ formatMoney(pricePreview) }}</strong>
        </p>
      </Form>
    </Modal>
    <Modal
      v-model="remarkOpen"
      title="商家备注"
      :width="440"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <template #footer>
        <Button :disabled="saving" @click="remarkOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="saveRemark">确认提交</Button>
      </template>
      <TextArea v-model="merchantRemark" :rows="4" placeholder="仅后台人员可见" />
    </Modal>
    <Modal
      v-model="afterSaleOpen"
      title="发起售后"
      :width="500"
      :show-close="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <template #footer>
        <Button :disabled="saving" @click="afterSaleOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="submitAfterSale">确认提交</Button>
      </template>
      <Form layout="vertical">
        <FormItem label="售后类型">
          <RadioGroup v-model="afterSaleForm.type" :options="afterSaleTypes" />
        </FormItem>
        <FormItem label="售后商品">
          <CheckboxGroup
            v-model="afterSaleForm.itemIds"
            direction="vertical"
            :options="afterSaleItemOptions"
          />
        </FormItem>
        <FormItem label="退款金额">
          <Input v-model="afterSaleForm.amount" placeholder="0.00" />
        </FormItem>
        <FormItem label="售后原因"><TextArea v-model="afterSaleForm.reason" :rows="3" /></FormItem>
      </Form>
    </Modal>
  </div>
  <div v-else class="order-detail-page">
    <PageHeader title="订单详情" description="查看订单状态、客户信息和操作记录。">
      <template #actions>
        <Button :icon="ArrowLeft" @click="router.back()">返回</Button>
      </template>
    </PageHeader>
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="load">重试</Button>
    </p>
    <!-- Same shape as the loaded page: a status band over three panels and two.
         No title or amount is written here, so a frame cannot be mistaken for a reading. -->
    <template v-else>
      <Card bordered class="status-card">
        <Skeleton loading :delay="0" :title-width="35" :rows="2" animated />
      </Card>
      <Grid :cols="{ xs: 1, lg: 12 }" :x-gap="16" :y-gap="16" class="detail-grid">
        <GridItem :span="{ xs: 1, lg: 8 }">
          <Space vertical block :size="16">
            <Card v-for="panel in pendingMainPanels" :key="panel" bordered>
              <Skeleton loading :delay="0" :title-width="40" :rows="4" animated />
            </Card>
          </Space>
        </GridItem>
        <GridItem :span="{ xs: 1, lg: 4 }">
          <Space vertical block :size="16">
            <Card v-for="panel in pendingSidePanels" :key="panel" bordered>
              <Skeleton avatar loading :delay="0" :title-width="40" :rows="4" animated />
            </Card>
          </Space>
        </GridItem>
      </Grid>
    </template>
  </div>
</template>

<script setup lang="ts">
import { PageHeader, message, modal, type IconType } from "kui-vue";
import {
  commerceApi,
  hasFreight,
  type OrderRecord,
  type OrderActions,
} from "@/api/commerce";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { ArrowLeft, CircleCheck, Clock, RotateCcw, Truck } from "kui-icons";
import {
  computed,
  onDeactivated,
  onScopeDispose,
  reactive,
  ref,
  watch,
  type Ref,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import Big from "big.js";
import { usePaneActivate } from "@/composables/use-pane-activate";
import { reportFailure } from "@/utils/report-failure";
import { formatDateTime, formatMoney, shortId } from "@/utils/common";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const allowed = (permission: string) => hasPermission(permission, auth.user?.permissions || []);
const order = ref<OrderRecord>();
const error = ref("");
const saving = ref(false);
/** One frame per panel the loaded page draws: three in the wide column, two in the narrow one. */
const pendingMainPanels = [1, 2, 3];
const pendingSidePanels = [1, 2];
let generation = 0;
let active = true;
async function load() {
  const id = String(route.params.id || "");
  if (!id || !route.path.startsWith("/order/")) return;
  const current = ++generation;
  order.value = undefined;
  error.value = "";
  for (const open of dialogs) open.value = false;
  try {
    const result = await commerceApi.detail(id);
    if (current === generation) order.value = result;
  } catch (reason) {
    if (current === generation)
      error.value = reason instanceof Error ? reason.message : "订单加载失败";
  }
}
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
  refunded: {
    label: "已全额退款",
    description: "外部退款结果已登记。",
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

const currentStatus = computed(() => statusMap[order.value?.status || "pending"]);
const statusLabel = computed(() => currentStatus.value.label);
const statusDescription = computed(() => currentStatus.value.description);
const statusColor = computed(() => currentStatus.value.color);
const statusIcon = computed(() => currentStatus.value.icon);
const stepCurrent = computed(() => currentStatus.value.step);
const stepItems = computed(() => [
  // Both of these are stamps the server sends with seconds and microseconds attached;
  // the step row has room for a minute, and the full value sits in 订单信息 below.
  {
    title: "提交订单",
    description: order.value ? formatDateTime(order.value.createdAt) : undefined,
  },
  {
    title: "登记收款",
    description: order.value?.paymentAt ? formatDateTime(order.value.paymentAt) : undefined,
  },
  // The server returns shipments ordered by `created_at asc`, so the first one is the box that left
  // the warehouse first -- the moment goods went out. A second or third shipment does not move the
  // step back, because the step records when shipping began, not how many parcels there were.
  {
    title: "商品出库",
    description: order.value?.shipments.length
      ? formatDateTime(order.value.shipments[0].createdAt)
      : undefined,
  },
  // No date here on purpose: the order row has no receipt column, so nothing on the server says when
  // the customer signed for the goods. `updatedAt` moves on any edit (a discount, a remark), which
  // would print an unrelated timestamp as if it were the delivery date.
  { title: "确认收货" },
]);
const itemCount = computed(
  () => order.value?.items.reduce((total, item) => total + item.quantity, 0) || 0,
);
const events = computed(() =>
  order.value
    ? [
        ...(order.value.paymentAt
          ? [
              {
                title: "收款结果已登记",
                description: order.value.paymentMethod,
                time: order.value.paymentAt,
              },
            ]
          : []),
        { title: "订单已创建", description: order.value.source, time: order.value.createdAt },
      ]
    : [],
);
const shippingOpen = ref(false),
  addressOpen = ref(false),
  priceOpen = ref(false),
  remarkOpen = ref(false),
  afterSaleOpen = ref(false),
  paymentOpen = ref(false);
const dialogs = [shippingOpen, addressOpen, priceOpen, remarkOpen, afterSaleOpen, paymentOpen];
const paymentMethod = ref("");
const shippingCompanies = ["顺丰速运", "京东物流", "中通快递", "圆通速递"].map((value) => ({
  label: value,
  value,
}));
const shippingForm = reactive({
  company: "顺丰速运",
  trackingNo: "",
  quantities: {} as Record<string, number>,
});
const shippableItems = computed(
  () => order.value?.items.filter((item) => item.shippedQuantity < item.quantity) || [],
);
const openShipping = () => {
  shippingForm.trackingNo = "";
  shippingForm.quantities = Object.fromEntries(
    shippableItems.value.map((item) => [item.id, item.quantity - item.shippedQuantity]),
  );
  shippingOpen.value = true;
};
async function action<K extends keyof OrderActions>(
  name: K,
  payload: OrderActions[K],
  dialog?: Ref<boolean>,
) {
  if (saving.value || !order.value) return;
  const id = order.value.id,
    current = generation;
  saving.value = true;
  try {
    const result = await commerceApi.action(id, name, payload);
    if (current !== generation) return;
    order.value = result;
    if (dialog) dialog.value = false;
    message.success("操作已保存");
  } catch (reason) {
    // The form and the order's own state are left untouched; the API owns transitions.
    reportFailure(reason, "操作失败");
  } finally {
    saving.value = false;
  }
}
const submitShipping = () => {
  if (!shippingForm.company || !shippingForm.trackingNo.trim())
    return message.warning("请填写物流公司和物流单号");
  const entries = Object.entries(shippingForm.quantities);
  if (entries.some(([, quantity]) => !Number.isInteger(quantity) || quantity < 0))
    return message.warning("发货数量须为非负整数");
  const quantities = Object.fromEntries(entries.filter(([, quantity]) => quantity > 0));
  if (!Object.keys(quantities).length) return message.warning("请至少选择一件待发商品");
  return action(
    "ship",
    { company: shippingForm.company, trackingNo: shippingForm.trackingNo.trim(), quantities },
    shippingOpen,
  );
};
const addressForm = reactive({ contact: "", phone: "", address: "" });
const openAddress = () => {
  if (!order.value) return;
  const { contact, phone, address } = order.value;
  Object.assign(addressForm, { contact, phone, address });
  addressOpen.value = true;
};
const saveAddress = () => {
  if (!addressForm.contact.trim() || !addressForm.phone.trim() || !addressForm.address.trim())
    return message.warning("请填写完整收货信息");
  return action("address", { ...addressForm }, addressOpen);
};
const validMoney = (value: string) => /^\d{1,12}(\.\d{1,2})?$/.test(value);
const priceDiscount = ref("0.00");
const pricePreview = computed(() => {
  if (!order.value || !validMoney(priceDiscount.value)) return "—";
  return new Big(order.value.goodsAmount)
    .plus(order.value.freight)
    .minus(priceDiscount.value)
    .toFixed(2);
});
const openPrice = () => {
  priceDiscount.value = order.value!.discount;
  priceOpen.value = true;
};
const savePrice = () => {
  if (!validMoney(priceDiscount.value) || new Big(pricePreview.value).lt(0))
    return message.warning("优惠金额格式不正确或超出订单金额");
  return action("adjust", { discount: priceDiscount.value }, priceOpen);
};
const merchantRemark = ref("");
const openRemark = () => {
  merchantRemark.value = order.value!.merchantRemark;
  remarkOpen.value = true;
};
const saveRemark = () => action("remark", { merchantRemark: merchantRemark.value }, remarkOpen);
const savePayment = () => {
  if (!paymentMethod.value.trim()) return message.warning("请填写实际收款方式");
  return action("payment", { method: paymentMethod.value.trim() }, paymentOpen);
};
const closeOrder = () => {
  const id = order.value?.id;
  modal.confirm({
    title: "关闭订单",
    content: "关闭后客户将无法继续支付，确定继续吗？",
    onOk: () => {
      if (order.value?.id === id) return action("close", undefined);
    },
  });
};
const afterSaleTypes = [
  { label: "仅退款", value: "refund" },
  { label: "退货退款", value: "return_refund" },
];
const afterSaleForm = reactive({
  type: "refund" as "refund" | "return_refund",
  itemIds: [] as string[],
  amount: "0.00",
  reason: "",
});
const afterSaleItemOptions = computed(
  () =>
    order.value?.items.map((item) => ({ label: `${item.name}（${item.sku}）`, value: item.id })) ||
    [],
);
const openAfterSale = () => {
  if (!order.value) return;
  Object.assign(afterSaleForm, {
    type: "refund",
    itemIds: order.value.items.map((item) => item.id),
    amount: new Big(order.value.paidAmount).minus(order.value.refundedAmount).toFixed(2),
    reason: "",
  });
  afterSaleOpen.value = true;
};
const submitAfterSale = async () => {
  if (saving.value || !order.value) return;
  if (
    !afterSaleForm.itemIds.length ||
    !afterSaleForm.reason.trim() ||
    !validMoney(afterSaleForm.amount) ||
    new Big(afterSaleForm.amount).lte(0)
  )
    return message.warning("请选择商品，填写有效退款金额和售后原因");
  const id = order.value.id,
    current = generation;
  saving.value = true;
  try {
    await commerceApi.afterSale({
      orderId: id,
      ...afterSaleForm,
      itemIds: [...afterSaleForm.itemIds],
    });
    if (current !== generation) return;
    afterSaleOpen.value = false;
    message.success("售后申请已创建，等待审核");
  } catch (reason) {
    // The order's fulfillment state is never overwritten by a failed request.
    reportFailure(reason, "售后申请提交失败");
  } finally {
    saving.value = false;
  }
};
watch(
  () => route.params.id,
  () => {
    if (active) void load();
  },
  { immediate: true },
);
usePaneActivate(() => {
  active = true;
  void load();
});

onDeactivated(() => {
  active = false;
  generation++;
});
onScopeDispose(() => {
  generation++;
});
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
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
  background: var(
    --kui-theme-fill-bg,
    var(--kui-control-bg-fill, var(--kui-color-bg-component-overlay))
  );
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
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
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
  box-shadow: 0 0 0 4px
    var(--kui-color-primary-8, color-mix(in srgb, var(--kui-color-primary) 20%, transparent));
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
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
  background: var(
    --kui-theme-fill-bg,
    var(--kui-control-bg-fill, var(--kui-color-bg-component-overlay))
  );
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
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
  background: var(
    --kui-theme-fill-bg,
    var(--kui-control-bg-fill, var(--kui-color-bg-component-overlay))
  );
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

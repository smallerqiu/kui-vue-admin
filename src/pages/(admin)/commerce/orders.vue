<template>
  <div class="pro-list-page">
    <PageHeader title="订单管理" description="查询和跟踪全部交易订单。">
      <template #actions>
        <!-- The list can already answer 后台 orders: this is the entry that puts one there. Drawn only
             for an account `POST /orders` will accept, because a hidden refusal is worse than a
             button that says what it does. -->
        <Button v-if="canCreate" type="primary" :icon="Plus" @click="openCreate">新建订单</Button>
        <Button :icon="Download" :loading="exporting" @click="exportOrders">导出订单</Button>
      </template>
    </PageHeader>
    <Grid :cols="{ xs: 1, sm: 2, xl: 4 }" :x-gap="12" :y-gap="12" class="order-stats">
      <GridItem v-for="card in cards" :key="card.title">
        <StatCard :title="card.title" :items="[card.item]" bordered reverse />
      </GridItem>
      <!-- The four cards are one aggregate read, so until it lands the row is drawn as four empty
           frames: a card that has not been asked yet must not read as somebody counting zero. -->
      <GridItem v-for="slot in pendingCards" :key="`order-stat-pending-${slot}`">
        <Card bordered class="order-stat-pending">
          <Skeleton loading :delay="0" :title-width="35" :rows="2" animated />
        </Card>
      </GridItem>
    </Grid>
    <p v-if="error" role="alert">
      {{ error }}
      <Button @click="reload">重试</Button>
    </p>
    <ListPanel>
      <template #summary>
        <!-- Nothing has been counted while the list is in flight, and a refused read leaves the
             server's sentence above as the only thing this page may claim: the strip waits for an
             answer instead of reading "0 条订单" for a number nobody counted. -->
        <Skeleton v-if="!error" :loading="loading" :delay="0" :title-width="0" :rows="1" style="min-width: 100px" animated>
          {{ total }} 条订单
        </Skeleton>
      </template>
      <template #filters>
        <Input
          v-model="keyword"
          clearable
          placeholder="订单号、客户或商品名称"
          :icon="Search"
          style="width: 200px"
        />
        <Select v-model="status" clearable placeholder="全部状态" :options="statusOptions" />
        <Select
          v-model="paymentMethod"
          clearable
          placeholder="支付方式"
          :options="paymentOptions"
        />
        <Select v-model="source" clearable placeholder="订单来源" :options="sourceOptions" />
        <DatePicker v-model="dateRange" mode="dateRange" placeholder="下单日期（UTC）" />
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
        :data="orders"
        :loading="loading"
        :columns="columns"
        :hidden-column-keys="hiddenColumnKeys"
        row-key="id"
        :scroll="{ x: 1220 }"
      >
        <template #id="{ record }">
          <div class="order-number">
            <button type="button" :title="record.id" @click="openDetail(record)">
              {{ shortId(record.id) }}
            </button>
            <small>{{ formatDateTime(record.createdAt) }}</small>
          </div>
        </template>
        <template #buyer="{ record }">
          <div class="buyer-cell">
            <strong>{{ record.customer }}</strong>
            <span>{{ joinParts(record.contact, record.phone) }}</span>
          </div>
        </template>
        <template #items="{ record }">
          <div class="order-items">
            <div v-for="item in record.items" :key="item.id" class="order-item">
              <Image
                :src="item.image"
                :width="48"
                :height="48"
                :img-style="{ objectFit: 'cover' }"
              />
              <div>
                <strong>{{ item.name }}</strong>
                <small>{{ item.specs }} · {{ item.sku }}</small>
              </div>
              <span>¥{{ formatMoney(item.price) }} × {{ item.quantity }}</span>
            </div>
          </div>
        </template>
        <template #paidAmount="{ record }">
          <div class="amount-cell">
            <strong>¥ {{ formatMoney(record.paidAmount) }}</strong>
            <small>共 {{ itemCount(record) }} 件</small>
          </div>
        </template>
        <template #status="{ value }">
          <Tag :color="statusColor(value)">{{ orderStatusLabel(value) }}</Tag>
        </template>
        <template #action="{ record }">
          <Space compact>
            <Button size="small" theme="plain" :icon="Eye" @click="openDetail(record)">详情</Button>
            <Button
              v-if="record.status === 'pending' && canClose"
              :disabled="busy"
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
      <!-- The strip above the table is where this page states its count, so the pager does not
           repeat it: while the first page is in flight its own total reads "Total 0 items". -->
      <Page v-model:page="page" :page-size="pageSize" :total="total" :show-total="false" :disabled="loading" />
    </ListPanel>

    <Drawer
      v-model="drawerOpen"
      title="新建订单"
      :width="560"
      :closable="!saving"
      :mask-closable="!saving"
      :esc-key="!saving"
    >
      <template #footer>
        <Button :disabled="saving" @click="drawerOpen = false">取消</Button>
        <Button type="primary" :loading="saving" @click="createOrder">保存</Button>
      </template>
      <Form layout="vertical">
        <!-- The buyer is a row this account can read, and the only thing an order's 买家 can be built
             from: `POST /orders` answers 404 for a customer id outside the viewer's data scope. The
             box searches rather than lists because the table is not kept here -- a copy of it could
             never name a customer a colleague added five minutes ago. -->
        <FormItem label="客户">
          <Select
            v-model="draft.customerId"
            block
            clearable
            placeholder="搜索客户、联系人或城市"
            :options="customerOptions"
            :loading="customerLoading"
            :disabled="saving"
            empty-text="没有匹配的客户"
            @search="searchCustomers"
          />
        </FormItem>
        <!-- 联系人 and 联系电话 arrive with the customer but stay editable: one 客户 row can be billed
             to two different people, and the order column stores whoever this box says. -->
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <FormItem label="联系人"><Input v-model="draft.contact" :disabled="saving" /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="联系电话"><Input v-model="draft.phone" :disabled="saving" /></FormItem>
          </GridItem>
        </Grid>
        <FormItem label="收货地址">
          <TextArea v-model="draft.address" :rows="2" :disabled="saving" />
        </FormItem>
        <FormItem label="商品明细">
          <div class="draft-lines">
            <div v-for="(line, index) in lines" :key="index" class="draft-line">
              <div class="draft-line-goods">
                <Select
                  v-model="line.productId"
                  block
                  clearable
                  placeholder="搜索商品名称或 SKU"
                  :options="productOptions(line)"
                  :loading="line.loading"
                  :disabled="saving"
                  empty-text="没有在售的商品"
                  @search="searchProduct(line, $event)"
                />
                <!-- The two figures the server decides with, shown for the row this box just read:
                     库存 is what a refusal is about (409 answers 不足库存 after the whole draft was
                     typed), and 标价 is what the preview below is adding up. -->
                <small v-if="lineMeta(line)" class="draft-line-meta">{{ lineMeta(line) }}</small>
              </div>
              <InputNumber v-model="line.quantity" :min="1" :disabled="saving" suffix="件" />
              <Button
                theme="plain"
                :disabled="saving || lines.length < 2"
                @click="removeLine(index)"
              >
                删除
              </Button>
            </div>
            <Button theme="plain" :icon="Plus" :disabled="saving" @click="addLine">
              添加一件商品
            </Button>
          </div>
        </FormItem>
        <Grid :cols="2" :x-gap="12">
          <GridItem>
            <!-- Both boxes start empty and an empty one is not a zero someone typed: the column's own
                 default is what the server writes, so `保存` sends "0.00" rather than a blank. -->
            <FormItem label="运费"><Input v-model="draft.freight" placeholder="0.00" :disabled="saving" /></FormItem>
          </GridItem>
          <GridItem>
            <FormItem label="优惠"><Input v-model="draft.discount" placeholder="0.00" :disabled="saving" /></FormItem>
          </GridItem>
        </Grid>
        <FormItem label="客户备注"><TextArea v-model="draft.note" :rows="2" :disabled="saving" /></FormItem>
        <dl class="draft-estimate">
          <div>
            <dt>商品金额（预估）</dt>
            <dd>{{ previewMoney(estimate?.goods) }}</dd>
          </div>
          <div>
            <dt>实付金额（预估）</dt>
            <dd>{{ previewMoney(estimate?.paid) }}</dd>
          </div>
        </dl>
        <!-- What the server decides without asking this drawer, said before the save rather than
             discovered in the list after it: the price comes off the product row under a lock, the
             stock goes down by these quantities, and a console order starts at 待付款 with no payment
             recorded and 订单来源 admin. -->
        <p class="draft-fine-print">
          价格与库存按保存时商品行结算；保存后订单为 待付款、来源 admin，收款方式与发货在详情页登记。
        </p>
      </Form>
    </Drawer>
  </div>
</template>

<script setup lang="ts">
import {
  commerceApi,
  isMoneyText,
  orderEstimate,
  orderFieldLimits,
  orderInput,
  orderStatusOptions,
  orderStatusLabel,
  ordersToCsv,
  pickedProduct,
  type DraftLine,
  type OrderFacets,
  type OrderQuery,
  type OrderRecord,
  type OrderSummary,
} from "@/api/commerce";
import { catalogApi, type Customer, type Product } from "@/api/catalog";
import { useResourcePage } from "@/composables/use-resource-page";
import { useAuthStore } from "@/stores/auth";
import { hasPermission } from "@/routers/permissions";
import { Download, Eye, Plus, Search } from "kui-icons";
import { message, modal, PageHeader, type Column, type StatNumberItem } from "kui-vue";
import Big from "big.js";
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import { reportFailure } from "@/utils/report-failure";
import { downloadCsv } from "@/utils/csv";
import { formatDateTime, formatMoney, joinParts, shortId } from "@/utils/common";

const router = useRouter();
const auth = useAuthStore();
const canClose = computed(() => hasPermission("order:close", auth.user?.permissions || []));
const canCreate = computed(() => hasPermission("order:write", auth.user?.permissions || []));
const keyword = ref("");
const status = ref<string>();
const paymentMethod = ref<string>();
const source = ref<string>();
const dateRange = ref<[number, number]>();
const busy = ref(false);
const exporting = ref(false);
// One filter row described once: the page on screen and the exported file are the same question, so
// a file cannot arrive holding rows the dropdowns on screen had just excluded.
const currentQuery = (): OrderQuery => ({
  keyword: keyword.value.trim(),
  status: status.value,
  paymentMethod: paymentMethod.value,
  source: source.value,
  startDate: dateRange.value?.[0] ? dayjs(dateRange.value[0]).format("YYYY-MM-DD") : undefined,
  endDate: dateRange.value?.[1] ? dayjs(dateRange.value[1]).format("YYYY-MM-DD") : undefined,
});
const {
  items: orders,
  total,
  page,
  pageSize,
  loading,
  error,
  reload,
} = useResourcePage<OrderRecord>("/orders", currentQuery);
const summary = ref<OrderSummary>();
// A refused read has to stop the frames too: a skeleton that keeps pretending to wait would say
// the number is on its way when the server already answered "no".
const summaryFailed = ref(false);
const loadSummary = async () => {
  summaryFailed.value = false;
  try {
    summary.value = await commerceApi.summary();
  } catch (reason) {
    // No numbers rather than invented ones: the cards stay off the page and the server's own words
    // say why.
    summaryFailed.value = true;
    reportFailure(reason, "订单统计加载失败");
  }
};
const pendingCards = computed(() => (summary.value || summaryFailed.value ? 0 : 4));
const facets = ref<OrderFacets>();
// The 支付方式 and 订单来源 choices are the values the orders this account can read actually carry.
// Neither column is an enum this app owns -- whoever recorded a payment typed the word -- so a list
// kept here could only ever offer names that happen to match, and a channel written once would be
// unfilterable from the page that shows it.
const loadFacets = async () => {
  try {
    facets.value = await commerceApi.facets();
  } catch (reason) {
    reportFailure(reason, "筛选候选值加载失败");
  }
};
onMounted(() => {
  void loadSummary();
  void loadFacets();
});
const asOptions = (values: string[] | undefined) =>
  (values ?? []).map((value) => ({ label: value, value }));
const paymentOptions = computed(() => asOptions(facets.value?.paymentMethods));
const sourceOptions = computed(() => asOptions(facets.value?.sources));
// One aggregate read, and each card is the row set the list filter of that meaning selects -- the
// 待发货 card is `paid` because that is this status ladder's word for "paid, not shipped yet".
const cards = computed<Array<{ title: string; item: StatNumberItem }>>(() => {
  const data = summary.value;
  if (!data) return [];
  return [
    { title: "今日订单", item: { value: data.today, desc: "全部渠道" } },
    { title: "待付款", item: { value: data.byStatus.pending, desc: "等待客户支付" } },
    { title: "待发货", item: { value: data.byStatus.paid, desc: "需要仓库处理" } },
    {
      title: "退款申请",
      item: {
        value: data.refundRequests ?? 0,
        desc: data.refundRequests === null ? "当前账号无法读取售后" : "需要售后处理",
      },
    },
  ];
});
const columns: Column[] = [
  { title: "订单号", key: "id", width: 210 },
  { title: "买家", key: "buyer", width: 180 },
  { title: "商品明细", key: "items", width: 450 },
  { title: "实付金额", key: "paidAmount", width: 130 },
  { title: "状态", key: "status", width: 100 },
  { title: "操作", key: "action", width: 170, fixed: "right" },
];
const statusOptions = orderStatusOptions;
const hiddenColumnKeys = ref<string[]>([]);
const statusColor = (value: string) =>
  ({ pending: "orange", paid: "blue", shipped: "cyan", completed: "green", refunded: "red" })[
    value
  ] || "gray";
const resetFilters = () => {
  keyword.value = "";
  status.value = undefined;
  paymentMethod.value = undefined;
  source.value = undefined;
  dateRange.value = undefined;
};
const itemCount = (record: OrderRecord) =>
  record.items.reduce((total, item) => total + item.quantity, 0);
const openDetail = (record: OrderRecord) => router.push(`/order/${record.id}`);
const closePendingOrder = (record: OrderRecord) =>
  modal.confirm({
    title: "关闭订单",
    content: `确定关闭订单 ${record.id} 吗？关闭后客户将无法继续支付。`,
    onOk: async () => {
      if (busy.value) return;
      busy.value = true;
      try {
        await commerceApi.action(record.id, "close", undefined);
        message.success("订单已关闭");
        // The closed order leaves both the list and the 待付款 card, so neither keeps a number it
        // has just made false.
        await Promise.all([reload(), loadSummary()]);
      } catch (reason) {
        // The row is re-read only after a success, so the order stays as it was.
        reportFailure(reason, "关闭失败");
      } finally {
        busy.value = false;
      }
    },
  });
// A drawer is opened on a blank sheet, not on the last one: a draft that kept the previous 客户 and
// its lines would file a second order in somebody else's name if the operator forgot to look up.
const emptyDraft = () => ({
  customerId: "",
  contact: "",
  phone: "",
  address: "",
  freight: "",
  discount: "",
  note: "",
});
const newLine = (): DraftLine => ({ productId: "", quantity: 1, rows: [], loading: false });
// What each capped box is called on the screen, so a refusal names the box rather than the column.
const fieldLabel: Record<keyof typeof orderFieldLimits, string> = {
  contact: "联系人",
  phone: "联系电话",
  address: "收货地址",
  note: "客户备注",
};
const drawerOpen = ref(false);
const saving = ref(false);
const draft = reactive(emptyDraft());
const lines = ref<DraftLine[]>([newLine()]);
const customerRows = ref<Customer[]>([]);
const customerLoading = ref(false);
// The keyword each picker last asked for. Both boxes debounce typing themselves, so two requests can
// still come back in the other order, and the late one would replace the rows the fresh one just
// fetched -- with a customer the operator has since typed out of the box.
let customerAsk: string | null = null;
const productAsk = new WeakMap<DraftLine, string>();

// `filterable` is deliberately not set on either picker. That prop filters the option list the box
// already holds, and these boxes hold one page of a server search: a customer found because their
// 城市 matches would disappear from a dropdown whose label repeats only their name, which is a row
// the server returned and the page then hid.
const searchCustomers = async (event?: Event) => {
  const term = event ? (event.target as HTMLInputElement).value.trim() : "";
  customerAsk = term;
  customerLoading.value = true;
  try {
    const page = await catalogApi.searchCustomers(term);
    if (customerAsk !== term) return;
    customerRows.value = page.items;
  } catch (reason) {
    if (customerAsk !== term) return;
    // The refusal is the server's sentence, and the box stays empty because nothing was found is a
    // different answer from nothing could be asked.
    customerRows.value = [];
    reportFailure(reason, "客户搜索失败");
  } finally {
    if (customerAsk === term) customerLoading.value = false;
  }
};
const customerOptions = computed(() =>
  customerRows.value.map((row) => ({
    label: joinParts(row.name, row.city) || row.id,
    value: row.id,
  })),
);
// The two boxes the customer row can answer are filled only while they are still empty, and never
// overwritten: the order's 联系人 is a column of its own, so a second pick must not undo the name the
// operator has already typed for this delivery.
watch(
  () => draft.customerId,
  (id) => {
    const row = customerRows.value.find((customer) => customer.id === id);
    if (!row) return;
    if (!draft.contact.trim()) draft.contact = row.contact;
    if (!draft.phone.trim()) draft.phone = row.phone;
  },
);

const searchProduct = async (line: DraftLine, event?: Event) => {
  const term = event ? (event.target as HTMLInputElement).value.trim() : "";
  productAsk.set(line, term);
  line.loading = true;
  try {
    const page = await catalogApi.searchProducts(term);
    if (productAsk.get(line) !== term) return;
    line.rows = page.items;
  } catch (reason) {
    if (productAsk.get(line) !== term) return;
    line.rows = [];
    reportFailure(reason, "商品搜索失败");
  } finally {
    if (productAsk.get(line) === term) line.loading = false;
  }
};
// Which products the row may name comes from its own last search: the label stays short because the
// box keeps showing it after the choice, and the two figures worth reading are printed under it.
const productOptions = (line: DraftLine) =>
  line.rows.map((row: Product) => ({
    label: joinParts(row.name, row.specs, row.sku) || row.id,
    value: row.id,
  }));
const lineMeta = (line: DraftLine) => {
  const product = pickedProduct(line);
  return product ? `¥${formatMoney(product.price)} · 库存 ${product.stock} 件` : "";
};
const lineProducts = computed(() =>
  lines.value
    .map((line) => ({ product: pickedProduct(line), quantity: line.quantity }))
    .filter((line): line is { product: Product; quantity: number } => line.product !== null),
);
// An empty box is 0.00 and a box holding `12,` is nothing anybody said, so the preview says so too
// rather than adding up a number the operator never typed.
const estimate = computed(() => {
  const freight = draft.freight.trim() || "0.00";
  const discount = draft.discount.trim() || "0.00";
  if (!isMoneyText(freight) || !isMoneyText(discount)) return null;
  return orderEstimate(lines.value, freight, discount);
});
const previewMoney = (value?: string) => (value ? `¥${formatMoney(value)}` : "金额格式有误");
const openCreate = () => {
  Object.assign(draft, emptyDraft());
  lines.value = [newLine()];
  customerRows.value = [];
  customerAsk = null;
  drawerOpen.value = true;
  // Both pickers open on the first twenty rows the server offers rather than on an empty dropdown,
  // because "no data" before anybody has asked is a sentence the page has no right to say.
  void searchCustomers();
  void searchProduct(lines.value[0]);
};
const addLine = () => {
  lines.value.push(newLine());
  // The array's own entry, not the object just made: Vue wraps what a `ref` holds in a reactive
  // proxy, and a search answered against the raw object would fill the rows without the box ever
  // being told they arrived.
  void searchProduct(lines.value[lines.value.length - 1]);
};
const removeLine = (index: number) => {
  lines.value = lines.value.filter((_, position) => position !== index);
};
const createOrder = async () => {
  if (saving.value) return;
  // Checked here because a body this drawer can build is a body the server refuses with "Invalid
  // request" plus a list of field names -- the one sentence that tells an operator nothing about the
  // box they should have filled in.
  if (!draft.customerId.trim()) return message.warning("请选择客户");
  if (!draft.contact.trim() || !draft.phone.trim() || !draft.address.trim())
    return message.warning("请填写联系人、联系电话和收货地址");
  if (lines.value.some((line) => !line.productId)) return message.warning("请为每一行选择商品");
  if (lines.value.some((line) => !pickedProduct(line)))
    return message.warning("所选商品已不在结果里，请重新搜索");
  if (lines.value.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1))
    return message.warning("商品数量须为正整数");
  const ids = lines.value.map((line) => line.productId);
  if (new Set(ids).size !== ids.length)
    return message.warning("同一个商品只能出现在一行，请把数量合并");
  // The four boxes the create schema caps by length, named here because a request past one of them
  // answers "Invalid request" with a list of field names -- a sentence about the form rather than the
  // one box that has to be shortened. `maxlength` on the controls would be worse: pasted text would
  // simply stop existing.
  const over = (Object.keys(orderFieldLimits) as Array<keyof typeof orderFieldLimits>).find(
    (key) => draft[key].trim().length > orderFieldLimits[key],
  );
  if (over) return message.warning(`${fieldLabel[over]}不能超过 ${orderFieldLimits[over]} 字`);
  for (const key of ["freight", "discount"] as const)
    if (draft[key].trim() && !isMoneyText(draft[key]))
      return message.warning("运费与优惠须为非负金额，最多两位小数");
  const { goods } = orderEstimate(lines.value, "0.00", "0.00");
  const charge = new Big(goods).plus(draft.freight.trim() || "0.00");
  if (draft.discount.trim() && new Big(draft.discount.trim()).gt(charge))
    return message.warning("优惠不能超过商品金额加运费");
  saving.value = true;
  try {
    const order = await commerceApi.create(orderInput({ ...draft, lines: lineProducts.value }));
    drawerOpen.value = false;
    // The server's own arithmetic, not the preview above: the price came off the product row it
    // locked, and if the catalogue moved while this drawer was open, the list shows the new number.
    message.success(`订单已创建，实付 ¥${formatMoney(order.paidAmount)}`);
    await Promise.all([reload(), loadSummary()]);
  } catch (reason) {
    // Stock and refusals belong to the server, so the drawer keeps everything typed: the operator
    // needs to see what they asked for in order to change the line the answer names.
    reportFailure(reason, "下单失败");
  } finally {
    saving.value = false;
  }
};
const exportOrders = async () => {
  if (exporting.value) return;
  exporting.value = true;
  try {
    const { rows, truncated } = await commerceApi.allMatching(currentQuery());
    if (!rows.length) {
      message.warning("当前条件下没有订单");
      return;
    }
    downloadCsv(
      ordersToCsv(rows),
      `orders-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    // The list is newest-first, so the rows a capped walk leaves out are always the older ones; the
    // file says which half of the answer it is.
    if (truncated) message.warning(`导出已到 ${rows.length} 条上限，更早的订单不在文件里`);
    else message.success(`已导出 ${rows.length} 条订单`);
  } catch (reason) {
    message.error(reason instanceof Error ? reason.message : "导出失败，请重试");
  } finally {
    exporting.value = false;
  }
};
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
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
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
.draft-lines {
  display: grid;
  gap: 8px;
}
.draft-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px auto;
  gap: 8px;
  align-items: start;
}
.draft-line-goods {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}
.draft-line-meta {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.draft-estimate {
  display: flex;
  gap: 24px;
  margin: 4px 0 0;
  padding: 10px 12px;
  border-radius: var(--kui-control-radius, var(--kui-shape-round, var(--kui-border-radius)));
  background: var(--kui-color-bg-layout);
}
.draft-estimate div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.draft-estimate dt {
  color: var(--kui-color-text-description);
  font-size: 12px;
}
.draft-estimate dd {
  color: var(--kui-color-text-title);
  font-weight: 600;
  margin: 0;
}
.draft-fine-print {
  margin: 10px 0 0;
  color: var(--kui-color-text-description);
  font-size: 12px;
}
</style>

<route lang="yaml">
meta:
  title: "订单管理"
  icon: "ReceiptText"
  order: 1
</route>

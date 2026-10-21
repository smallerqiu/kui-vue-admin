import Big from "big.js";
import request from "@/utils/request";
import { toCsv } from "@/utils/csv";
import type { PageResult } from "./catalog";

export type OrderStatus =
  "pending" | "paid" | "partial_shipped" | "shipped" | "completed" | "closed" | "refunded";
export interface OrderItem {
  id: string;
  name: string;
  sku: string;
  specs: string;
  image: string;
  price: string;
  quantity: number;
  shippedQuantity: number;
}
export interface OrderRecord {
  [key: string]: unknown;
  id: string;
  customer: string;
  customerId: string;
  contact: string;
  phone: string;
  address: string;
  goodsAmount: string;
  freight: string;
  discount: string;
  paidAmount: string;
  refundedAmount: string;
  status: OrderStatus;
  createdAt: string;
  paymentMethod: string;
  paymentAt: string | null;
  source: string;
  note: string;
  merchantRemark: string;
  items: OrderItem[];
  shipments: Array<{
    id: string;
    company: string;
    trackingNo: string;
    createdAt: string;
    items: Array<{ itemId: string; quantity: number }>;
  }>;
}
export interface AfterSaleRecord {
  [key: string]: unknown;
  id: string;
  orderId: string;
  customer: string;
  type: "refund" | "return_refund";
  itemIds: string[];
  amount: string;
  reason: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected" | "refunded";
  reviewNote: string;
  refundReference: string | null;
}
export interface AfterSaleInput {
  orderId: string;
  type: "refund" | "return_refund";
  itemIds: string[];
  amount: string;
  reason: string;
}
export interface OrderActions {
  close: undefined;
  address: { contact: string; phone: string; address: string };
  adjust: { discount: string };
  remark: { merchantRemark: string };
  ship: { company: string; trackingNo: string; quantities: Record<string, number> };
  payment: { method: string };
}
export const orderStatusOptions = [
  { value: "pending", label: "待付款" },
  { value: "paid", label: "待发货" },
  { value: "partial_shipped", label: "部分发货" },
  { value: "shipped", label: "已发货" },
  { value: "completed", label: "已完成" },
  { value: "closed", label: "已关闭" },
  { value: "refunded", label: "已全额退款" },
];
/**
 * The word the list's 状态 tag shows for a code, and the same word the exported file writes under
 * its 状态 column.  Kept here rather than in the page so the two cannot drift into a file whose
 * header says 状态 and whose cells say `paid`; a code this build has not heard of keeps its raw code,
 * because the order really does carry it.
 */
export const orderStatusLabel = (value: string) =>
  orderStatusOptions.find((item) => item.value === value)?.label || value;
/**
 * Whether an order carries freight at all -- the question the detail page's 运费 cell asks before it
 * writes a price.
 *
 * Money arrives as decimal text, and `"0.00"` is a truthy string, so `order.freight ? … : "免运费"`
 * cannot reach the free branch: every order that pays nothing still reads `¥ 0.00` under a label that
 * says it costs something.  The value is compared as a number rather than against the literal
 * `"0.00"`, because the server writes what the column holds -- `0`, `0.0`, `0.00` all mean the same
 * order.  An empty cell counts as no freight charged, not as NaN.
 */
export const hasFreight = (value: string) => !new Big(value || 0).eq(0);
/**
 * The four numbers above the order list.  `today` is the UTC day the rows are stamped with, and the
 * status keys are the same codes the 状态 dropdown filters on -- the 待发货 card reads `paid`
 * because that is this ladder's word for "paid and not shipped yet".  A null `refundRequests` is the
 * server saying this account may not read after-sales, which the card reports instead of counting 0.
 */
export interface OrderSummary {
  today: number;
  byStatus: { pending: number; paid: number };
  refundRequests: number | null;
}
/**
 * The 支付方式 and 订单来源 values that exist in the orders this account may read.  Both are free
 * text the person recording the payment typed, not a code list this app owns, so the only complete
 * dropdown is the one the server builds off the table: a fixed list here could never offer a channel
 * somebody named once, and the row carrying it would be unfilterable from the page that shows it.
 */
export interface OrderFacets {
  paymentMethods: string[];
  sources: string[];
}
/**
 * One filter row, sent both to the page on screen and to the export walk, so neither can answer a
 * different question than the other.  Index-signatured because that is what `useResourcePage` takes:
 * the composable builds a query string from the object's own keys, and `request` drops the empty
 * ones, so a declared-only shape would be a second type the page has to cast its way around.
 */
export interface OrderQuery {
  keyword?: string;
  status?: string;
  paymentMethod?: string;
  source?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}
export interface OrderExport {
  rows: OrderRecord[];
  truncated: boolean;
}
const exportSize = 100;
export const commerceApi = {
  summary: () => request.get<OrderSummary>("/orders/summary"),
  facets: () => request.get<OrderFacets>("/orders/facets"),
  page: (query: OrderQuery, page: number, pageSize: number) =>
    request.get<PageResult<OrderRecord>>("/orders", { ...query, page, pageSize }),
  /**
   * Every order the current filter matches, for 导出订单.  A file holding only the page on screen
   * would be short in a way nobody can see when they open it, so the walk keeps going until the
   * filter's own total is covered and stops at `cap`, because an order table only ever grows.
   * `exportSize` is 100 because that is the largest page the API answers: asking for more would
   * quietly shrink to 100 while the walk counted the rows it asked for.
   */
  allMatching: async (query: OrderQuery, cap = 1000): Promise<OrderExport> => {
    const rows: OrderRecord[] = [];
    let total = Infinity;
    let page = 1;
    while (rows.length < Math.min(total, cap)) {
      const result = await commerceApi.page(query, page, Math.min(exportSize, cap - rows.length));
      total = result.total;
      if (!result.items.length) break;
      rows.push(...result.items);
      page += 1;
    }
    const kept = rows.slice(0, cap);
    return { rows: kept, truncated: kept.length < total };
  },
  detail: (id: string) => request.get<OrderRecord>(`/orders/${encodeURIComponent(id)}`),
  action: <K extends keyof OrderActions>(id: string, action: K, data: OrderActions[K]) =>
    request.post<OrderRecord>(`/orders/${encodeURIComponent(id)}/${action}`, data ?? {}),
  afterSale: (data: AfterSaleInput) => request.post<{ id: string }>("/after-sales", data),
  review: (id: string, approved: boolean, note: string) =>
    request.post<{ ok: boolean }>(`/after-sales/${encodeURIComponent(id)}/review`, {
      approved,
      note,
    }),
  refund: (id: string, reference: string) =>
    request.post<{ ok: boolean }>(`/after-sales/${encodeURIComponent(id)}/refund`, { reference }),
};

/**
 * The order list as a file: the columns the page shows, plus the ones an operator greps a warehouse
 * spreadsheet with (contact, address, what was already refunded, both remarks).
 *
 * Amounts leave here as the flat two-decimal text the API wrote, not as the page shows them: a
 * `1,234.00` cell is re-imported as `1`, so the grouping that belongs on screen is a corruption in a
 * file meant for arithmetic.  The full order id is written rather than the shortened one the cell
 * displays, because the short form is a display choice and the file has to be searchable back to the
 * row.
 */
export function ordersToCsv(rows: OrderRecord[]): string {
  const header = [
    "订单号",
    "下单时间 (UTC)",
    "买家",
    "联系人",
    "联系电话",
    "收货地址",
    "商品明细",
    "件数",
    "商品金额",
    "运费",
    "优惠",
    "实付金额",
    "已退金额",
    "状态",
    "支付方式",
    "支付时间 (UTC)",
    "订单来源",
    "客户备注",
    "商家备注",
  ];
  const body = rows.map((row) => [
    row.id,
    row.createdAt,
    row.customer,
    row.contact,
    row.phone,
    row.address,
    row.items
      .map((item) => `${item.name} ${item.specs} / ${item.sku} ×${item.quantity}`)
      .join("; "),
    row.items.reduce((count, item) => count + item.quantity, 0),
    row.goodsAmount,
    row.freight,
    row.discount,
    row.paidAmount,
    row.refundedAmount,
    // The word the 状态 tag shows, not the code: a file whose header says 状态 and whose cells say
    // `partial_shipped` is the page disagreeing with itself in a document nobody can hover.
    orderStatusLabel(row.status),
    row.paymentMethod,
    row.paymentAt ?? "",
    row.source,
    row.note,
    row.merchantRemark,
  ]);
  return toCsv([header, ...body]);
}

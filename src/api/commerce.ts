import request from "@/utils/request";

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
export const commerceApi = {
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

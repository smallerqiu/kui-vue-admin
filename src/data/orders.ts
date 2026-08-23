import analyticsImage from "@/assets/img/products/analytics.svg";
import collaborationImage from "@/assets/img/products/collaboration.svg";
import deploymentImage from "@/assets/img/products/deployment.svg";
import storageImage from "@/assets/img/products/storage.svg";
import type { TableRecord } from "kui-vue";

export type OrderStatus =
  | "pending"
  | "paid"
  | "partial_shipped"
  | "shipped"
  | "completed"
  | "refund"
  | "closed";

export interface OrderItem {
  id: string;
  name: string;
  sku: string;
  specs: string;
  image: string;
  price: number;
  quantity: number;
  shippedQuantity?: number;
  refundStatus?: string;
}

export interface OrderRecord extends TableRecord {
  id: string;
  buyer: string;
  customer: string;
  contact: string;
  phone: string;
  address: string;
  items: OrderItem[];
  goodsAmount: number;
  freight: number;
  discount: number;
  paidAmount: number;
  status: OrderStatus;
  createdAt: string;
  paymentMethod: string;
  paymentAt?: string;
  source: string;
  note?: string;
  shippingCompany?: string;
  trackingNo?: string;
  merchantRemark?: string;
  shipments?: OrderShipment[];
}

export interface OrderShipment {
  id: string;
  company: string;
  trackingNo: string;
  createdAt: string;
  items: Array<{ itemId: string; quantity: number }>;
}

export type AfterSaleStatus = "pending" | "approved" | "rejected" | "refunded";
export interface AfterSaleRecord extends TableRecord {
  id: string;
  orderId: string;
  type: "refund" | "return_refund";
  customer: string;
  itemIds: string[];
  amount: number;
  reason: string;
  status: AfterSaleStatus;
  createdAt: string;
  reviewer?: string;
  reviewNote?: string;
}

const product = {
  collaboration: {
    name: "企业协作平台专业版",
    sku: "KUI-PRO-YEAR",
    specs: "年度授权 · 50 席位",
    image: collaborationImage,
    price: 12800,
  },
  analytics: {
    name: "数据分析服务年度版",
    sku: "DATA-PRO-YEAR",
    specs: "专业版 · 1 个工作区",
    image: analyticsImage,
    price: 28600,
  },
  storage: {
    name: "团队空间扩容包",
    sku: "SPACE-500G",
    specs: "500GB · 有效期 1 年",
    image: storageImage,
    price: 2399,
  },
  deployment: {
    name: "私有化部署服务",
    sku: "PRIVATE-DEPLOY",
    specs: "标准实施 · 单环境",
    image: deploymentImage,
    price: 68000,
  },
};

const item = (
  id: string,
  data: (typeof product)[keyof typeof product],
  quantity = 1,
): OrderItem => ({ id, ...data, quantity });

export const orders: OrderRecord[] = [
  {
    id: "K202608230018",
    buyer: "采购员 A",
    customer: "星河云科（示例）",
    contact: "示例联系人 A",
    phone: "000 **** 0001",
    address: "浙江省杭州市演示区示例路 100 号",
    items: [
      item("I101", product.collaboration),
      item("I102", product.storage, 2),
    ],
    goodsAmount: 17598,
    freight: 0,
    discount: 798,
    paidAmount: 16800,
    status: "paid",
    createdAt: "2026-08-23 10:26:08",
    paymentMethod: "企业网银",
    paymentAt: "2026-08-23 10:28:16",
    source: "官方网站",
    note: "工作日送达，发票随货寄出。",
  },
  {
    id: "K202608230017",
    buyer: "采购员 B",
    customer: "像素工场（示例）",
    contact: "示例联系人 B",
    phone: "000 **** 0002",
    address: "上海市演示区示例路 200 号",
    items: [item("I103", product.storage)],
    goodsAmount: 2399,
    freight: 0,
    discount: 0,
    paidAmount: 2399,
    status: "pending",
    createdAt: "2026-08-23 10:08:42",
    paymentMethod: "支付宝",
    source: "移动端",
  },
  {
    id: "K202608230016",
    buyer: "采购员 C",
    customer: "青屿网络（示例）",
    contact: "示例联系人 C",
    phone: "000 **** 0003",
    address: "四川省成都市演示区示例路 300 号",
    items: [item("I104", product.analytics), item("I105", product.storage)],
    goodsAmount: 30999,
    freight: 0,
    discount: 999,
    paidAmount: 30000,
    status: "shipped",
    createdAt: "2026-08-23 09:35:20",
    paymentMethod: "微信支付",
    paymentAt: "2026-08-23 09:37:02",
    source: "官方网站",
    shippingCompany: "顺丰速运",
    trackingNo: "DEMO-SF-0001",
  },
  {
    id: "K202608220096",
    buyer: "采购员 D",
    customer: "云岚智能（示例）",
    contact: "示例联系人 D",
    phone: "000 **** 0004",
    address: "广东省深圳市演示区示例园 4 栋",
    items: [item("I106", product.deployment)],
    goodsAmount: 68000,
    freight: 0,
    discount: 0,
    paidAmount: 68000,
    status: "refund",
    createdAt: "2026-08-22 17:42:11",
    paymentMethod: "企业网银",
    paymentAt: "2026-08-22 17:45:36",
    source: "销售代客下单",
  },
  {
    id: "K202608220095",
    buyer: "采购员 E",
    customer: "光点传媒（示例）",
    contact: "示例联系人 E",
    phone: "000 **** 0005",
    address: "湖北省武汉市演示区示例路 500 号",
    items: [
      item("I107", product.collaboration),
      item("I108", product.analytics),
      item("I109", product.storage, 3),
    ],
    goodsAmount: 48697,
    freight: 0,
    discount: 2697,
    paidAmount: 46000,
    status: "completed",
    createdAt: "2026-08-22 16:19:03",
    paymentMethod: "企业网银",
    paymentAt: "2026-08-22 16:22:10",
    source: "官方网站",
    shippingCompany: "顺丰速运",
    trackingNo: "DEMO-SF-0002",
  },
];

export const orderStatusOptions = [
  { label: "待付款", value: "pending" },
  { label: "待发货", value: "paid" },
  { label: "已发货", value: "shipped" },
  { label: "部分发货", value: "partial_shipped" },
  { label: "已完成", value: "completed" },
  { label: "退款中", value: "refund" },
  { label: "已关闭", value: "closed" },
];

export const initialAfterSales: AfterSaleRecord[] = [
  {
    id: "AS20260823001",
    orderId: "K202608220096",
    type: "refund",
    customer: "云岚智能（示例）",
    itemIds: ["I106"],
    amount: 68000,
    reason: "项目计划调整，申请取消部署服务",
    status: "pending",
    createdAt: "2026-08-23 09:16",
  },
  {
    id: "AS20260822008",
    orderId: "K202608220095",
    type: "return_refund",
    customer: "光点传媒（示例）",
    itemIds: ["I109"],
    amount: 2399,
    reason: "扩容规格购买错误",
    status: "approved",
    createdAt: "2026-08-22 18:40",
    reviewer: "Administrator",
    reviewNote: "同意退回未使用的授权码",
  },
];

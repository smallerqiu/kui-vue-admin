import analyticsImage from "@/assets/img/products/analytics.svg";
import collaborationImage from "@/assets/img/products/collaboration.svg";
import deploymentImage from "@/assets/img/products/deployment.svg";
import storageImage from "@/assets/img/products/storage.svg";
import { utcStamp } from "@/utils/common";
import type { OrderItem, OrderRecord, OrderStatus } from "@/api/commerce";

/**
 * Offline demo orders in the shape the API returns: decimal money as strings,
 * naive UTC ISO timestamps, and the backend's status vocabulary. Demo mode and
 * API mode must feed the same page code, so this file follows the server
 * contract rather than the older display-shaped fixture.
 */

interface Catalog {
  name: string;
  sku: string;
  specs: string;
  image: string;
  price: string;
}

const catalog = {
  collaboration: {
    name: "企业协作平台专业版",
    sku: "KUI-PRO-YEAR",
    specs: "年度授权 · 50 席位",
    image: collaborationImage,
    price: "12800.00",
  },
  analytics: {
    name: "数据分析服务年度版",
    sku: "DATA-PRO-YEAR",
    specs: "专业版 · 1 个工作区",
    image: analyticsImage,
    price: "28600.00",
  },
  storage: {
    name: "团队空间扩容包",
    sku: "SPACE-500G",
    specs: "500GB · 有效期 1 年",
    image: storageImage,
    price: "2399.00",
  },
  deployment: {
    name: "私有化部署服务",
    sku: "PRIVATE-DEPLOY",
    specs: "标准实施 · 单环境",
    image: deploymentImage,
    price: "68000.00",
  },
} satisfies Record<string, Catalog>;

type CatalogKey = keyof typeof catalog;

// Relative to the day the demo set loads, so the trend always has data in
// every range; the API returns absolute rows for the same fields.
const day0 = new Date();
const utcDay = (daysAgo: number, clock = "09:20:00") => {
  const base = new Date(Date.UTC(day0.getUTCFullYear(), day0.getUTCMonth(), day0.getUTCDate()));
  base.setUTCDate(base.getUTCDate() - daysAgo);
  return `${base.toISOString().slice(0, 10)}T${clock}`;
};
// A rolling window ends at "now", so a row dated later than the moment the demo
// set loaded would fall outside it and silently vanish from today's buckets.
const minutesAgo = (minutes: number) => utcStamp(new Date(day0.getTime() - minutes * 60_000));

interface Spec {
  id: string;
  customer: string;
  contact: string;
  phone: string;
  address: string;
  lines: Array<[CatalogKey, number]>;
  discount: string;
  status: OrderStatus;
  daysAgo: number;
  source: string;
  paymentMethod: string;
  refunded?: string;
  note?: string;
}

const specs: Spec[] = [
  {
    id: "K20260001",
    customer: "星河云科（示例）",
    contact: "示例联系人 A",
    phone: "000 **** 0001",
    address: "浙江省杭州市演示区示例路 100 号",
    lines: [["collaboration", 1], ["storage", 2]],
    discount: "798.00",
    status: "paid",
    daysAgo: 0,
    source: "官方网站",
    paymentMethod: "企业网银",
  },
  {
    id: "K20260002",
    customer: "像素工场（示例）",
    contact: "示例联系人 B",
    phone: "000 **** 0002",
    address: "上海市演示区示例路 200 号",
    lines: [["storage", 1]],
    discount: "0.00",
    status: "pending",
    daysAgo: 0,
    source: "小程序",
    paymentMethod: "",
  },
  {
    id: "K20260003",
    customer: "青屿网络（示例）",
    contact: "示例联系人 C",
    phone: "000 **** 0003",
    address: "四川省成都市演示区示例路 300 号",
    lines: [["analytics", 1], ["storage", 1]],
    discount: "999.00",
    status: "shipped",
    daysAgo: 1,
    source: "官方网站",
    paymentMethod: "微信支付",
  },
  {
    id: "K20260004",
    customer: "云岚智能（示例）",
    contact: "示例联系人 D",
    phone: "000 **** 0004",
    address: "广东省深圳市演示区示例园 4 栋",
    lines: [["deployment", 1]],
    discount: "0.00",
    status: "completed",
    daysAgo: 2,
    source: "合作渠道",
    paymentMethod: "对公转账",
  },
  {
    id: "K20260005",
    customer: "白帆数据（示例）",
    contact: "示例联系人 E",
    phone: "000 **** 0005",
    address: "江苏省南京市演示区示例街 5 号",
    lines: [["collaboration", 2]],
    discount: "1600.00",
    status: "refunded",
    daysAgo: 3,
    source: "线下",
    paymentMethod: "企业网银",
    refunded: "24000.00",
  },
  {
    id: "K20260006",
    customer: "星河云科（示例）",
    contact: "示例联系人 A",
    phone: "000 **** 0001",
    address: "浙江省杭州市演示区示例路 100 号",
    lines: [["analytics", 1]],
    discount: "0.00",
    status: "paid",
    daysAgo: 4,
    source: "官方网站",
    paymentMethod: "支付宝",
  },
  {
    id: "K20260007",
    customer: "拾光科技（示例）",
    contact: "示例联系人 F",
    phone: "000 **** 0006",
    address: "湖北省武汉市演示区示例大道 6 号",
    lines: [["storage", 3]],
    discount: "0.00",
    status: "closed",
    daysAgo: 5,
    source: "小程序",
    paymentMethod: "",
  },
  {
    id: "K20260008",
    customer: "青屿网络（示例）",
    contact: "示例联系人 C",
    phone: "000 **** 0003",
    address: "四川省成都市演示区示例路 300 号",
    lines: [["collaboration", 1]],
    discount: "0.00",
    status: "partial_shipped",
    daysAgo: 6,
    source: "合作渠道",
    paymentMethod: "微信支付",
  },
  {
    id: "K20260009",
    customer: "远山设计（示例）",
    contact: "示例联系人 G",
    phone: "000 **** 0007",
    address: "福建省厦门市演示区示例路 7 号",
    lines: [["analytics", 2]],
    discount: "2000.00",
    status: "completed",
    daysAgo: 7,
    source: "官方网站",
    paymentMethod: "对公转账",
  },
  {
    id: "K20260010",
    customer: "白帆数据（示例）",
    contact: "示例联系人 E",
    phone: "000 **** 0005",
    address: "江苏省南京市演示区示例街 5 号",
    lines: [["deployment", 1]],
    discount: "0.00",
    status: "paid",
    daysAgo: 9,
    source: "线下",
    paymentMethod: "企业网银",
  },
  {
    id: "K20260011",
    customer: "像素工场（示例）",
    contact: "示例联系人 B",
    phone: "000 **** 0002",
    address: "上海市演示区示例路 200 号",
    lines: [["storage", 5]],
    discount: "500.00",
    status: "completed",
    daysAgo: 11,
    source: "小程序",
    paymentMethod: "支付宝",
  },
  {
    id: "K20260012",
    customer: "云岚智能（示例）",
    contact: "示例联系人 D",
    phone: "000 **** 0004",
    address: "广东省深圳市演示区示例园 4 栋",
    lines: [["collaboration", 1], ["analytics", 1]],
    discount: "1400.00",
    status: "refunded",
    daysAgo: 14,
    source: "官方网站",
    paymentMethod: "微信支付",
    refunded: "40000.00",
  },
  {
    id: "K20260013",
    customer: "拾光科技（示例）",
    contact: "示例联系人 F",
    phone: "000 **** 0006",
    address: "湖北省武汉市演示区示例大道 6 号",
    lines: [["storage", 2]],
    discount: "0.00",
    status: "completed",
    daysAgo: 18,
    source: "合作渠道",
    paymentMethod: "对公转账",
  },
  {
    id: "K20260014",
    customer: "远山设计（示例）",
    contact: "示例联系人 G",
    phone: "000 **** 0007",
    address: "福建省厦门市演示区示例路 7 号",
    lines: [["analytics", 1]],
    discount: "0.00",
    status: "pending",
    daysAgo: 23,
    source: "线下",
    paymentMethod: "",
  },
  {
    id: "K20260015",
    customer: "星河云科（示例）",
    contact: "示例联系人 A",
    phone: "000 **** 0001",
    address: "浙江省杭州市演示区示例路 100 号",
    lines: [["deployment", 2]],
    discount: "6000.00",
    status: "completed",
    daysAgo: 27,
    source: "官方网站",
    paymentMethod: "企业网银",
  },
  {
    id: "K20260016",
    customer: "白帆数据（示例）",
    contact: "示例联系人 E",
    phone: "000 **** 0005",
    address: "江苏省南京市演示区示例街 5 号",
    lines: [["collaboration", 3]],
    discount: "2400.00",
    status: "shipped",
    daysAgo: 34,
    source: "小程序",
    paymentMethod: "支付宝",
  },
  {
    id: "K20260017",
    customer: "青屿网络（示例）",
    contact: "示例联系人 C",
    phone: "000 **** 0003",
    address: "四川省成都市演示区示例路 300 号",
    lines: [["storage", 8]],
    discount: "0.00",
    status: "completed",
    daysAgo: 41,
    source: "合作渠道",
    paymentMethod: "对公转账",
  },
  {
    id: "K20260018",
    customer: "云岚智能（示例）",
    contact: "示例联系人 D",
    phone: "000 **** 0004",
    address: "广东省深圳市演示区示例园 4 栋",
    lines: [["analytics", 3]],
    discount: "3000.00",
    status: "closed",
    daysAgo: 58,
    source: "线下",
    paymentMethod: "",
  },
];

const money = (value: number) => value.toFixed(2);

export const demoOrders: OrderRecord[] = specs.map((spec, index) => {
  const items: OrderItem[] = spec.lines.map(([key, quantity], line) => ({
    id: `I${index + 1}${line + 1}`,
    ...catalog[key],
    quantity,
    shippedQuantity: ["shipped", "completed"].includes(spec.status) ? quantity : 0,
  }));
  const goodsAmount = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
  const paid = money(goodsAmount - Number(spec.discount));
  const createdAt =
    spec.daysAgo === 0 ? minutesAgo(10 + index * 7) : utcDay(spec.daysAgo, `0${(index % 9) + 1}:2${index % 6}:10`);
  const settled = !["pending", "closed"].includes(spec.status);
  return {
    id: spec.id,
    customerId: `C${String(1001 + (index % 6))}`,
    customer: spec.customer,
    contact: spec.contact,
    phone: spec.phone,
    address: spec.address,
    goodsAmount: money(goodsAmount),
    freight: "0.00",
    discount: spec.discount,
    paidAmount: paid,
    refundedAmount: spec.refunded ?? "0.00",
    status: spec.status,
    createdAt,
    paymentMethod: spec.paymentMethod,
    paymentAt: settled ? createdAt : null,
    source: spec.source,
    note: spec.note ?? "演示订单，不对应真实交易。",
    merchantRemark: "",
    items,
    shipments: [],
  };
});

export const demoOrderStatuses: OrderStatus[] = [
  "pending",
  "paid",
  "partial_shipped",
  "shipped",
  "completed",
  "closed",
  "refunded",
];

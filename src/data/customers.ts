export type CustomerLevel = "strategic" | "enterprise" | "growth";
export type CustomerStatus = "active" | "follow" | "risk";

export interface CustomerRecord {
  id: string;
  name: string;
  industry: string;
  level: CustomerLevel;
  status: CustomerStatus;
  owner: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  annualValue: number;
  orders: number;
  lastContact: string;
  color: string;
}

export const customers: CustomerRecord[] = [
  {
    id: "C1001",
    name: "星河云科（示例）",
    industry: "企业服务",
    level: "strategic",
    status: "active",
    owner: "林晓",
    contact: "示例联系人 A",
    phone: "000 **** 0001",
    email: "customer-a@example.com",
    city: "杭州",
    annualValue: 286000,
    orders: 18,
    lastContact: "今天 10:42",
    color: "#3a95ff",
  },
  {
    id: "C1002",
    name: "云岚智能（示例）",
    industry: "人工智能",
    level: "enterprise",
    status: "follow",
    owner: "周宁",
    contact: "示例联系人 D",
    phone: "000 **** 0004",
    email: "customer-d@example.com",
    city: "深圳",
    annualValue: 168000,
    orders: 9,
    lastContact: "昨天 16:18",
    color: "#7b61ff",
  },
  {
    id: "C1003",
    name: "青屿网络（示例）",
    industry: "互联网",
    level: "enterprise",
    status: "active",
    owner: "王一",
    contact: "示例联系人 C",
    phone: "000 **** 0003",
    email: "customer-c@example.com",
    city: "成都",
    annualValue: 126000,
    orders: 12,
    lastContact: "8 月 21 日",
    color: "#22a06b",
  },
  {
    id: "C1004",
    name: "像素工场（示例）",
    industry: "创意设计",
    level: "growth",
    status: "risk",
    owner: "陈默",
    contact: "示例联系人 B",
    phone: "000 **** 0002",
    email: "customer-b@example.com",
    city: "上海",
    annualValue: 58000,
    orders: 5,
    lastContact: "8 月 16 日",
    color: "#f59e0b",
  },
  {
    id: "C1005",
    name: "光点传媒（示例）",
    industry: "文化传媒",
    level: "growth",
    status: "follow",
    owner: "林晓",
    contact: "示例联系人 E",
    phone: "000 **** 0005",
    email: "customer-e@example.com",
    city: "武汉",
    annualValue: 76000,
    orders: 7,
    lastContact: "8 月 18 日",
    color: "#ef6c77",
  },
];

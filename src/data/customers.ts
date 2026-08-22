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
  { id: "C1001", name: "杭州云帆科技", industry: "企业服务", level: "strategic", status: "active", owner: "林晓", contact: "张经理", phone: "138 **** 6682", email: "service@yunfan.example", city: "杭州", annualValue: 286000, orders: 18, lastContact: "今天 10:42", color: "#3a95ff" },
  { id: "C1002", name: "深圳海洲智能", industry: "人工智能", level: "enterprise", status: "follow", owner: "周宁", contact: "李总", phone: "136 **** 2851", email: "li@haizhou.example", city: "深圳", annualValue: 168000, orders: 9, lastContact: "昨天 16:18", color: "#7b61ff" },
  { id: "C1003", name: "成都木棉网络", industry: "互联网", level: "enterprise", status: "active", owner: "王一", contact: "何女士", phone: "189 **** 1026", email: "he@mumian.example", city: "成都", annualValue: 126000, orders: 12, lastContact: "8 月 21 日", color: "#22a06b" },
  { id: "C1004", name: "上海简墨设计", industry: "创意设计", level: "growth", status: "risk", owner: "陈默", contact: "陆先生", phone: "135 **** 9330", email: "lu@jianmo.example", city: "上海", annualValue: 58000, orders: 5, lastContact: "8 月 16 日", color: "#f59e0b" },
  { id: "C1005", name: "武汉星点传媒", industry: "文化传媒", level: "growth", status: "follow", owner: "林晓", contact: "宋女士", phone: "137 **** 4028", email: "song@xingdian.example", city: "武汉", annualValue: 76000, orders: 7, lastContact: "8 月 18 日", color: "#ef6c77" },
];

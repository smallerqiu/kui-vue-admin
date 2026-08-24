import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

export type NotificationType = "order" | "system" | "task" | "security";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  time: string;
  read: boolean;
  link?: string;
}

const initialNotifications: NotificationItem[] = [
  {
    id: "N1001",
    type: "order",
    title: "新订单待处理",
    content: "订单 K202608230018 已完成支付，请及时安排发货。",
    time: "5 分钟前",
    read: false,
    link: "/commerce/orders",
  },
  {
    id: "N1002",
    type: "security",
    title: "异常登录提醒",
    content: "检测到来自新设备的登录行为，请确认是否为本人操作。",
    time: "28 分钟前",
    read: false,
    link: "/system/logs",
  },
  {
    id: "N1003",
    type: "task",
    title: "项目即将到期",
    content: "移动端改版项目将在 5 天后到期。",
    time: "1 小时前",
    read: false,
  },
  {
    id: "N1004",
    type: "system",
    title: "系统维护完成",
    content: "数据分析服务已完成例行维护，全部功能恢复正常。",
    time: "昨天 22:18",
    read: true,
  },
  {
    id: "N1005",
    type: "order",
    title: "退款申请",
    content: "订单 K202608220096 提交了退款申请。",
    time: "昨天 16:42",
    read: true,
    link: "/commerce/after-sales",
  },
];

const readStored = () => {
  try {
    const value = JSON.parse(localStorage.getItem("notifications") || "null");
    return Array.isArray(value)
      ? (value as NotificationItem[])
      : initialNotifications.map((item) => ({ ...item }));
  } catch {
    return initialNotifications.map((item) => ({ ...item }));
  }
};

export const useNotificationStore = defineStore("notifications", () => {
  const items = ref<NotificationItem[]>(readStored());
  const unreadCount = computed(() => items.value.filter((item) => !item.read).length);
  const markRead = (id: string) => {
    const item = items.value.find((notification) => notification.id === id);
    if (item) item.read = true;
  };
  const markAllRead = () =>
    items.value.forEach((item) => {
      item.read = true;
    });
  const remove = (id: string) => {
    items.value = items.value.filter((item) => item.id !== id);
  };
  const clearRead = () => {
    items.value = items.value.filter((item) => !item.read);
  };

  watch(items, (value) => localStorage.setItem("notifications", JSON.stringify(value)), {
    deep: true,
  });
  return { items, unreadCount, markRead, markAllRead, remove, clearRead };
});

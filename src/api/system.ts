import request from "@/utils/request";
import type { PageResult } from "./catalog";
export interface SystemSettings {
  organizationName: string;
  shortName: string;
  domain: string;
  timezone: "Asia/Shanghai" | "UTC";
  locale: "zh-CN" | "en-US";
  primaryColor: string;
  layoutMode: "side" | "top" | "mix";
  sessionTimeout: number;
  allowMultiLogin: boolean;
  passwordExpiry: number;
}
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  link: string | null;
}
export interface NotificationPage extends PageResult<NotificationItem> {
  unreadCount: number;
}
export interface Dashboard {
  orders: number;
  customers: number;
  products: number;
  projects: number;
  tasks: number;
  revenue: string;
}
export const systemApi = {
  dashboard: () => request.get<Dashboard>("/dashboard"),
  settings: () => request.get<SystemSettings>("/settings"),
  saveSettings: (value: SystemSettings) =>
    request.put<SystemSettings>("/settings", {
      organizationName: value.organizationName,
      shortName: value.shortName,
      domain: value.domain,
      timezone: value.timezone,
      locale: value.locale,
      primaryColor: value.primaryColor,
      layoutMode: value.layoutMode,
      sessionTimeout: value.sessionTimeout,
      allowMultiLogin: value.allowMultiLogin,
      passwordExpiry: value.passwordExpiry,
    }),
  notifications: (page: number, pageSize = 20) =>
    request.get<NotificationPage>("/notifications", { page, pageSize }),
  markRead: (id: string) => request.post(`/notifications/${encodeURIComponent(id)}/read`),
};
// Backend content is not permission to navigate to an external site or execute a URL.
export function notificationPath(link: string | null): string | undefined {
  return link && /^\/[a-zA-Z0-9/_-]*$/.test(link) && !link.startsWith("//") ? link : undefined;
}

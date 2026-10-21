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
/**
 * One audit row. `moduleName`, `operation`, `module`, `level`, `levelName` and `actorName` are what
 * the server's action dictionary and the account table say about `action` / `actorId` -- none of the
 * six is a value an operator writes, and the page shows no fallback for them: a row whose code the
 * dictionary does not know reads back as 其他 with the raw code, which is the log admitting it.
 *
 * `ip` is the address the write came from, and it is null on every row recorded before the column
 * existed: a log cannot name an address it never saw.
 */
export interface AuditLogRecord {
  // `Table` reads a cell by column key, which is what kui-vue's `TableRecord` (a
  // `Record<string, unknown>`) asks for; every field the page uses is declared under it, so the
  // signature is only what makes the row assignable to the table, not how the page reads it.
  [key: string]: unknown;
  id: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  resourceId: string;
  requestId: string;
  ip: string | null;
  createdAt: string;
  module: string;
  moduleName: string;
  operation: string;
  level: string;
  /** What the server's dictionary calls that level: 信息 / 成功 / 警告 / 异常. */
  levelName: string;
}
export interface AuditLogChoice {
  code: string;
  name: string;
}
export interface AuditLogPage extends PageResult<AuditLogRecord> {
  facets: { modules: AuditLogChoice[]; levels: AuditLogChoice[] };
}
export interface AuditLogQuery {
  keyword?: string;
  level?: string;
  module?: string;
}
export interface AuditLogExport {
  rows: AuditLogRecord[];
  truncated: boolean;
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
// A page of the log is 20 rows; the export walks every page the same filter matches.  100 is what
// the API answers for a page at most, so asking for more would quietly shrink back.
const exportSize = 100;

export const auditLogApi = {
  page: (query: AuditLogQuery, page: number, pageSize: number) =>
    request.get<AuditLogPage>("/audit-logs", { ...query, page, pageSize }),
  /**
   * Every row the current filter matches, for 导出日志.  Exporting only the page on screen would
   * hand over a file whose missing rows are invisible to whoever opens it, so the walk keeps going
   * until the filter's own total is covered -- and stops at `cap`, because an audit table only ever
   * grows.  A file that is shorter than the filter matched says so.
   */
  allMatching: async (query: AuditLogQuery, cap = 1000): Promise<AuditLogExport> => {
    const rows: AuditLogRecord[] = [];
    let total = Infinity;
    let page = 1;
    while (rows.length < Math.min(total, cap)) {
      const result = await auditLogApi.page(query, page, Math.min(exportSize, cap - rows.length));
      total = result.total;
      if (!result.items.length) break;
      rows.push(...result.items);
      page += 1;
    }
    const kept = rows.slice(0, cap);
    return { rows: kept, truncated: kept.length < total };
  },
};

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** The columns the page shows, plus the three ids an operator greps a server log with. */
export function auditLogsToCsv(rows: AuditLogRecord[]): string {
  const header = [
    "时间 (UTC)",
    "操作用户",
    "模块",
    "操作内容",
    "级别",
    "IP 地址",
    "动作码",
    "资源编号",
    "请求编号",
  ];
  const body = rows.map((row) => [
    row.createdAt,
    row.actorName ?? "",
    row.moduleName,
    row.operation,
    // The word the row shows on screen, not the rung's code: a file whose 级别 column reads `info`
    // under a header the page filled with 信息 is the same page disagreeing with itself.
    row.levelName,
    row.ip ?? "",
    row.action,
    row.resourceId,
    row.requestId,
  ]);
  return [header, ...body].map((cells) => cells.map(csvCell).join(",")).join("\r\n");
}
// Backend content is not permission to navigate to an external site or execute a URL.
export function notificationPath(link: string | null): string | undefined {
  return link && /^\/[a-zA-Z0-9/_-]*$/.test(link) && !link.startsWith("//") ? link : undefined;
}

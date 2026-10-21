import request from "@/utils/request";
import { taskPriorityOptions, taskStatusOptions } from "./collaboration";
import type { PageResult } from "./catalog";

export type RecordValue = string | number | boolean | string[] | null;
export type BusinessRecord = { id: string; [key: string]: unknown };
export type FormData = Record<string, RecordValue>;
export interface Field {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "date" | "datetime" | "time" | "password" | "number" | "boolean" | "select";
  initial: RecordValue;
  required?: boolean;
  nullable?: boolean;
  multiple?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  hidden?: boolean;
  options?: { label: string; value: string }[];
  source?: "projects" | "roles" | "departments" | "permissions" | "menus";
}
export interface ResourceDefinition {
  path: string;
  title: string;
  description: string;
  permission: string;
  adminWrite?: boolean;
  deletable?: boolean;
  review?: boolean;
  /** Row action that opens a dedicated page, e.g. project membership. */
  detail?: { label: string; basePath: string };
  /**
   * Columns the server works out for a list row and nobody types -- the name a foreign key points
   * at, how many rows link back. They render beside the editable ones and stay out of the form,
   * so an account list can show 角色 and 部门 instead of a page of 32 character ids.
   */
  derived?: Field[];
  fields: Field[];
}
const choices = (values: Record<string, string>) =>
  Object.entries(values).map(([value, label]) => ({ value, label }));
/**
 * A review resource keeps its state out of the editable fields -- the server moves it,
 * nobody types it -- so without this the table would print the bare enum. Same words as
 * the review dialog's buttons, so a row and the dialog cannot disagree.
 */
export const reviewStatusOptions = choices({
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回",
});
const name = (key = "name", label = "名称"): Field => ({
  key,
  label,
  initial: "",
  required: true,
  maxLength: 200,
});
const description: Field = {
  key: "description",
  label: "说明",
  kind: "textarea",
  initial: "",
  hidden: true,
  maxLength: 10000,
};
const deadline: Field = {
  key: "deadline",
  label: "截止日期",
  kind: "date",
  initial: "",
  required: true,
};
const enabled: Field = { key: "enabled", label: "启用", kind: "boolean", initial: true };
/**
 * One entry of a definition's `derived` list. `initial` is part of the field shape the table
 * renderer shares with the form; a derived value is never typed, so it has none.
 */
const derived = (key: string, label: string, kind?: Field["kind"]): Field => ({
  key,
  label,
  kind,
  initial: null,
});
export const resources: Record<string, ResourceDefinition> = {
  projects: {
    path: "projects",
    title: "项目管理",
    description: "维护项目资料、截止日期和进度。",
    permission: "project",
    deletable: true,
    detail: { label: "成员", basePath: "/project" },
    fields: [
      name(),
      { ...name("code", "项目编码"), maxLength: 80 },
      description,
      deadline,
      { key: "progress", label: "进度 (%)", kind: "number", initial: 0, min: 0, max: 100 },
      {
        key: "status",
        label: "状态",
        kind: "select",
        initial: "planning",
        options: choices({ planning: "规划中", active: "进行中", paused: "暂停", done: "已完成" }),
      },
    ],
  },
  tasks: {
    path: "tasks",
    title: "任务管理",
    description: "维护任务状态、优先级和所属项目。",
    permission: "task",
    deletable: true,
    fields: [
      name("title", "任务名称"),
      {
        key: "projectId",
        label: "所属项目",
        kind: "select",
        initial: null,
        nullable: true,
        source: "projects",
      },
      deadline,
      {
        key: "status",
        label: "状态",
        kind: "select",
        initial: "todo",
        // Shared with the board columns so a card and its row never disagree.
        options: taskStatusOptions,
      },
      {
        key: "priority",
        label: "优先级",
        kind: "select",
        initial: "medium",
        options: taskPriorityOptions,
      },
    ],
  },
  calendar: {
    path: "calendar",
    title: "日程安排",
    description: "日程日期和时间按录入值保存，不自动转换时区。",
    permission: "calendar",
    deletable: true,
    fields: [
      name("title", "日程名称"),
      { key: "date", label: "日期", kind: "date", initial: "", required: true },
      { key: "time", label: "时间", kind: "time", initial: "09:00", required: true },
      {
        key: "category",
        label: "分类",
        kind: "select",
        initial: "meeting",
        options: choices({
          meeting: "会议",
          project: "项目",
          personal: "个人",
          deadline: "截止事项",
        }),
      },
      { key: "location", label: "地点", initial: "", maxLength: 255 },
      { key: "attendees", label: "参与者（文本备注）", initial: "", maxLength: 1000, hidden: true },
      { key: "online", label: "线上活动", kind: "boolean", initial: false },
      description,
    ],
  },
  approvals: {
    path: "approvals",
    title: "审批管理",
    description: "提交申请并查看审核结果；不能审核自己的申请。",
    permission: "approval",
    review: true,
    derived: [
      derived("applicantName", "申请人"),
      derived("departmentName", "部门"),
      derived("createdAt", "申请时间", "datetime"),
    ],
    fields: [
      name("title", "申请标题"),
      {
        key: "type",
        label: "类型",
        kind: "select",
        initial: "expense",
        options: choices({ expense: "报销", purchase: "采购", leave: "请假", contract: "合同" }),
      },
      { key: "amount", label: "金额", initial: "0.00", required: true },
      description,
    ],
  },
  users: {
    path: "users",
    title: "用户管理",
    description: "账号仅可停用，不删除。初始管理员请通过个人中心修改资料和密码。",
    permission: "system:user",
    adminWrite: true,
    derived: [
      derived("departmentName", "部门"),
      derived("roleNames", "角色"),
      derived("lastLoginAt", "最近登录", "datetime"),
    ],
    fields: [
      { ...name("account", "账号"), maxLength: 160 },
      { ...name("fullName", "姓名"), maxLength: 120 },
      { key: "email", label: "邮箱", initial: "", maxLength: 254 },
      { key: "phone", label: "电话", initial: "", maxLength: 32 },
      enabled,
      {
        key: "departmentId",
        label: "部门",
        kind: "select",
        initial: null,
        nullable: true,
        source: "departments",
        hidden: true,
      },
      {
        key: "roleIds",
        label: "角色",
        kind: "select",
        initial: [],
        multiple: true,
        source: "roles",
        hidden: true,
      },
      {
        key: "password",
        label: "密码（新建必填，编辑留空不修改）",
        kind: "password",
        initial: null,
        nullable: true,
        hidden: true,
        maxLength: 128,
      },
    ],
  },
  roles: {
    path: "roles",
    title: "角色管理",
    description: "维护角色权限及数据范围；初始管理员角色不可修改。",
    permission: "system:role",
    adminWrite: true,
    derived: [derived("memberCount", "成员数"), derived("createdAt", "创建时间", "datetime")],
    fields: [
      { ...name("code", "角色编码"), maxLength: 80 },
      { ...name(), maxLength: 120 },
      { ...description, maxLength: 500 },
      enabled,
      {
        key: "dataScope",
        label: "数据范围",
        kind: "select",
        initial: "self",
        options: choices({ self: "本人", department: "本部门", all: "全部" }),
      },
      {
        key: "permissions",
        label: "权限",
        kind: "select",
        initial: [],
        multiple: true,
        source: "permissions",
        hidden: true,
      },
    ],
  },
  menus: {
    path: "menus",
    title: "菜单管理",
    description: "配置已编译页面的导航，不支持远程组件或外部 URL。",
    permission: "system:menu",
    deletable: true,
    fields: [
      { ...name(), maxLength: 120 },
      { ...name("path", "本地路由路径"), maxLength: 255 },
      {
        key: "parentId",
        label: "上级菜单",
        kind: "select",
        initial: null,
        nullable: true,
        source: "menus",
        hidden: true,
      },
      { key: "permissionCode", label: "权限码", initial: null, nullable: true, maxLength: 100 },
      { key: "icon", label: "图标名称", initial: "", maxLength: 80, hidden: true },
      { key: "sortOrder", label: "排序", kind: "number", initial: 0 },
      { key: "visible", label: "显示", kind: "boolean", initial: true },
    ],
  },
};

export function formValue(definition: ResourceDefinition, record?: BusinessRecord): FormData {
  return Object.fromEntries(
    definition.fields.map((field) => {
      const value = field.kind === "password" ? null : (record?.[field.key] ?? field.initial);
      return [
        field.key,
        field.kind === "boolean" ? Boolean(value) : Array.isArray(value) ? [...value] : value,
      ];
    }),
  ) as FormData;
}
export function payload(definition: ResourceDefinition, form: FormData): FormData {
  return Object.fromEntries(
    definition.fields.map((field) => {
      const value = form[field.key];
      return [field.key, field.nullable && (value === "" || value === undefined) ? null : value];
    }),
  );
}
export const workspaceApi = {
  get: (path: string, id: string) =>
    request.get<BusinessRecord>(`/${path}/${encodeURIComponent(id)}`),
  save: (definition: ResourceDefinition, form: FormData, id?: string) =>
    id
      ? request.put<BusinessRecord>(
          `/${definition.path}/${encodeURIComponent(id)}`,
          payload(definition, form),
        )
      : request.post<BusinessRecord>(`/${definition.path}`, payload(definition, form)),
  remove: (path: string, id: string) => request.delete(`/${path}/${encodeURIComponent(id)}`),
  review: (id: string, approved: boolean, note: string) =>
    request.post(`/approvals/${encodeURIComponent(id)}/review`, { approved, note }),
};
export async function referenceOptions(source: NonNullable<Field["source"]>) {
  if (source === "departments" || source === "permissions") {
    const rows = await request.get<{ id?: string; code?: string; name: string }[]>(`/${source}`);
    return rows.map((row) => ({
      label: `${row.name} (${row.code || row.id})`,
      value: (row.code || row.id)!,
    }));
  }
  const rows: BusinessRecord[] = [];
  for (let page = 1; ; page++) {
    const result = await request.get<PageResult<BusinessRecord>>(`/${source}`, {
      page,
      pageSize: 100,
    });
    rows.push(...result.items);
    if (rows.length >= result.total || !result.items.length) break;
  }
  return rows.map((row) => ({ label: `${row.name} (${row.code || row.id})`, value: row.id }));
}

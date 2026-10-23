import request from "@/utils/request";
import type { PageResult } from "./catalog";

/**
 * Mirrors `GET /api/tasks`, `GET|PUT /api/projects/{id}/members`,
 * `POST /api/tasks/{id}/status` and `GET|POST|PUT|DELETE /api/milestones` in
 * kui-admin-api.
 */

export type TaskStatus = "todo" | "doing" | "review" | "done";
export type TaskPriority = "high" | "medium" | "low";

export const taskStatuses: TaskStatus[] = ["todo", "doing", "review", "done"];
export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "待处理",
  doing: "进行中",
  review: "待验收",
  done: "已完成",
};
export const taskStatusColors: Record<TaskStatus, string> = {
  todo: "#87909c",
  doing: "#3a95ff",
  review: "#f59e0b",
  done: "#22a06b",
};
export const taskPriorities: TaskPriority[] = ["high", "medium", "low"];
export const taskPriorityLabels: Record<TaskPriority, { label: string; color: string }> = {
  high: { label: "高", color: "#ef6b73" },
  medium: { label: "中", color: "#f59e0b" },
  low: { label: "低", color: "#3a95ff" },
};

/** Board columns and the resource form read these, so a status label exists once. */
export const taskStatusOptions = taskStatuses.map((value) => ({
  value,
  label: taskStatusLabels[value],
}));
export const taskPriorityOptions = taskPriorities.map((value) => ({
  value,
  label: taskPriorityLabels[value].label,
}));

/** `tasks` table row, camelCased by the server. There is no name for `projectId`. */
export interface TaskRecord {
  id: string;
  title: string;
  projectId: string | null;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  ownerId: string;
  departmentId: string | null;
  createdAt: string;
  /** Kanban rows carry an index signature, like the other record types here. */
  [key: string]: unknown;
}
export interface ProjectPerson {
  userId: string;
  account: string;
  fullName: string;
  email: string;
  departmentId: string | null;
}
/** The owner is a column on the project, not a member row, so it is reported apart. */
export interface ProjectRoster {
  members: ProjectPerson[];
  owner: ProjectPerson | null;
}
export interface TaskBoard {
  tasks: TaskRecord[];
  total: number;
  /** True when the board stopped early; the page has to say so instead of hiding it. */
  truncated: boolean;
}
export type MilestoneStatus = "pending" | "done";

/**
 * `project_milestones` row. `status` is a promise someone struck off by hand: the server
 * neither derives it from `projects.progress` nor records when the promise actually came
 * true, so the page must not imply either.
 */
export interface MilestoneRecord {
  id: string;
  projectId: string;
  title: string;
  /** `YYYY-MM-DD`, a calendar day with no timezone attached. */
  dueDate: string;
  status: MilestoneStatus;
  ownerId: string;
  departmentId: string | null;
  createdAt: string;
  [key: string]: unknown;
}
/** A milestone write is a whole-row write; the server has no partial update for it. */
export interface MilestoneDraft {
  projectId: string;
  title: string;
  dueDate: string;
  status: MilestoneStatus;
}
export interface MilestonePlan {
  milestones: MilestoneRecord[];
  total: number;
  truncated: boolean;
}
export interface PersonOption {
  label: string;
  value: string;
}

/**
 * The board is one request per page and the server caps a page at 100 rows, so a
 * board reads at most this many tasks. Beyond it the page shows the truncated
 * notice rather than pretending a filter covered the whole table.
 */
export const MAX_BOARD_TASKS = 500;

/**
 * A plan is read page by page like the board, and stops at this many rows: one project
 * rarely carries more dated promises than fit here, and past the cap the panel says it
 * stopped rather than presenting a partial plan as the whole one.
 */
export const MAX_PLAN_MILESTONES = 200;

export const collaborationApi = {
  tasks: (keyword: string, page: number, pageSize: number) =>
    request.get<PageResult<TaskRecord>>("/tasks", { keyword, page, pageSize }),
  moveTask: (id: string, status: TaskStatus) =>
    request.post<TaskRecord>(`/tasks/${encodeURIComponent(id)}/status`, { status }),
  roster: (projectId: string) =>
    request.get<ProjectRoster>(`/projects/${encodeURIComponent(projectId)}/members`),
  saveMembers: (projectId: string, userIds: string[]) =>
    request.put<ProjectRoster>(`/projects/${encodeURIComponent(projectId)}/members`, { userIds }),
  milestones: (projectId: string, page: number, pageSize: number) =>
    request.get<PageResult<MilestoneRecord>>("/milestones", { projectId, page, pageSize }),
  createMilestone: (draft: MilestoneDraft) =>
    request.post<MilestoneRecord>("/milestones", draft),
  updateMilestone: (id: string, draft: MilestoneDraft) =>
    request.put<MilestoneRecord>(`/milestones/${encodeURIComponent(id)}`, draft),
  deleteMilestone: (id: string) =>
    request.delete<{ ok: boolean }>(`/milestones/${encodeURIComponent(id)}`),
  people: (page: number, pageSize: number) =>
    request.get<PageResult<{ id: string; account: string; fullName: string; enabled: boolean }>>(
      "/users",
      { page, pageSize },
    ),
};

const personLabel = (row: { fullName: string; account: string }) =>
  `${row.fullName} (${row.account})`;

/** Board data is the whole task set, not one page, so column counts are truthful. */
export async function loadTaskBoard(keyword: string): Promise<TaskBoard> {
  const tasks: TaskRecord[] = [];
  let total = 0;
  for (let page = 1; ; page++) {
    const result = await collaborationApi.tasks(keyword.trim(), page, 100);
    total = result.total;
    tasks.push(...result.items);
    if (!result.items.length || tasks.length >= total || tasks.length >= MAX_BOARD_TASKS) break;
  }
  return { tasks, total, truncated: tasks.length < total };
}

/** Resolves with the status the source actually stored, so the board reconciles. */
export async function moveTaskStatus(id: string, status: TaskStatus): Promise<TaskStatus> {
  return (await collaborationApi.moveTask(id, status)).status;
}

export const loadProjectRoster = (projectId: string) => collaborationApi.roster(projectId);

/** PUT replaces the complete set; an omitted account leaves the project. */
export const saveProjectMembers = (projectId: string, userIds: string[]) =>
  collaborationApi.saveMembers(projectId, userIds);

/**
 * The whole plan of one project, in the order the server named it: rows come back sorted
 * by `dueDate`, so the panel must not re-sort them into creation order.
 */
export async function loadProjectMilestones(projectId: string): Promise<MilestonePlan> {
  const milestones: MilestoneRecord[] = [];
  let total = 0;
  for (let page = 1; ; page++) {
    const result = await collaborationApi.milestones(projectId, page, 100);
    total = result.total;
    milestones.push(...result.items);
    if (
      !result.items.length ||
      milestones.length >= total ||
      milestones.length >= MAX_PLAN_MILESTONES
    )
      break;
  }
  return { milestones, total, truncated: milestones.length < total };
}

/** A milestone write sends the row back whole, because the schema has no partial update. */
export const milestoneDraft = (row: MilestoneRecord): MilestoneDraft => ({
  projectId: row.projectId,
  title: row.title,
  dueDate: row.dueDate,
  status: row.status,
});

/**
 * Overdue is derived at read time and never stored: a promise whose date has passed and
 * nobody has struck off. Nothing in the row says the team is late, only that the date it
 * named is behind the day someone is reading this on.
 */
export const isMilestoneOverdue = (row: MilestoneRecord, today: string) =>
  row.status === "pending" && row.dueDate < today;

/**
 * `YYYY-MM-DD` in the reader's own calendar day. `due_date` is a DATE with no timezone,
 * and the server stamps its UTC clock into `created_at`, so a plan is compared with the
 * day the reader is standing in, not with a UTC boundary that can be eight hours away.
 */
export const localCalendarDay = (at: Date = new Date()) =>
  [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, "0"),
    String(at.getDate()).padStart(2, "0"),
  ].join("-");

/**
 * Project names for the board cards. It needs `project:read`, which a task-only
 * account may not have, so callers catch the 403 and fall back to the raw id.
 *
 * This does not reuse `referenceOptions("projects")` from `./workspace`: the task
 * resource definition imports its status labels from this module, and a reverse
 * import would make the two modules depend on each other.
 */
export async function loadProjectOptions(): Promise<PersonOption[]> {
  const rows: PersonOption[] = [];
  for (let page = 1; ; page++) {
    const result = await request.get<PageResult<{ id: string; code: string; name: string }>>(
      "/projects",
      { page, pageSize: 100 },
    );
    rows.push(
      ...result.items.map((row) => ({ label: `${row.name} (${row.code})`, value: row.id })),
    );
    if (!result.items.length || rows.length >= result.total) break;
  }
  return rows;
}

/**
 * Accounts a member picker may offer. `/api/users` is a system permission, so a
 * project owner without `system:user:read` gets an ApiError(403) and the page
 * falls back to removing the people it can already name.
 */
export async function loadAssignablePeople(): Promise<PersonOption[]> {
  const rows: PersonOption[] = [];
  // Count what the server sent, not what survived the filter, or a page of
  // disabled accounts would make the loop ask for the same page forever.
  let fetched = 0;
  for (let page = 1; ; page++) {
    const result = await collaborationApi.people(page, 100);
    fetched += result.items.length;
    rows.push(
      ...result.items
        .filter((row) => row.enabled)
        .map((row) => ({ label: personLabel(row), value: row.id })),
    );
    if (!result.items.length || fetched >= result.total) break;
  }
  return rows;
}

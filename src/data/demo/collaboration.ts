import { utcStamp } from "@/utils/common";
import type {
  ProjectPerson,
  ProjectRoster,
  TaskBoard,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from "@/api/collaboration";
import { taskStatuses } from "@/api/collaboration";

/**
 * Offline twin of the collaboration endpoints. Rows are shaped like the API
 * output (32 hex identifiers, `YYYY-MM-DD` dates, naive UTC stamps, ids instead
 * of names) because demo mode and API mode share one page implementation.
 *
 * Board drags and membership saves mutate this module in memory, the same way
 * the standalone demo pages used local state before the API existed. A refresh
 * of the browser restarts from the fixture; nothing here pretends to persist.
 */

/** 32 lowercase hex characters, matching the server's `Identifier` pattern. */
const demoId = (table: "project" | "task" | "user", index: number) =>
  (
    { project: "7a20", task: "9f30", user: "4c10" }[table] +
    index.toString(16).padStart(4, "0")
  ).padEnd(32, "0");

const stamp = (iso: string) => utcStamp(new Date(`${iso}T00:00:00Z`));

export interface DemoProject {
  id: string;
  code: string;
  name: string;
  description: string;
  deadline: string;
  progress: number;
  status: "planning" | "active" | "paused" | "done";
  ownerId: string;
}

const people: ProjectPerson[] = [
  { account: "chenyi", fullName: "陈一" },
  { account: "linxia", fullName: "林夏" },
  { account: "zhoumu", fullName: "周牧" },
  { account: "songning", fullName: "宋宁" },
  { account: "fangyuan", fullName: "方远" },
  { account: "guyan", fullName: "顾言" },
].map((row, index) => ({
  userId: demoId("user", index + 1),
  account: row.account,
  fullName: row.fullName,
  email: `${row.account}@k-ui.cn`,
  departmentId: null,
}));

export const demoProjects: DemoProject[] = [
  {
    id: demoId("project", 1),
    code: "KUI-PRO",
    name: "KUI Vue Pro",
    description: "跨端管理后台模板，收敛演示数据与真实接口为同一套页面。",
    deadline: "2026-12-18",
    progress: 62,
    status: "active",
    ownerId: people[1]!.userId,
  },
  {
    id: demoId("project", 2),
    code: "CDP",
    name: "客户数据平台",
    description: "客户画像与分层，为经营分析提供口径统一的标签。",
    deadline: "2026-11-06",
    progress: 34,
    status: "active",
    ownerId: people[3]!.userId,
  },
  {
    id: demoId("project", 3),
    code: "MOB",
    name: "移动工作台",
    description: "审批与日程的移动端口，复用桌面端交互约定。",
    deadline: "2027-01-15",
    progress: 12,
    status: "planning",
    ownerId: people[0]!.userId,
  },
  {
    id: demoId("project", 4),
    code: "SCM",
    name: "供应链协同",
    description: "订单履约与售后联动的内部协同系统。",
    deadline: "2026-09-30",
    progress: 100,
    status: "done",
    ownerId: people[5]!.userId,
  },
];

/** `project` and `owner` are indexes into the tables above, so keep them 0-based. */
interface TaskSeed {
  title: string;
  project: number;
  owner: number;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  created: string;
}

const seeds: TaskSeed[] = [
  { title: "看板拖拽与接口对齐", project: 0, owner: 1, deadline: "2026-10-23", status: "doing", priority: "high", created: "2026-10-08" },
  { title: "项目成员选择器权限降级", project: 0, owner: 2, deadline: "2026-10-27", status: "todo", priority: "high", created: "2026-10-09" },
  { title: "经营分析口径复核", project: 0, owner: 1, deadline: "2026-11-03", status: "review", priority: "medium", created: "2026-10-10" },
  { title: "演示数据换成接口结构", project: 0, owner: 3, deadline: "2026-10-16", status: "done", priority: "medium", created: "2026-09-28" },
  { title: "客户画像字段梳理", project: 1, owner: 4, deadline: "2026-10-29", status: "todo", priority: "medium", created: "2026-10-12" },
  { title: "渠道与支付分片校验", project: 1, owner: 3, deadline: "2026-10-21", status: "doing", priority: "high", created: "2026-10-12" },
  { title: "退款率口径写入文档", project: 1, owner: 4, deadline: "2026-11-10", status: "todo", priority: "low", created: "2026-10-14" },
  { title: "移动端审批列表设计", project: 2, owner: 0, deadline: "2026-11-20", status: "todo", priority: "medium", created: "2026-10-15" },
  { title: "日程月历交互稿", project: 2, owner: 2, deadline: "2026-11-18", status: "doing", priority: "medium", created: "2026-10-15" },
  { title: "离线包体积拆分", project: 2, owner: 1, deadline: "2026-12-02", status: "review", priority: "low", created: "2026-10-16" },
  { title: "履约漏斗回归用例", project: 3, owner: 5, deadline: "2026-09-22", status: "done", priority: "high", created: "2026-09-01" },
  { title: "部门维护接口收尾", project: 3, owner: 5, deadline: "2026-09-26", status: "done", priority: "medium", created: "2026-09-05" },
  { title: "供应链售后工单归档", project: 3, owner: 3, deadline: "2026-10-30", status: "todo", priority: "low", created: "2026-10-17" },
  { title: "接口模式菜单排序核对", project: 0, owner: 2, deadline: "2026-10-19", status: "review", priority: "high", created: "2026-10-11" },
];

const initialTasks = (): TaskRecord[] =>
  seeds.map((seed, index) => ({
    id: demoId("task", index + 1),
    title: seed.title,
    projectId: demoProjects[seed.project]!.id,
    deadline: seed.deadline,
    status: seed.status,
    priority: seed.priority,
    ownerId: people[seed.owner]!.userId,
    departmentId: null,
    createdAt: stamp(seed.created),
  }));

let tasks = initialTasks();

/** Members start as a subset so the roster page has something to edit. */
const initialMembers = () =>
  new Map<string, string[]>([
    [demoProjects[0]!.id, [people[2]!.userId, people[3]!.userId, people[4]!.userId]],
    [demoProjects[1]!.id, [people[4]!.userId, people[5]!.userId]],
    [demoProjects[2]!.id, [people[1]!.userId, people[2]!.userId]],
    [demoProjects[3]!.id, []],
  ]);

let memberIds = initialMembers();

const person = (userId?: string | null) => people.find((row) => row.userId === userId) || null;
const roster = (projectId: string): ProjectRoster => ({
  members: (memberIds.get(projectId) || []).map(person).filter((row): row is ProjectPerson => !!row),
  owner: person(demoProjects.find((row) => row.id === projectId)?.ownerId),
});

/** The board and roster endpoints answer a missing id the way the server does. */
function unknown(): Error {
  return Object.assign(new Error("Record not found"), { status: 404, httpStatus: 404 });
}

export function demoPeople(): ProjectPerson[] {
  return [...people];
}

export function demoTaskBoard(keyword: string): TaskBoard {
  const needle = keyword.trim().toLowerCase();
  const matched = needle
    ? tasks.filter((task) => task.title.toLowerCase().includes(needle))
    : tasks;
  return { tasks: matched.map((task) => ({ ...task })), total: matched.length, truncated: false };
}

/** Column order is the server's `tasks.status` ENUM order, not an array index. */
export function demoMoveTask(id: string, status: TaskStatus): TaskStatus {
  if (!taskStatuses.includes(status)) throw new Error("Unsupported task status");
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0) throw unknown();
  tasks = tasks.map((task, position) => (position === index ? { ...task, status } : task));
  return status;
}

export function demoRoster(projectId: string): ProjectRoster {
  if (!demoProjects.some((project) => project.id === projectId)) throw unknown();
  return roster(projectId);
}

export function demoSaveMembers(projectId: string, userIds: string[]): ProjectRoster {
  if (!demoProjects.some((project) => project.id === projectId)) throw unknown();
  const known = new Set(people.map((row) => row.userId));
  const wanted = [...new Set(userIds)];
  if (wanted.some((id) => !known.has(id)))
    throw new Error("Member list contains an unknown or disabled account");
  memberIds = new Map(memberIds).set(projectId, wanted);
  return roster(projectId);
}

/** Tests reset between demo interactions the way a page reload would. */
export function resetDemoCollaboration() {
  tasks = seeds.map((seed, index) => ({
    id: demoId("task", index + 1),
    title: seed.title,
    projectId: demoProjects[seed.project]!.id,
    deadline: seed.deadline,
    status: seed.status,
    priority: seed.priority,
    ownerId: people[seed.owner]!.userId,
    departmentId: null,
    createdAt: stamp(seed.created),
  }));
  memberIds = new Map([
    [demoProjects[0]!.id, [people[2]!.userId, people[3]!.userId, people[4]!.userId]],
    [demoProjects[1]!.id, [people[3]!.userId, people[4]!.userId]],
    [demoProjects[2]!.id, [people[0]!.userId]],
    [demoProjects[3]!.id, []],
  ]);
}

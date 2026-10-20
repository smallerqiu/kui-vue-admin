import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BOARD_TASKS,
  collaborationApi,
  loadAssignablePeople,
  loadProjectOptions,
  loadTaskBoard,
  moveTaskStatus,
  saveProjectMembers,
  taskPriorityOptions,
  taskStatusOptions,
} from "@/api/collaboration";
import { resources } from "@/api/workspace";
import request from "@/utils/request";
import {
  demoMoveTask,
  demoPeople,
  demoProjects,
  demoRoster,
  demoSaveMembers,
  demoTaskBoard,
  resetDemoCollaboration,
} from "@/data/demo/collaboration";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const put = vi.mocked(request.put);

const page = (items: object[], total: number, page: number, pageSize: number) => ({
  items,
  total,
  page,
  pageSize,
});

describe("task board contract", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
  });

  it("reads every page up to the board cap and reports what it left out", async () => {
    const rows = Array.from({ length: 120 }, (_unused, index) => ({
      id: `t${index}`,
      title: `任务 ${index}`,
      projectId: null,
      deadline: "2026-10-30",
      status: "todo",
      priority: "medium",
      ownerId: "o",
      departmentId: null,
      createdAt: "2026-10-01T00:00:00",
    }));
    get.mockImplementation(((path: string, params: { page: number; pageSize: number }) => {
      expect(path).toBe("/tasks");
      const start = (params.page - 1) * params.pageSize;
      return Promise.resolve(
        page(rows.slice(start, start + params.pageSize), rows.length, params.page, params.pageSize),
      );
    }) as never);
    const board = await loadTaskBoard("  巡检  ");

    expect(get).toHaveBeenCalledWith("/tasks", { keyword: "巡检", page: 1, pageSize: 100 });
    expect(get).toHaveBeenLastCalledWith("/tasks", { keyword: "巡检", page: 2, pageSize: 100 });
    expect(board.tasks).toHaveLength(120);
    expect(board.total).toBe(120);
    expect(board.truncated).toBe(false);
  });

  it("stops at the cap instead of loading an unbounded table", async () => {
    const rows = Array.from({ length: 100 }, (_unused, index) => ({ id: `t${index}` }));
    get.mockResolvedValue(page(rows, 5000, 1, 100) as never);
    const board = await loadTaskBoard("");

    expect(board.tasks).toHaveLength(MAX_BOARD_TASKS);
    expect(board.truncated).toBe(true);
    expect(get).toHaveBeenCalledTimes(MAX_BOARD_TASKS / 100);
  });

  it("posts only the status on a move and returns what the server stored", async () => {
    post.mockResolvedValue({ id: "t1", status: "review" } as never);
    await expect(moveTaskStatus("t 1", "review")).resolves.toBe("review");
    expect(post).toHaveBeenCalledWith("/tasks/t%201/status", { status: "review" });
  });

  it("sends the complete member set the way the replace endpoint expects", async () => {
    put.mockResolvedValue({ members: [], owner: null } as never);
    await saveProjectMembers("p/1", ["a", "b"]);
    expect(put).toHaveBeenCalledWith("/projects/p%2F1/members", { userIds: ["a", "b"] });
  });

  it("offers only enabled accounts and labels them so two names cannot collide", async () => {
    get.mockResolvedValue(
      page(
        [
          { id: "u1", account: "linxia", fullName: "林夏", enabled: true },
          { id: "u2", account: "guyan", fullName: "顾言", enabled: false },
        ],
        2,
        1,
        100,
      ) as never,
    );
    await expect(loadAssignablePeople()).resolves.toEqual([
      { label: "林夏 (linxia)", value: "u1" },
    ]);
    expect(get).toHaveBeenCalledWith("/users", { page: 1, pageSize: 100 });
  });

  it("names projects for the cards from the paged directory", async () => {
    get.mockResolvedValue(page([{ id: "p1", code: "KUI", name: "KUI Pro" }], 1, 1, 100) as never);
    await expect(loadProjectOptions()).resolves.toEqual([
      { label: "KUI Pro (KUI)", value: "p1" },
    ]);
  });

  it("counts pages by what the server sent, not by what the filter kept", async () => {
    // One page of disabled accounts must still stop after the last real page.
    get.mockResolvedValue(
      page([{ id: "u1", account: "a", fullName: "A", enabled: false }], 2, 1, 100) as never,
    );
    await expect(loadAssignablePeople()).resolves.toEqual([]);
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe("board and status labels have one source", () => {
  it("shares the task status vocabulary between the form and the columns", () => {
    expect(taskStatusOptions.map((option) => option.value)).toEqual([
      "todo",
      "doing",
      "review",
      "done",
    ]);
    expect(resources.tasks!.fields.find((field) => field.key === "status")?.options).toBe(
      taskStatusOptions,
    );
    expect(resources.tasks!.fields.find((field) => field.key === "priority")?.options).toBe(
      taskPriorityOptions,
    );
  });

  it("links the projects list to the membership page", () => {
    expect(resources.projects!.detail).toEqual({ label: "成员", basePath: "/project" });
  });
});

describe("demo collaboration source", () => {
  beforeEach(() => resetDemoCollaboration());

  it("hands out copies so a card cannot rewrite the fixture by accident", () => {
    const board = demoTaskBoard("");
    const first = board.tasks[0]!;
    first.status = "done";
    expect(demoTaskBoard("").tasks[0]!.status).not.toBe("done");
  });

  it("moves a task between columns and keeps it there", () => {
    const before = demoTaskBoard("");
    const todo = before.tasks.find((task) => task.status === "todo")!;
    expect(demoMoveTask(todo.id, "doing")).toBe("doing");
    expect(
      demoTaskBoard("")
        .tasks.find((task) => task.id === todo.id)!
        .status,
    ).toBe("doing");
    expect(demoTaskBoard("").total).toBe(before.total);
  });

  it("keeps the search on titles only, like the server keyword filter", () => {
    const all = demoTaskBoard("").tasks;
    const hit = demoTaskBoard("看板");
    expect(hit.tasks.length).toBeGreaterThan(0);
    expect(hit.tasks.length).toBeLessThan(all.length);
    expect(hit.tasks.every((task) => task.title.includes("看板"))).toBe(true);
  });

  it("rejects an unknown card the way an API 404 would", () => {
    expect(() => demoMoveTask("no-such-id", "doing")).toThrowError(/not found/i);
  });

  it("reports the owner apart from the member rows", () => {
    const project = demoProjects[0]!;
    const roster = demoRoster(project.id);
    expect(roster.owner?.userId).toBe(project.ownerId);
    expect(roster.members.length).toBe(3);
    expect(roster.members.map((member) => member.userId)).not.toContain(project.ownerId);
  });

  it("replaces the whole member set and refuses an account nobody knows", () => {
    const project = demoProjects[1]!;
    const wanted = [demoPeople()[0]!.userId, demoPeople()[0]!.userId, demoPeople()[5]!.userId];
    const roster = demoSaveMembers(project.id, wanted);
    expect(roster.members.map((member) => member.userId)).toEqual([
      demoPeople()[0]!.userId,
      demoPeople()[5]!.userId,
    ]);
    expect(() => demoSaveMembers(project.id, ["0".repeat(32)])).toThrowError(
      /unknown or disabled/i,
    );
    expect(demoRoster(project.id).members).toHaveLength(2);
  });

  it("fails on a project the roster endpoint would not know", () => {
    expect(() => demoRoster("0".repeat(32))).toThrowError(/not found/i);
    expect(() => demoSaveMembers("0".repeat(32), [])).toThrowError(/not found/i);
  });
});

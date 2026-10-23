import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BOARD_TASKS,
  collaborationApi,
  isMilestoneOverdue,
  loadAssignablePeople,
  localCalendarDay,
  loadProjectMilestones,
  loadProjectOptions,
  loadTaskBoard,
  milestoneDraft,
  moveTaskStatus,
  saveProjectMembers,
  taskPriorityOptions,
  taskStatusOptions,
  type MilestoneRecord,
} from "@/api/collaboration";
import { resources } from "@/api/workspace";
import request from "@/utils/request";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const put = vi.mocked(request.put);
const del = vi.mocked(request.delete);

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

const milestone = (index: number, dueDate: string, status: "pending" | "done"): MilestoneRecord => ({
  id: `m${index}`,
  projectId: "p1",
  title: `里程碑 ${index}`,
  dueDate,
  status,
  ownerId: "o1",
  departmentId: null,
  createdAt: "2026-10-01T00:00:00",
});

describe("project milestone contract", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    del.mockReset();
  });

  it("filters by project and keeps the due-date order the server named", async () => {
    // Deliberately newest-last on input and shuffled here: the panel must show what came back,
    // so a read that re-sorted by id or by arrival would have to fail this.
    const rows = [milestone(3, "2026-12-02", "pending"), milestone(1, "2026-11-20", "pending"), milestone(2, "2026-10-30", "done")];
    get.mockImplementation(((path: string, params: { projectId: string; page: number; pageSize: number }) => {
      expect(path).toBe("/milestones");
      expect(params).toEqual({ projectId: "p1", page: 1, pageSize: 100 });
      return Promise.resolve(page(rows, rows.length, 1, 100));
    }) as never);

    const plan = await loadProjectMilestones("p1");

    expect(plan.milestones.map((row) => row.id)).toEqual(["m3", "m1", "m2"]);
    expect(plan.total).toBe(3);
    expect(plan.truncated).toBe(false);
  });

  it("keeps reading pages until the plan is complete and says when it stopped", async () => {
    const rows = Array.from({ length: 240 }, (_unused, index) =>
      milestone(index, `2026-${String((index % 12) + 1).padStart(2, "0")}-01`, "pending"),
    );
    get.mockImplementation(((path: string, params: { page: number; pageSize: number }) => {
      const start = (params.page - 1) * params.pageSize;
      return Promise.resolve(page(rows.slice(start, start + params.pageSize), rows.length, params.page, params.pageSize));
    }) as never);

    const plan = await loadProjectMilestones("p1");

    // The cap stops the walk at 200 rows, so the page after it is never asked for.
    expect(get).toHaveBeenCalledTimes(2);
    // The panel has 200 of 240 and must call that a partial plan.
    expect(plan.milestones.length).toBe(200);
    expect(plan.truncated).toBe(true);
  });

  it("writes a milestone whole and reads back what the server stored", async () => {
    const draft = { projectId: "p1", title: "验收", dueDate: "2026-12-01", status: "pending" as const };
    post.mockResolvedValue({ ...milestone(9, "2026-12-01", "pending"), id: "m9" } as never);
    put.mockResolvedValue({ ...draft, id: "m9" } as never);
    del.mockResolvedValue({ ok: true } as never);

    await collaborationApi.createMilestone(draft);
    await collaborationApi.updateMilestone("m 9", milestoneDraft(milestone(9, "2026-12-01", "pending")));
    await collaborationApi.deleteMilestone("m 9");

    expect(post).toHaveBeenCalledWith("/milestones", draft);
    expect(put).toHaveBeenCalledWith(
      "/milestones/m%209",
      milestoneDraft(milestone(9, "2026-12-01", "pending")),
    );
    expect(del).toHaveBeenCalledWith("/milestones/m%209");
  });

  it("derives overdue from the date and the flag, never from a stored field", () => {
    const today = "2026-10-23";
    expect(isMilestoneOverdue(milestone(1, "2026-10-22", "pending"), today)).toBe(true);
    // A day that has passed but was struck off is a kept promise, not a missed one.
    expect(isMilestoneOverdue(milestone(2, "2026-10-22", "done"), today)).toBe(false);
    // Today is still owed: the date named has not gone by yet.
    expect(isMilestoneOverdue(milestone(3, "2026-10-23", "pending"), today)).toBe(false);
    expect(isMilestoneOverdue(milestone(4, "2026-12-01", "pending"), today)).toBe(false);
  });

  it("names the reader's own calendar day for that comparison", () => {
    expect(localCalendarDay(new Date(2026, 9, 23, 23, 30))).toBe("2026-10-23");
    // Midnight and single-digit months stay zero-padded, or the string compare above lies.
    expect(localCalendarDay(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });
});

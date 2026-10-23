import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskBoard from "@/components/business/task-board.vue";
import request from "@/utils/request";
import { message } from "kui-vue";
import { skeletonStub } from "./skeleton-stub";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("kui-vue", () => ({ message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const auth = reactive({ permissions: ["task:read", "task:write"] as string[] });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);

const task = (id: string, status: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `任务 ${id}`,
  projectId: "p1",
  deadline: "2026-12-01",
  status,
  priority: "medium",
  ownerId: "u1",
  departmentId: null,
  createdAt: "2026-10-01T00:00:00",
  ...extra,
});

/** A board with its own rows: the tests that watch column order need a full column to land in. */
function mockTasks(rows: Array<ReturnType<typeof task>>) {
  get.mockImplementation(
    ((path: string) =>
      path === "/tasks"
        ? Promise.resolve({ items: rows, total: rows.length, page: 1, pageSize: 100 })
        : Promise.resolve({
            items: [{ id: "p1", code: "KUI", name: "KUI Pro" }],
            total: 1,
            page: 1,
            pageSize: 100,
          })) as never,
  );
}

/**
 * Kanban is a controlled component, so this stub reproduces the contract the page
 * depends on: it groups `data` by `statusKey` and asks the parent for a move
 * instead of changing anything itself.
 */
const kanbanStub = {
  props: ["columns", "data", "rowKey", "statusKey", "draggable"],
  emits: ["move"],
  setup(props: any, { slots, emit }: { slots: Record<string, (s: any) => any>; emit: any }) {
    return () =>
      h(
        "div",
        { "data-draggable": String(props.draggable) },
        props.columns.map((column: any) => {
          const items = props.data.filter((row: any) => row[props.statusKey] === column.key);
          return h("section", { "data-column": column.key }, [
            slots.columnTitle?.({ column, items }),
            ...items.map((item: any) =>
              h("div", { "data-item": item[props.rowKey], "data-column": column.key }, [
                slots.item?.({ item }),
                h(
                  "button",
                  {
                    "data-move": `to-${column.key}`,
                    onClick: () => emit("move", { item, from: item[props.statusKey], to: "done" }),
                  },
                  "move",
                ),
              ]),
            ),
            ...(!items.length ? [slots.empty?.({ column }) || null] : []),
          ]);
        }),
      );
  },
};

const disposers: Array<() => void> = [];
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(TaskBoard);
  // ListPanel keeps its summary line out of the slot tree, so the stub prints it.
  const passthrough = (props: string[] = []) => ({
    props,
    setup: (_props: Record<string, unknown>, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("div", [String(_props.summary ?? ""), slots.default?.(), slots.filters?.(), slots.actions?.()]),
  });
  for (const name of ["Flex", "Grid", "GridItem", "Space", "Card"]) app.component(name, passthrough());
  app.component("ListPanel", passthrough(["summary"]) as never);
  for (const name of ["Input", "Button", "Empty", "Icon", "Tag", "Alert"])
    app.component(
      name,
      () => null,
    );
  app.component(
    "Select",
    {
      props: ["modelValue", "options"],
      emits: ["update:modelValue"],
      setup: (props: any, { emit }: { emit: any }) =>
        () =>
          h("div", [
            String(props.modelValue ?? ""),
            ...(props.options || []).map((option: any) =>
              h(
                "button",
                {
                  "data-filter": `${option.value}`,
                  onClick: () => emit("update:modelValue", option.value),
                },
                option.label,
              ),
            ),
          ]),
    } as never,
  );
  app.component("Kanban", kanbanStub as never);
  app.component("Skeleton", skeletonStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

describe("task board page", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    auth.permissions = ["task:read", "task:write"];
    vi.clearAllMocks();
    get.mockImplementation(((path: string) =>
      path === "/tasks"
        ? Promise.resolve({
            items: [task("1", "todo"), task("2", "doing"), task("3", "todo")],
            total: 3,
            page: 1,
            pageSize: 100,
          })
        : Promise.resolve({ items: [{ id: "p1", code: "KUI", name: "KUI Pro" }], total: 1, page: 1, pageSize: 100 })) as never);
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
  });

  it("holds the panel with a waiting board while the first read is in flight", async () => {
    let arrive!: (value: unknown) => void;
    get.mockImplementation(
      (() =>
        new Promise((resolve) => {
          arrive = resolve;
        })) as never,
    );
    const root = mount();
    await flush();

    // The filters, the panel and one waiting frame stand in for the columns;
    // the summary stays unnumbered because nothing has been counted yet.
    expect(root.querySelectorAll(".skeleton-line").length).toBe(1);
    expect(root.querySelectorAll("[data-column]").length).toBe(0);
    expect(root.textContent).not.toContain("共 ");
    expect(root.textContent).not.toContain("正在加载");

    arrive({ items: [task("1", "todo")], total: 1, page: 1, pageSize: 100 });
    await flush();
    expect(root.querySelectorAll(".skeleton-line").length).toBe(0);
    expect(root.querySelectorAll("[data-column]").length).toBeGreaterThan(0);
    expect(root.textContent).toContain("共 1 条任务");
  });

  it("groups the loaded tasks under their status columns", async () => {
    const root = mount();
    await flush();

    expect(root.querySelectorAll('[data-column="todo"]').length).toBe(3);
    expect(root.querySelectorAll('[data-item]').length).toBe(3);
    expect(root.textContent).toContain("待处理");
    expect(root.textContent).toContain("KUI Pro (KUI)");
    expect(root.textContent).toContain("共 3 条任务");
  });

  it("asks the server for a move and only then lets the card stay", async () => {
    post.mockResolvedValue(task("1", "done") as never);
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>('[data-item="1"] [data-move="to-todo"]')!.click();
    await flush();

    expect(post).toHaveBeenCalledWith("/tasks/1/status", { status: "done" });
    expect(root.querySelector('[data-item="1"]')!.getAttribute("data-column")).toBe("done");
    expect(message.success).toHaveBeenCalledWith("已移到已完成");
  });

  it("puts the card back when the write is refused", async () => {
    post.mockRejectedValue(new Error("Forbidden"));
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>('[data-item="2"] [data-move="to-doing"]')!.click();
    await flush();
    expect(root.querySelector('[data-item="2"]')!.getAttribute("data-column")).toBe("doing");
    expect(message.success).not.toHaveBeenCalled();
  });

  // The server numbers a card at the tail of the column it lands in (`sort_order` is a per-column
  // sequence), so the board has to move it there too -- a patch that only rewrote the status would
  // leave the card sitting in the middle of the new column until the next 刷新.
  it("drops the card at the bottom of the column it moved into", async () => {
    mockTasks([task("1", "todo"), task("3", "todo"), task("2", "doing"), task("9", "done")]);
    post.mockResolvedValue(task("1", "done") as never);
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>('[data-item="1"] [data-move="to-todo"]')!.click();
    await flush();

    const column = root.querySelector('section[data-column="done"]')!;
    expect(
      [...column.querySelectorAll("[data-item]")].map((node) => node.getAttribute("data-item")),
    ).toEqual(["9", "1"]);
  });

  it("restores the position as well as the status when the move is refused", async () => {
    mockTasks([task("1", "todo"), task("3", "todo"), task("2", "doing"), task("9", "done")]);
    post.mockRejectedValue(new Error("Task belongs to another department"));
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>('[data-item="1"] [data-move="to-todo"]')!.click();
    await flush();

    const read = (key: string) =>
      [...root.querySelectorAll(`section[data-column="${key}"] [data-item]`)].map((node) =>
        node.getAttribute("data-item"),
      );
    expect(read("done")).toEqual(["9"]);
    expect(read("todo")).toEqual(["1", "3"]);
    expect(message.success).not.toHaveBeenCalled();
  });

  it("refuses to drag for an account without the write permission", async () => {
    auth.permissions = ["task:read"];
    const root = mount();
    await flush();

    expect(root.querySelector('[data-draggable]')!.getAttribute("data-draggable")).toBe("false");
    expect(root.textContent).toContain("task:write");
  });

  it("filters the loaded cards by priority without asking the server again", async () => {
    get.mockImplementation(((path: string) =>
      path === "/tasks"
        ? Promise.resolve({
            items: [task("1", "todo", { priority: "high" }), task("2", "doing")],
            total: 2,
            page: 1,
            pageSize: 100,
          })
        : Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 })) as never);
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>('[data-filter="high"]')!.click();
    await flush();

    expect(root.querySelectorAll('[data-item]').length).toBe(1);
    expect(root.textContent).toContain("筛选出 1 条");
    expect(get).toHaveBeenCalledTimes(2);
  });
});

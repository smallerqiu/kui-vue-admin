import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Members from "@/pages/(admin)/project/[id].vue";
import request from "@/utils/request";
import { message } from "kui-vue";
import { skeletonStub } from "./skeleton-stub";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { id: "p1" }, path: "/project/p1" }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (_props: unknown, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("header", [_props.title, slots.default?.(), slots.actions?.()]),
  },
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const auth = reactive({ permissions: [] as string[] });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const put = vi.mocked(request.put);
const del = vi.mocked(request.delete);

const roster = {
  members: [{ userId: "u1", account: "a", fullName: "成员A", email: "a@k-ui.cn", departmentId: null }],
  owner: null,
};
const project = { id: "p1", name: "官网改版", code: "WEB", deadline: "2026-12-18", status: "active" };
const row = (
  id: string,
  dueDate: string,
  status: "pending" | "done",
  title = `里程碑 ${id}`,
) => ({
  id,
  projectId: "p1",
  title,
  dueDate,
  status,
  ownerId: "o1",
  departmentId: null,
  createdAt: "2026-10-01T00:00:00",
});
const plan = (...rows: object[]) => ({ items: rows, total: rows.length, page: 1, pageSize: 100 });

const PLAN_READ = ["milestone:read"];
const PLAN_WRITE = ["milestone:read", "milestone:write"];
const PLAN_ALL = ["milestone:read", "milestone:write", "milestone:delete"];

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
  const app = createApp(Members);
  const passthrough = (props: string[] = []) => ({
    props,
    setup: (_props: Record<string, unknown>, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("div", [_props.title, slots.default?.(), slots.extra?.(), slots.actions?.()]),
  });
  for (const name of [
    "Card",
    "Form",
    "FormItem",
    "Grid",
    "GridItem",
    "Space",
    "Flex",
    "Divider",
    "Icon",
    "Tag",
    "Avatar",
    "TimeLine",
  ])
    app.component(name, passthrough(["title"]));
  // `Empty` carries its sentence in `description`, and that sentence is the claim under test.
  app.component(
    "Empty",
    { props: ["description"], setup: (props: any) => () => h("div", { class: "empty" }, props.description) } as never,
  );
  // The date each item carries is the whole point of the panel, so it renders as text.
  app.component(
    "TimeLineItem",
    {
      props: ["time", "color"],
      setup: (props: any, { slots }: { slots: Record<string, () => unknown> }) => () =>
        h("li", { "data-color": props.color }, [props.time, slots.default?.(), slots.extra?.()]),
    } as never,
  );
  app.component("Skeleton", skeletonStub as never);
  // The alert's sentence is the answer itself, so the stub prints both halves.
  app.component(
    "Alert",
    {
      props: ["title", "description"],
      setup: (props: any) => () => h("div", { class: "alert" }, [props.title, props.description]),
    } as never,
  );
  app.component(
    "Modal",
    {
      props: ["modelValue"],
      setup: (props: any, { slots }: { slots: Record<string, () => unknown> }) => () =>
        props.modelValue ? h("div", { class: "modal" }, [slots.default?.(), slots.footer?.()]) : null,
    } as never,
  );
  app.component(
    "Input",
    {
      props: ["modelValue", "disabled"],
      emits: ["update:modelValue"],
      setup: (props: any, { emit }: { emit: any }) => () =>
        h("input", {
          "data-field": "title",
          value: props.modelValue ?? "",
          disabled: props.disabled,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        }),
    } as never,
  );
  app.component(
    "DatePicker",
    {
      props: ["modelValue", "disabled"],
      emits: ["update:modelValue"],
      setup: (props: any, { emit }: { emit: any }) => () =>
        h("input", {
          "data-field": "due",
          value: props.modelValue ?? "",
          disabled: props.disabled,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        }),
    } as never,
  );
  app.component(
    "Select",
    {
      props: ["modelValue", "options", "disabled", "multiple"],
      emits: ["update:modelValue"],
      setup: (props: any, { emit }: { emit: any }) => () =>
        h("div", [
          String(props.modelValue?.join(",") ?? props.modelValue ?? ""),
          ...(props.options || []).map((option: any) =>
            h(
              "button",
              {
                disabled: props.disabled,
                "data-person": option.value,
                onClick: () =>
                  emit(
                    "update:modelValue",
                    props.modelValue.includes(option.value)
                      ? props.modelValue.filter((value: string) => value !== option.value)
                      : [...props.modelValue, option.value],
                  ),
              },
              option.label,
            ),
          ),
        ]),
    } as never,
  );
  app.component(
    "Button",
    {
      props: ["disabled", "loading"],
      setup: (props: any, { slots }: { slots: Record<string, () => unknown> }) =>
        () => h("button", { disabled: props.disabled || props.loading }, slots.default?.()),
    } as never,
  );
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const buttons = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll("button")].filter((node) => node.textContent?.includes(text));

/** A real keystroke and picker commit, not a prop poked from the outside. */
function fill(root: HTMLElement, field: "title" | "due", value: string) {
  const node = root.querySelector<HTMLInputElement>(`[data-field="${field}"]`)!;
  node.value = value;
  node.dispatchEvent(new Event("input"));
}

/** Today in the same shape the server stores, so the overdue claim is testable at all. */
const shiftDay = (days: number) => {
  const at = new Date();
  at.setDate(at.getDate() + days);
  return [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, "0"),
    String(at.getDate()).padStart(2, "0"),
  ].join("-");
};

describe("project milestone panel", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    del.mockReset();
    auth.permissions = ["project:read", "project:write", ...PLAN_ALL];
    vi.clearAllMocks();
    get.mockImplementation(((path: string) => {
      if (path === "/projects/p1/members") return Promise.resolve(roster);
      if (path === "/projects/p1") return Promise.resolve(project);
      if (path === "/milestones")
        return Promise.resolve(
          plan(row("m2", "2026-11-12", "pending"), row("m1", shiftDay(-3), "pending", "整站改版验收")),
        );
      return Promise.resolve({
        items: [{ id: "u1", account: "a", fullName: "成员A", enabled: true }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
    }) as never);
  });
  afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

  it("holds the plan frame while its own read is in flight", async () => {
    let arrive!: (rows: unknown) => void;
    get.mockImplementation(((path: string) => {
      if (path === "/milestones")
        return new Promise((resolve) => {
          arrive = resolve;
        });
      if (path === "/projects/p1/members") return Promise.resolve(roster);
      if (path === "/projects/p1") return Promise.resolve(project);
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 });
    }) as never);
    const root = mount();
    await flush();

    // The roster landed, so exactly one frame is left standing: the plan's own.
    expect(root.querySelectorAll(".skeleton-line").length).toBe(1);
    expect(root.textContent).not.toContain("整站改版验收");
    // A frame still waiting must not already claim the project has no plan.
    expect(root.textContent).not.toContain("这个项目还没有排过里程碑");

    arrive(plan(row("m1", shiftDay(-3), "pending", "整站改版验收")));
    await flush();
    expect(root.textContent).toContain("整站改版验收");
    expect(root.querySelectorAll(".skeleton-line").length).toBe(0);
  });

  it("shows the plan in the order the server sent it, with its dates", async () => {
    const root = mount();
    await flush();

    const items = [...root.querySelectorAll("li")].map((node) => node.textContent);
    expect(items.length).toBe(2);
    // Arrival order is kept: this is the due-date order the server named, not a re-sort here.
    expect(items[0]).toContain("2026-11-12");
    expect(items[1]).toContain("整站改版验收");
    expect(root.textContent).toContain("未完成");
  });

  it("marks a promise whose date has passed and nobody struck off", async () => {
    get.mockImplementation(((path: string) => {
      if (path === "/milestones")
        return Promise.resolve(
          plan(
            row("m1", shiftDay(-3), "pending", "还没人管的那条"),
            row("m2", shiftDay(-30), "done", "早就兑现的那条"),
            row("m3", shiftDay(5), "pending", "还来得及的那条"),
          ),
        );
      if (path === "/projects/p1/members") return Promise.resolve(roster);
      if (path === "/projects/p1") return Promise.resolve(project);
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 });
    }) as never);
    const root = mount();
    await flush();

    const rows = [...root.querySelectorAll("li")];
    expect(rows[0]!.textContent).toContain("已过期");
    // A kept promise whose date passed is not late, and a future date is not late either.
    expect(rows[1]!.textContent).not.toContain("已过期");
    expect(rows[2]!.textContent).not.toContain("已过期");
    expect(rows[1]!.textContent).toContain("已完成");
  });

  it("says the plan is unreadable instead of showing an empty one", async () => {
    auth.permissions = ["project:read", "project:write"];
    const root = mount();
    await flush();

    expect(root.textContent).toContain("无法读取项目计划");
    expect(root.textContent).not.toContain("这个项目还没有排过里程碑");
    // No permission means no request: the panel never asks and then reports its own refusal.
    expect(get.mock.calls.filter(([path]) => path === "/milestones")).toEqual([]);
  });

  it("shows a refused read and keeps the retry, not an empty project", async () => {
    get.mockImplementation(((path: string) => {
      if (path === "/milestones")
        return Promise.reject(Object.assign(new Error("Forbidden"), { status: 403 }));
      if (path === "/projects/p1/members") return Promise.resolve(roster);
      if (path === "/projects/p1") return Promise.resolve(project);
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 });
    }) as never);
    const root = mount();
    await flush();

    expect(root.textContent).toContain("Forbidden");
    expect(root.textContent).not.toContain("这个项目还没有排过里程碑");
    // A refused read shows its sentence, not a frame still pretending to wait.
    expect(root.querySelectorAll(".skeleton-line").length).toBe(0);

    get.mockImplementation(((path: string) => {
      if (path === "/milestones") return Promise.resolve(plan(row("m1", "2026-11-12", "pending")));
      if (path === "/projects/p1/members") return Promise.resolve(roster);
      if (path === "/projects/p1") return Promise.resolve(project);
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 });
    }) as never);
    buttons(root, "重试")[0]!.click();
    await flush();
    expect(root.textContent).toContain("里程碑 m1");
  });

  it("claims an empty plan only when the read came back empty", async () => {
    get.mockImplementation(((path: string) => {
      if (path === "/milestones") return Promise.resolve(plan());
      if (path === "/projects/p1/members") return Promise.resolve(roster);
      if (path === "/projects/p1") return Promise.resolve(project);
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 });
    }) as never);
    const root = mount();
    await flush();

    expect(root.textContent).toContain("这个项目还没有排过里程碑");
    expect(root.textContent).not.toContain("无法读取项目计划");
  });

  it("sends the whole row on a status flip and re-reads the dated order", async () => {
    const root = mount();
    await flush();
    const before = get.mock.calls.filter(([path]) => path === "/milestones").length;

    put.mockResolvedValue(row("m2", "2026-11-12", "done") as never);
    buttons(root, "标记完成")[0]!.click();
    await flush();

    expect(put).toHaveBeenCalledWith("/milestones/m2", {
      projectId: "p1",
      title: "里程碑 m2",
      dueDate: "2026-11-12",
      status: "done",
    });
    expect(message.success).toHaveBeenCalledWith("里程碑已更新");
    // The panel is read back rather than sorted by hand, so the order on screen stays the
    // server's answer to a date sort.
    expect(get.mock.calls.filter(([path]) => path === "/milestones").length).toBe(before + 1);
  });

  it("adds a dated promise and lets the server place it in the plan", async () => {
    const root = mount();
    await flush();

    fill(root, "title", "  数据口径评审  ");
    fill(root, "due", "2026-12-01");
    await flush();
    post.mockResolvedValue(row("m9", "2026-12-01", "pending", "数据口径评审") as never);
    buttons(root, "新增里程碑")[0]!.click();
    await flush();

    expect(post).toHaveBeenCalledWith("/milestones", {
      projectId: "p1",
      title: "数据口径评审",
      dueDate: "2026-12-01",
      status: "pending",
    });
    expect(message.success).toHaveBeenCalledWith("里程碑已添加");
    // The form empties on success so the next row starts clean.
    expect(root.querySelector<HTMLInputElement>('[data-field="title"]')!.value).toBe("");
  });

  it("refuses to save a row that has no date yet", async () => {
    const root = mount();
    await flush();

    fill(root, "title", "只有标题");
    await flush();
    expect(buttons(root, "新增里程碑")[0]!.disabled).toBe(true);

    fill(root, "due", "2026-12-01");
    await flush();
    expect(buttons(root, "新增里程碑")[0]!.disabled).toBe(false);
  });

  it("edits the row it picked and keeps its status", async () => {
    const root = mount();
    await flush();

    buttons(root, "编辑")[0]!.click();
    await flush();
    // The row lands in the form, status and all: the editor is a whole-row write.
    expect(root.querySelector<HTMLInputElement>('[data-field="title"]')!.value).toBe("里程碑 m2");
    expect(root.querySelector<HTMLInputElement>('[data-field="due"]')!.value).toBe("2026-11-12");
    expect(buttons(root, "保存里程碑").length).toBe(1);

    fill(root, "title", "官网首版上线（顺延）");
    put.mockResolvedValue(row("m2", "2026-11-12", "pending", "官网首版上线（顺延）") as never);
    buttons(root, "保存里程碑")[0]!.click();
    await flush();

    expect(put).toHaveBeenCalledWith("/milestones/m2", {
      projectId: "p1",
      title: "官网首版上线（顺延）",
      dueDate: "2026-11-12",
      status: "pending",
    });
    expect(buttons(root, "取消编辑").length).toBe(0);
  });

  it("deletes through a confirmation and closes it on cancel", async () => {
    const root = mount();
    await flush();

    buttons(root, "删除")[0]!.click();
    await flush();
    expect(root.querySelector(".modal")!.textContent).toContain("里程碑 m2");

    del.mockResolvedValue({ ok: true } as never);
    buttons(root, "确认删除")[0]!.click();
    await flush();

    expect(del).toHaveBeenCalledWith("/milestones/m2");
    expect(root.querySelector(".modal")).toBeNull();
    expect(message.success).toHaveBeenCalledWith("里程碑已删除");
  });

  it("cancels the confirmation without writing anything", async () => {
    const root = mount();
    await flush();

    buttons(root, "删除")[0]!.click();
    await flush();
    buttons(root, "取消")[0]!.click();
    await flush();

    expect(del).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")).toBeNull();
  });

  it("reads the plan without a write permission and says it is read-only", async () => {
    auth.permissions = ["project:read", ...PLAN_READ];
    const root = mount();
    await flush();

    expect(root.textContent).toContain("没有 milestone:write 权限，计划只读");
    expect(root.querySelector('[data-field="title"]')).toBeNull();
    expect(buttons(root, "标记完成").length).toBe(0);
    expect(buttons(root, "删除").length).toBe(0);
    // Reading still works: the two dates are on screen.
    expect(root.textContent).toContain("2026-11-12");
  });

  it("offers delete only to an account that holds milestone:delete", async () => {
    auth.permissions = ["project:read", ...PLAN_WRITE];
    const root = mount();
    await flush();

    expect(buttons(root, "删除").length).toBe(0);
    expect(buttons(root, "标记完成").length).toBe(2);
  });

  it("stops the plan read at the cap and says the plan is partial", async () => {
    auth.permissions = ["project:read", ...PLAN_READ];
    const rows = Array.from({ length: 240 }, (_unused, index) =>
      row(`m${index}`, `2026-${String((index % 12) + 1).padStart(2, "0")}-01`, "pending"),
    );
    get.mockImplementation(((path: string, params?: { page?: number; pageSize?: number }) => {
      if (path === "/milestones") {
        const start = ((params?.page || 1) - 1) * (params?.pageSize || 100);
        return Promise.resolve({
          items: rows.slice(start, start + (params?.pageSize || 100)),
          total: rows.length,
          page: params?.page || 1,
          pageSize: params?.pageSize || 100,
        });
      }
      if (path === "/projects/p1/members") return Promise.resolve(roster);
      if (path === "/projects/p1") return Promise.resolve(project);
      return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 100 });
    }) as never);
    const root = mount();
    await flush();

    expect(root.textContent).toContain("计划没有读完");
    expect(root.textContent).toContain("240");
    expect(root.querySelectorAll("li").length).toBe(200);
  });

  it("keeps a failed write draft so the writer can fix it", async () => {
    const root = mount();
    await flush();

    fill(root, "title", "写坏了的那条");
    fill(root, "due", "2026-12-01");
    await flush();
    post.mockRejectedValue(new Error("Name already used"));
    buttons(root, "新增里程碑")[0]!.click();
    await flush();

    expect(message.error).toHaveBeenCalledWith("Name already used");
    expect(root.querySelector<HTMLInputElement>('[data-field="title"]')!.value).toBe(
      "写坏了的那条",
    );
    expect(root.querySelector<HTMLInputElement>('[data-field="due"]')!.value).toBe("2026-12-01");
  });

  it("ignores a second write while one is still unanswered", async () => {
    const root = mount();
    await flush();

    fill(root, "title", "只写一次");
    fill(root, "due", "2026-12-01");
    await flush();
    let resolveWrite!: (value: unknown) => void;
    post.mockImplementation((() =>
      new Promise((resolve) => {
        resolveWrite = resolve;
      })) as never);
    buttons(root, "新增里程碑")[0]!.click();
    await flush();

    // The button goes dead while the first write is out, so a double click cannot file the
    // same promise twice and the plan cannot gain a row nobody asked for.
    expect(buttons(root, "新增里程碑")[0]!.disabled).toBe(true);
    expect(post).toHaveBeenCalledTimes(1);

    resolveWrite(row("m9", "2026-12-01", "pending", "只写一次") as never);
    await flush();
    expect(message.success).toHaveBeenCalledWith("里程碑已添加");
    expect(post).toHaveBeenCalledTimes(1);
  });
});

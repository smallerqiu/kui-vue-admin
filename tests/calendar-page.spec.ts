import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Calendar from "@/pages/(admin)/calendar.vue";
import { message } from "kui-vue";
import request from "@/utils/request";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("header", [slots.default?.(), slots.actions?.()]),
  },
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
// The list view is a separate page concern; the month view is what these tests mount.
vi.mock("@/components/business/resource-manager.vue", () => ({
  default: { setup: () => () => h("div", { class: "resource-manager" }) },
}));

const auth = reactive({ permissions: ["calendar:read", "calendar:write", "calendar:delete"] as string[] });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const put = vi.mocked(request.put);
const del = vi.mocked(request.delete);

const pad = (value: number) => String(value).padStart(2, "0");
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
/** Written independently of `monthWindow`, so the page is checked against the calendar. */
const expectedWindow = (year: number, month: number) => ({
  dateFrom: `${year}-${pad(month)}-01`,
  dateTo: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`,
});

/** A date a few days ahead; it sorts after `localToday` wherever today falls. */
const shiftDay = (days: number) => {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const row = (id: string, date: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `日程 ${id}`,
  date,
  time: "09:30:00",
  category: "meeting",
  location: "三楼会议室",
  attendees: "6 人",
  online: false,
  description: "同步进展。",
  ownerId: "u1",
  departmentId: null,
  createdAt: "2026-10-01T00:00:00",
  ...extra,
});

const monthRows = () => ({
  items: [row("1", localToday()), row("2", shiftDay(3))],
  total: 2,
  page: 1,
  pageSize: 100,
});

const passthrough = (props: string[] = []) => ({
  props,
  setup: (
    _props: Record<string, unknown>,
    { slots }: { slots: Record<string, () => unknown> },
  ) => () => h("div", [String(_props.title ?? ""), slots.default?.(), slots.extra?.(), slots.actions?.(), slots.footer?.()]),
});

/**
 * Calendar is a controlled grid, so the stub only has to expose the three channels
 * the page listens to: the displayed month, a clicked event and the selected date.
 */
const calendarStub = {
  props: ["modelValue", "events"],
  emits: ["update:modelValue", "monthChange", "eventClick"],
  setup(
    props: any,
    { slots, emit }: { slots: Record<string, () => unknown>; emit: (event: string, ...args: unknown[]) => void },
  ) {
    return () =>
      h("div", { "data-events": JSON.stringify(props.events), "data-selected": props.modelValue }, [
        slots.extra?.(),
        h("button", { "data-month-shift": "", onClick: () => emit("monthChange", { year: 2026, month: 11 }) }),
        h("button", { "data-pick": "", onClick: () => emit("eventClick", props.events[0]) }),
      ]);
  },
};

const inputStub = {
  props: ["modelValue", "maxlength", "disabled"],
  emits: ["update:modelValue"],
  setup(
    props: any,
    { emit }: { emit: (event: string, value: unknown) => void },
  ) {
    return () =>
      h("input", {
        value: props.modelValue ?? "",
        onInput: (event: Event) => emit("update:modelValue", (event.target as HTMLInputElement).value),
      });
  },
};

const disposers: Array<() => void> = [];
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

/** Kui renders slot text with the template's own whitespace, so match it trimmed. */
function clickButton(root: HTMLElement, label: string) {
  const button = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (element) => element.textContent?.trim() === label,
  );
  if (!button) throw new Error(`No button labelled ${label}`);
  button.click();
}

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Calendar);
  for (const name of ["Grid", "GridItem", "Card", "Tag", "Space", "Icon", "Empty", "Form", "FormItem"])
    app.component(name, passthrough(["title"]) as never);
  app.component("Button", { setup: (_p: object, { slots }: { slots: Record<string, () => unknown> }) => () => h("button", slots.default?.()) } as never);
  app.component("Segmented", {
    props: ["options"],
    emits: ["update:modelValue"],
    setup: (props: any, { emit }: { emit: any }) =>
      () => h("div", props.options.map((option: any) => h("button", { "data-view": option.value, onClick: () => emit("update:modelValue", option.value) }, option.label))),
  } as never);
  app.component("Select", {
    props: ["modelValue", "options"],
    emits: ["update:modelValue"],
    setup: (props: any, { emit }: { emit: any }) =>
      () =>
        h("div", [
          String(props.modelValue ?? ""),
          ...(props.options || []).map((option: any) =>
            h("button", { "data-category": option.value, onClick: () => emit("update:modelValue", option.value) }, option.label),
          ),
        ]),
  } as never);
  app.component("DatePicker", { props: ["modelValue"], setup: (props: any) => () => h("span", { class: "date-picker" }, String(props.modelValue ?? "")) } as never);
  app.component("TextArea", inputStub as never);
  app.component("Switch", { props: ["modelValue"], emits: ["update:modelValue"], setup: () => () => h("span", { class: "switch" }) } as never);
  app.component("Calendar", calendarStub as never);
  app.component(
    "Drawer",
    {
      props: ["modelValue", "title"],
      emits: ["update:modelValue", "ok"],
      setup: (
        props: any,
        { slots, emit }: { slots: Record<string, () => unknown>; emit: (event: string) => void },
      ) => () => (props.modelValue ? h("div", { class: "drawer" }, [slots.default?.(), h("button", { "data-drawer-ok": "", onClick: () => emit("ok") }, "ok")]) : null),
    } as never,
  );
  app.component(
    "Modal",
    {
      props: ["modelValue", "title"],
      emits: ["update:modelValue"],
      setup: (props: any, { slots }: { slots: Record<string, () => unknown> }) =>
        () => (props.modelValue ? h("div", { class: "modal" }, [String(props.title ?? ""), slots.default?.(), slots.footer?.()]) : null),
    } as never,
  );
  app.component("Input", inputStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

describe("calendar month view", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    del.mockReset();
    vi.clearAllMocks();
    auth.permissions = ["calendar:read", "calendar:write", "calendar:delete"];
    get.mockResolvedValue(monthRows() as never);
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
  });

  it("reads the displayed month as a date window", async () => {
    const now = new Date();
    mount();
    await flush();

    expect(get).toHaveBeenCalledWith("/calendar", {
      ...expectedWindow(now.getFullYear(), now.getMonth() + 1),
      page: 1,
      pageSize: 100,
    });
  });

  it("re-queries the server when the grid moves to another month", async () => {
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>("[data-month-shift]")!.click();
    await flush();

    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[1][1]).toMatchObject(expectedWindow(2026, 11));
  });

  it("narrows the request when a category is selected", async () => {
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>('[data-category="project"]')!.click();
    await flush();

    expect(get.mock.calls[1][1]).toMatchObject({ category: "project" });
  });

  it("shows the month it loaded on the grid, with the seconds trimmed", async () => {
    const root = mount();
    await flush();

    const events = JSON.parse(root.querySelector("[data-events]")!.getAttribute("data-events")!);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ key: "1", date: localToday(), time: "09:30", color: "#3a95ff" });
    expect(root.textContent).toContain("三楼会议室");
  });

  it("reports a failed read instead of falling back to sample rows", async () => {
    get.mockRejectedValue(new Error("请求失败"));
    const root = mount();
    await flush();

    expect(root.textContent).toContain("请求失败");
    expect(JSON.parse(root.querySelector("[data-events]")!.getAttribute("data-events")!)).toEqual([]);
    expect(message.success).not.toHaveBeenCalled();
  });

  it("keeps the month readable for an account without write permission", async () => {
    auth.permissions = ["calendar:read"];
    const root = mount();
    await flush();

    expect(root.textContent).not.toContain("新建日程");
    expect(root.textContent).toContain("calendar:write");
    expect(JSON.parse(root.querySelector("[data-events]")!.getAttribute("data-events")!)).toHaveLength(2);
  });

  it("opens the stored detail for the event the grid clicked", async () => {
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>("[data-pick]")!.click();
    await flush();

    const detail = root.querySelector(".modal")!;
    expect(detail.textContent).toContain("日程 1");
    expect(detail.textContent).toContain("三楼会议室");
  });

  it("refuses an incomplete form before spending a request", async () => {
    const root = mount();
    await flush();

    clickButton(root, "新建日程");
    await flush();
    root.querySelector<HTMLButtonElement>("[data-drawer-ok]")!.click();
    await flush();

    expect(post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalled();
  });

  it("creates through POST and only then says it is saved", async () => {
    post.mockResolvedValue(row("9", localToday(), { title: "产品周会" }) as never);
    const root = mount();
    await flush();

    clickButton(root, "新建日程");
    await flush();
    const title = root.querySelector(".drawer input")!;
    title.value = "产品周会";
    title.dispatchEvent(new Event("input"));
    await flush();
    root.querySelector<HTMLButtonElement>("[data-drawer-ok]")!.click();
    await flush();

    expect(post).toHaveBeenCalledWith("/calendar", {
      title: "产品周会",
      date: localToday(),
      time: "09:00",
      category: "meeting",
      location: "",
      attendees: "",
      online: false,
      description: "",
    });
    expect(message.success).toHaveBeenCalledWith("日程已创建");
  });

  it("keeps the drawer open when the server rejects the write", async () => {
    post.mockRejectedValue(new Error("Invalid date"));
    const root = mount();
    await flush();

    clickButton(root, "新建日程");
    await flush();
    const title = root.querySelector(".drawer input")!;
    title.value = "产品周会";
    title.dispatchEvent(new Event("input"));
    await flush();
    root.querySelector<HTMLButtonElement>("[data-drawer-ok]")!.click();
    await flush();

    expect(root.querySelector(".drawer")).not.toBeNull();
    expect(message.success).not.toHaveBeenCalled();
  });

  it("edits the selected event through PUT", async () => {
    put.mockResolvedValue(row("1", localToday(), { title: "改名后的日程" }) as never);
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>("[data-pick]")!.click();
    await flush();
    clickButton(root, "编辑日程");
    await flush();
    const title = root.querySelector(".drawer input")!;
    title.value = "改名后的日程";
    title.dispatchEvent(new Event("input"));
    await flush();
    root.querySelector<HTMLButtonElement>("[data-drawer-ok]")!.click();
    await flush();

    expect(put).toHaveBeenCalledWith(`/calendar/1`, expect.objectContaining({ title: "改名后的日程", time: "09:30" }));
  });

  it("deletes only after the confirmation and reloads the month", async () => {
    del.mockResolvedValue({ ok: true } as never);
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>("[data-pick]")!.click();
    await flush();
    clickButton(root, "删除");
    await flush();
    clickButton(root, "确认删除");
    await flush();

    expect(del).toHaveBeenCalledWith("/calendar/1");
    expect(message.success).toHaveBeenCalledWith("日程已删除");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("switches to the table view without re-reading the month", async () => {
    const root = mount();
    await flush();

    root.querySelector<HTMLButtonElement>('[data-view="list"]')!.click();
    await flush();

    expect(root.querySelector(".resource-manager")).not.toBeNull();
    expect(root.querySelector("[data-events]")).toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });
});

import { createApp, h, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Logs from "@/pages/(admin)/system/logs.vue";
import { auditLogApi, auditLogsToCsv } from "@/api/system";
import { message } from "kui-vue";
import request from "@/utils/request";
import { skeletonStub } from "./skeleton-stub";

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
// The export is the one part of this page that is not the list on screen: the page asks the api
// module for every row its filter matches, so the walk itself is covered in `log-export.spec.ts`.
vi.mock("@/api/system", () => ({
  auditLogApi: { page: vi.fn(), allMatching: vi.fn() },
  auditLogsToCsv: vi.fn(() => "csv"),
}));

const get = vi.mocked(request.get);
const allMatching = vi.mocked(auditLogApi.allMatching);
const toCsv = vi.mocked(auditLogsToCsv);

const log = (over: Record<string, unknown> = {}) => ({
  id: "l1",
  action: "order:close",
  actorId: "9f2c0a1b2c3d4e5f60718293a4b5c6d7",
  actorName: "林晓",
  resourceId: "a".repeat(32),
  requestId: "req-1",
  ip: "10.10.2.35",
  createdAt: "2026-10-19T16:05:41",
  module: "order",
  moduleName: "订单管理",
  operation: "关闭订单",
  level: "warning",
  levelName: "警告",
  ...over,
});
const page = (items: unknown[]) =>
  ({
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
    facets: {
      // The server's dictionary is wider than the two modules these rows happened to act in, and
      // wider than any list a page could keep up to date by hand.
      modules: [
        { code: "order", name: "订单管理" },
        { code: "customer", name: "客户管理" },
        { code: "after-sale", name: "售后管理" },
        { code: "system:settings", name: "系统设置" },
      ],
      levels: [
        { code: "info", name: "信息" },
        { code: "success", name: "成功" },
        { code: "warning", name: "警告" },
        { code: "danger", name: "异常" },
      ],
    },
  }) as never;

/**
 * Kui's Table renders one named slot per column and prints the cell itself when a column has no
 * slot, so the stub does the same: a page that forgets a slot for a server-computed column still
 * has to be caught by the cell it prints.
 */
const tableStub = {
  props: ["data", "columns", "rowKey", "loading"],
  setup(
    props: any,
    { slots }: { slots: Record<string, (arg: { record: any; value: unknown }) => unknown> },
  ) {
    return () =>
      h("div", { class: "table" }, [
        h(
          "div",
          { class: "head" },
          props.columns.map((column: any) =>
            h("span", { class: "head-" + column.key }, column.title),
          ),
        ),
        props.data.map((record: any) =>
          h(
            "div",
            { class: "row", "data-id": record[props.rowKey] },
            props.columns.map((column: any) =>
              h(
                "span",
                { class: "cell-" + column.key },
                slots[column.key]
                  ? slots[column.key]!({ record, value: record[column.key] })
                  : String(record[column.key] ?? ""),
              ),
            ),
          ),
        ),
      ]);
  },
};

// A Select the test can read and operate: the options it was handed are the server's own
// vocabulary, and each option is a button so a test picks the one it means rather than whatever
// happens to sort first.
const selectStub = {
  props: ["modelValue", "options", "placeholder"],
  emits: ["update:modelValue"],
  setup(props: any, { emit }: { emit: (event: string, value: unknown) => void }) {
    return () =>
      h(
        "div",
        {
          class: "select",
          "data-placeholder": props.placeholder,
          "data-options": JSON.stringify(props.options),
          "data-value": props.modelValue ?? "",
        },
        (props.options ?? []).map((option: { label: string; value: string }) =>
          h(
            "button",
            {
              type: "button",
              class: "option",
              onClick: () => emit("update:modelValue", option.value),
            },
            option.label,
          ),
        ),
      );
  },
};

// A stub Kui renders as its own element where the element is what the test reaches for: a Button
// has to be a real `button` so a click on 导出日志 or 详情 lands on something.  Every slot is
// printed, because a page that puts its filters in `#filters` still has to show them.
const box =
  (name: string) =>
  ({
    props: [] as string[],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) => () =>
      h(name === "button" ? "button" : "div", { class: name }, [
        ...Object.values(slots).map((slot) => slot()),
      ]),
  });

const disposers: Array<() => void> = [];
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
};
// A filter change is debounced, because asking the deployed database for a page costs a round trip
// the operator pays for on every keystroke.
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  await flush();
};

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Logs);
  for (const name of [
    "Avatar",
    "Button",
    "Descriptions",
    "DescriptionsItem",
    "Drawer",
    "Input",
    "ListPanel",
    "Page",
    "Space",
    "TableColumnSetting",
    "Tag",
  ]) {
    app.component(name, box(name.toLowerCase()) as never);
  }
  app.component("Table", tableStub as never);
  app.component("Select", selectStub as never);
  app.component("Skeleton", skeletonStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const cell = (root: HTMLElement, key: string, row = 0) =>
  Array.from(root.querySelectorAll(`.cell-${key}`))[row]?.textContent?.trim();
const select = (root: HTMLElement, placeholder: string) =>
  [...root.querySelectorAll<HTMLElement>(".select")].find(
    (node) => node.dataset.placeholder === placeholder,
  )!;
const option = (node: HTMLElement, label: string) =>
  [...node.querySelectorAll<HTMLButtonElement>("button.option")].find(
    (button) => button.textContent?.trim() === label,
  )!;
const click = (node: HTMLElement) => node.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("audit log page", () => {
  beforeEach(() => {
    get.mockReset();
    allMatching.mockReset();
    toCsv.mockReset();
    get.mockResolvedValue(page([log(), log({
      id: "l2",
      actorName: null,
      ip: null,
      action: "customer:delete",
      moduleName: "客户管理",
      operation: "删除客户",
      level: "danger",
      levelName: "异常",
    })]));
    allMatching.mockResolvedValue({ rows: [log()], truncated: false });
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    vi.unstubAllGlobals();
  });

  it("holds the panel and waits to count while the first page is in flight", async () => {
    let arrive!: (value: unknown) => void;
    get.mockImplementation(
      (() =>
        new Promise((resolve) => {
          arrive = resolve;
        })) as never,
    );
    const root = mount();
    await flush();

    // One frame, and nothing else: the table waits in its own loading state, while a strip reading
    // "共 0 条日志" would be a number nobody has counted yet.
    expect(root.querySelectorAll(".skeleton-line")).toHaveLength(1);
    expect(root.textContent).not.toContain("条日志");
    expect(root.querySelector(".table")).not.toBeNull();
    // The pager states no count of its own: the strip is the one place this page says how many there
    // are, and a second total would read "Total 0 items" before anything has been counted.
    expect(root.querySelector(".page")!.getAttribute("show-total")).toBe("false");

    arrive(page([log(), log({ id: "l2" })]));
    await flush();
    expect(root.querySelectorAll(".skeleton-line")).toHaveLength(0);
    expect(root.textContent).toContain("共 2 条日志");
  });

  it("counts no logs when the page is refused", async () => {
    get.mockRejectedValue(new Error("请求失败：503") as never);
    const root = mount();
    await flush();

    // The server's own words are the only claim a refused read leaves this page: no frame goes on
    // pretending the count is on its way, and no zero stands in for it.
    expect(root.textContent).toContain("请求失败：503");
    expect(root.querySelectorAll(".skeleton-line")).toHaveLength(0);
    expect(root.textContent).not.toContain("条日志");
  });

  it("reads a row as a person, a module and a sentence instead of a code and an id", async () => {
    const root = mount();
    await flush();

    for (const title of ["级别", "操作用户", "模块", "操作内容", "IP 地址", "时间"]) {
      expect(root.querySelector(".head")!.textContent).toContain(title);
    }
    expect(cell(root, "moduleName")).toBe("订单管理");
    expect(cell(root, "operation")).toBe("关闭订单");
    expect(cell(root, "level")).toBe("警告");
    expect(cell(root, "actorName")).toContain("林晓");
    expect(cell(root, "ip")).toBe("10.10.2.35");
    expect(cell(root, "createdAt")).toBe("2026-10-19 16:05");
    // The table is what an operator scans; the raw code and the account id belong to the drawer.
    expect(root.querySelector(".table")!.textContent).not.toContain("order:close");
    expect(root.querySelector(".table")!.textContent).not.toContain("9f2c0a1b2c3d4e5f");
  });

  it("says the account is gone and the address was never recorded", async () => {
    const root = mount();
    await flush();

    // A row whose actor was deleted afterwards still has to say what happened, and a row written
    // before the address column existed cannot name one.
    expect(cell(root, "actorName", 1)).toContain("已注销账号");
    expect(cell(root, "ip", 1)).toBe("—");
    expect(cell(root, "level", 1)).toBe("异常");
  });

  it("offers the filters the server's dictionary answers and sends the choice back", async () => {
    const root = mount();
    await flush();

    // The dropdowns are built from the response's own vocabulary, not from the rows on screen or
    // from a copy of the dictionary kept here: a module nobody acted in today still has to be
    // findable, which is what the two entries below nobody would hand-write prove.
    expect(JSON.parse(select(root, "全部模块").dataset.options!)).toEqual([
      { label: "订单管理", value: "order" },
      { label: "客户管理", value: "customer" },
      { label: "售后管理", value: "after-sale" },
      { label: "系统设置", value: "system:settings" },
    ]);
    expect(JSON.parse(select(root, "全部级别").dataset.options!)).toEqual([
      { label: "信息", value: "info" },
      { label: "成功", value: "success" },
      { label: "警告", value: "warning" },
      { label: "异常", value: "danger" },
    ]);
    click(option(select(root, "全部级别"), "警告"));
    await settle();
    expect(get).toHaveBeenLastCalledWith("/audit-logs", {
      keyword: "",
      level: "warning",
      module: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(select(root, "全部级别").dataset.value).toBe("warning");

    // Two dropdowns, two query keys: a page that wired the module choice into `level` would pass
    // everything above.
    click(option(select(root, "全部模块"), "订单管理"));
    await settle();
    expect(get).toHaveBeenLastCalledWith("/audit-logs", {
      keyword: "",
      level: "warning",
      module: "order",
      page: 1,
      pageSize: 20,
    });
  });

  it("keeps the code and the ids one click away in the detail drawer", async () => {
    const root = mount();
    await flush();
    click(root.querySelectorAll(".cell-detail button")[1]);
    await flush();

    const drawer = root.querySelector(".drawer")!.textContent!;
    expect(drawer).toContain("customer:delete");
    expect(drawer).toContain("删除客户");
    // The drawer is where the code belongs, and it still spells the level the way the row does: a
    // page that only translates the ladder inside the table would leave `danger` in here.
    expect(drawer).toContain("异常");
    expect(drawer).not.toContain("warning");
    expect(drawer).toContain("未记录");
    expect(drawer).toContain("l2");
  });

  it("exports the rows the filter matched, not the page on screen", async () => {
    const createObjectURL = vi.fn(() => "blob:demo");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    // jsdom would try to navigate for a real anchor click; only the download handoff matters.
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const root = mount();
    await flush();
    click(
      [...root.querySelectorAll("button")].find((node) =>
        node.textContent?.includes("导出日志"),
      )!,
    );
    await settle();

    expect(allMatching).toHaveBeenCalledWith({ keyword: "", level: undefined, module: undefined });
    expect(toCsv).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchorClick.mock.instances[0]?.download).toMatch(/^audit-logs-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(message.success).toHaveBeenCalledWith("已导出 1 条日志");
  });

  it("warns when the file is shorter than the filter matched", async () => {
    const createObjectURL = vi.fn(() => "blob:demo");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    allMatching.mockResolvedValue({ rows: [log()], truncated: true });
    const root = mount();
    await flush();
    click(
      [...root.querySelectorAll("button")].find((node) =>
        node.textContent?.includes("导出日志"),
      )!,
    );
    await settle();

    expect(message.warning).toHaveBeenCalledWith(
      "导出已到 1 条上限，更早的日志不在文件里",
    );
    expect(message.success).not.toHaveBeenCalled();
  });
});

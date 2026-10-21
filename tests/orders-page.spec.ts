import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Orders from "@/pages/(admin)/commerce/orders.vue";
import request from "@/utils/request";
import { reportFailure } from "@/utils/report-failure";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/utils/report-failure", () => ({ reportFailure: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const confirmations: Array<{ onOk?: () => unknown }> = [];
vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("header", [slots.default?.(), slots.actions?.()]),
  },
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  modal: { confirm: (options: { onOk?: () => unknown }) => confirmations.push(options) },
}));

const auth = reactive({ user: { permissions: ["*"] as string[] } });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const report = vi.mocked(reportFailure);

const summary = { today: 41, byStatus: { pending: 7, paid: 19 }, refundRequests: 3 };
const order = (over: Record<string, unknown> = {}) => ({
  id: "a".repeat(32),
  customer: "星河云科",
  contact: "林晓",
  phone: "13800000000",
  paidAmount: "12345.00",
  status: "pending",
  createdAt: "2026-10-19T16:05:41",
  items: [
    {
      id: "i1",
      name: "旗舰路由",
      sku: "R-1",
      specs: "黑色",
      image: "",
      price: "1286.00",
      quantity: 2,
      shippedQuantity: 0,
    },
  ],
  ...over,
});

/**
 * Kui's Table renders one named slot per column and prints the cell itself when a column has no
 * slot, so the stub does the same: a page that forgets a slot for a computed column still has to be
 * caught by the cell it prints.
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

// A card the test can read: its title is the promise the page makes and its number is the one the
// server answered, so a card wired to the wrong key of the summary is caught by the pair.
const statCardStub = {
  props: ["title", "items"],
  setup(props: any) {
    return () =>
      h("div", { class: "stat", "data-title": props.title }, [
        h("strong", String(props.items?.[0]?.value ?? "")),
        h("small", String(props.items?.[0]?.desc ?? "")),
      ]);
  },
};

// Every slot is printed: a page that puts its filters in `#filters` still has to show them.
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

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Orders);
  for (const name of [
    "Button",
    "DatePicker",
    "Grid",
    "GridItem",
    "Image",
    "Input",
    "ListPanel",
    "Page",
    "Select",
    "Space",
    "TableColumnSetting",
    "Tag",
  ]) {
    app.component(name, box(name.toLowerCase()) as never);
  }
  app.component("Table", tableStub as never);
  app.component("StatCard", statCardStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const cell = (root: HTMLElement, key: string, row = 0) =>
  Array.from(root.querySelectorAll(`.cell-${key}`))[row]?.textContent?.trim();
const card = (root: HTMLElement, title: string) =>
  [...root.querySelectorAll<HTMLElement>(".stat")].find((node) => node.dataset.title === title);
const click = (node: HTMLElement) => node.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("order page", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    report.mockReset();
    confirmations.length = 0;
    auth.user.permissions = ["*"];
    get.mockImplementation(((url: string) =>
      url === "/orders/summary"
        ? Promise.resolve(summary)
        : Promise.resolve({ items: [order(), order({ id: "b".repeat(32), status: "paid" })], total: 2, page: 1, pageSize: 20 })) as never);
    post.mockResolvedValue(order({ status: "closed" }) as never);
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
  });

  it("names the buyer and the money the way the page has always promised", async () => {
    const root = mount();
    await flush();

    for (const title of ["订单号", "买家", "商品明细", "实付金额", "状态", "操作"]) {
      expect(root.querySelector(".head")!.textContent).toContain(title);
    }
    expect(root.querySelector(".head")!.textContent).not.toContain("客户");
    expect(root.querySelector(".head")!.textContent).not.toContain("订单金额");
    // Money arrives as a two-decimal string, and a string left to `toLocaleString` keeps its digits
    // ungrouped: the column has to do the grouping itself.
    expect(cell(root, "paidAmount")).toContain("¥ 12,345.00");
    expect(cell(root, "paidAmount")).not.toContain("12345");
    expect(cell(root, "items")).toContain("¥1,286.00 × 2");
  });

  it("counts the four numbers from one aggregate read, in the cards' own words", async () => {
    const root = mount();
    await flush();

    expect(get).toHaveBeenCalledWith("/orders/summary");
    expect(card(root, "今日订单")!.textContent).toContain("41");
    expect(card(root, "待付款")!.textContent).toContain("7");
    // 待发货 is `paid`, not a third status the page invented: the ladder's word for "paid and not
    // shipped yet" is what the server counted.
    expect(card(root, "待发货")!.textContent).toContain("19");
    expect(card(root, "退款申请")!.textContent).toContain("3");
    expect(root.querySelectorAll(".stat")).toHaveLength(4);
  });

  it("says a refund count the account may not read instead of counting zero", async () => {
    get.mockImplementation(((url: string) =>
      Promise.resolve(
        url === "/orders/summary" ? { ...summary, refundRequests: null } : { items: [], total: 0, page: 1, pageSize: 20 },
      )) as never);
    const root = mount();
    await flush();

    // Three cards keep their numbers, because the answer that is missing is only the one the
    // permission refused.
    expect(card(root, "待发货")!.textContent).toContain("19");
    expect(card(root, "退款申请")!.textContent).toContain("当前账号无法读取售后");
  });

  it("re-reads the numbers after closing an order", async () => {
    const summaryCalls = () =>
      get.mock.calls.filter(([url]) => url === "/orders/summary").length;
    const root = mount();
    await flush();
    expect(summaryCalls()).toBe(1);

    const actions = [...root.querySelectorAll<HTMLButtonElement>(".cell-action button")];
    click(actions.find((node) => node.textContent?.includes("关闭"))!);
    await flush();
    await confirmations[0]!.onOk!();
    await flush();

    expect(post).toHaveBeenCalledWith(`/orders/${"a".repeat(32)}/close`, {});
    // The closed order leaves both the table and the 待付款 card, so neither number may stay behind.
    expect(summaryCalls()).toBe(2);
    expect(get.mock.calls.filter(([url]) => url === "/orders")).toHaveLength(2);
  });

  it("shows no cards rather than invented ones when the summary fails", async () => {
    get.mockImplementation(((url: string) =>
      url === "/orders/summary"
        ? Promise.reject(new Error("订单统计接口暂不可用"))
        : Promise.resolve({ items: [order()], total: 1, page: 1, pageSize: 20 })) as never);
    const root = mount();
    await flush();

    expect(root.querySelectorAll(".stat")).toHaveLength(0);
    expect(report).toHaveBeenCalledWith(expect.any(Error), "订单统计加载失败");
    // The list is its own request: a missing card row cannot be allowed to hide the orders.
    expect(cell(root, "paidAmount")).toContain("¥ 12,345.00");
  });
});

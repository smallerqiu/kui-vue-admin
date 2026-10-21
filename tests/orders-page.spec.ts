import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Orders from "@/pages/(admin)/commerce/orders.vue";
import { message } from "kui-vue";
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
// A vocabulary wider than anything the page could keep a copy of: three payment channels nobody
// hand-writes and three sources, one of which no row in this fixture even uses.
const facets = {
  paymentMethods: ["alipay-face", "bank-transfer", "wechat-mp"],
  sources: ["admin", "h5", "open-api"],
};
const order = (over: Record<string, unknown> = {}) => ({
  id: "a".repeat(32),
  customer: "星河云科",
  contact: "林晓",
  phone: "13800000000",
  paidAmount: "12345.00",
  status: "pending",
  paymentMethod: "bank-transfer",
  source: "admin",
  note: "",
  merchantRemark: "",
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

// A Select the test can read and operate: the options it was handed are the server's own vocabulary,
// and each option is a button so a test picks the one it means rather than whatever sorts first.
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
// Picking a filter is debounced, because asking the deployed database for a page costs a round trip
// the operator pays for on every keystroke.
const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  await flush();
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
    "Space",
    "TableColumnSetting",
    "Tag",
  ]) {
    app.component(name, box(name.toLowerCase()) as never);
  }
  app.component("Select", selectStub as never);
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
const select = (root: HTMLElement, placeholder: string) =>
  [...root.querySelectorAll<HTMLElement>(".select")].find(
    (node) => node.dataset.placeholder === placeholder,
  )!;
const option = (node: HTMLElement, label: string) =>
  [...node.querySelectorAll<HTMLButtonElement>("button.option")].find(
    (button) => button.textContent?.trim() === label,
  )!;
const buttonNamed = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
    node.textContent?.includes(label),
  )!;
const click = (node: HTMLElement) => node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const startDownload = () => {
  const createObjectURL = vi.fn(() => "blob:demo");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
  // jsdom would navigate for a real anchor click; only the download handoff matters.
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return { createObjectURL, revokeObjectURL, anchorClick };
};

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
        : url === "/orders/facets"
          ? Promise.resolve(facets)
          : Promise.resolve({
              items: [order(), order({ id: "b".repeat(32), status: "paid" })],
              total: 2,
              page: 1,
              pageSize: 20,
            })) as never);
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

  it("offers the payment channels and sources the server says exist, and filters by them", async () => {
    const root = mount();
    await flush();

    // Neither column is an enum this page owns: whoever recorded a payment typed the word, so the
    // only honest dropdown is the list of values the visible orders actually carry.  `open-api` is a
    // choice no row in this fixture uses, and it still has to be pickable.
    expect(get).toHaveBeenCalledWith("/orders/facets");
    expect(JSON.parse(select(root, "支付方式").dataset.options!)).toEqual([
      { label: "alipay-face", value: "alipay-face" },
      { label: "bank-transfer", value: "bank-transfer" },
      { label: "wechat-mp", value: "wechat-mp" },
    ]);
    expect(JSON.parse(select(root, "订单来源").dataset.options!)).toEqual([
      { label: "admin", value: "admin" },
      { label: "h5", value: "h5" },
      { label: "open-api", value: "open-api" },
    ]);

    click(option(select(root, "支付方式"), "wechat-mp"));
    await settle();
    // Two dropdowns, two query keys: wiring the source choice into `paymentMethod` would pass the
    // assertions above and send the wrong filter here.
    expect(get).toHaveBeenLastCalledWith("/orders", {
      keyword: "",
      status: undefined,
      paymentMethod: "wechat-mp",
      source: undefined,
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: 20,
    });

    click(option(select(root, "订单来源"), "open-api"));
    await settle();
    expect(get).toHaveBeenLastCalledWith("/orders", {
      keyword: "",
      status: undefined,
      paymentMethod: "wechat-mp",
      source: "open-api",
      startDate: undefined,
      endDate: undefined,
      page: 1,
      pageSize: 20,
    });
  });

  it("says so when the candidate values cannot be read, and keeps the list", async () => {
    get.mockImplementation(((url: string) =>
      url === "/orders/facets"
        ? Promise.reject(new Error("候选接口暂不可用"))
        : Promise.resolve(
            url === "/orders/summary"
              ? summary
              : { items: [order()], total: 1, page: 1, pageSize: 20 },
          )) as never);
    const root = mount();
    await flush();

    // An empty dropdown is not the server saying no such channel exists, so the failure is said out
    // loud -- and it cannot be allowed to hide the orders the list did answer for.
    expect(report).toHaveBeenCalledWith(expect.any(Error), "筛选候选值加载失败");
    expect(JSON.parse(select(root, "支付方式").dataset.options!)).toEqual([]);
    expect(cell(root, "paidAmount")).toContain("¥ 12,345.00");
  });

  it("exports every order the filter on screen matched, as a dated csv", async () => {
    const download = startDownload();
    // `pages` is what the export walk is handed per request: a filter matching 3 orders answered
    // 2 + 1 is what a two-request walk looks like, and the success message counts the rows that
    // arrived rather than what `total` claimed -- which is the one thing that catches a walk
    // counting the same page twice.
    const answer = (pages: number[]) => {
      let walk = 0;
      return ((url: string, params?: { pageSize?: number; page?: number }) => {
        if (url === "/orders/summary") return Promise.resolve(summary);
        if (url === "/orders/facets") return Promise.resolve(facets);
        if (params?.pageSize !== 100)
          return Promise.resolve({
            items: [order(), order({ id: "b".repeat(32) })],
            total: 2,
            page: 1,
            pageSize: 20,
          });
        const count = pages[Math.min(walk++, pages.length - 1)];
        return Promise.resolve({
          items: Array.from({ length: count }, (_, i) => order({ id: `w${walk}-${i}` })),
          total: 3,
          page: params?.page ?? 1,
          pageSize: 100,
        });
      }) as never;
    };
    get.mockImplementation(answer([2, 1]));
    const root = mount();
    await flush();
    // Picking a status first: the file has to carry the filter the page is showing, not the whole
    // table under a name that says otherwise.
    click(option(select(root, "全部状态"), "待付款"));
    await settle();
    download.anchorClick.mockClear();
    // Clicked twice in one tick: a walk with no in-flight guard would download two files.
    click(buttonNamed(root, "导出订单"));
    click(buttonNamed(root, "导出订单"));
    await flush();

    // The walk asks 100 at a time (the page on screen asks 20), and every one of its requests carries
    // the filter the page is showing -- a walk that dropped it would export the whole table under a
    // file name that says otherwise.
    const calls = get.mock.calls.filter(([url]) => url === "/orders");
    const walked = calls.filter(([, params]) => params.pageSize === 100);
    // 3 orders answered 2 + 1 is exactly two walk requests, once per click pair.
    expect(walked).toHaveLength(2);
    expect(calls.filter(([, params]) => params.pageSize === 20).at(-1)![1]).toMatchObject({
      status: "pending",
      page: 1,
    });
    for (const [, params] of walked)
      expect(params).toEqual({
        keyword: "",
        status: "pending",
        paymentMethod: undefined,
        source: undefined,
        startDate: undefined,
        endDate: undefined,
        page: expect.any(Number),
        pageSize: 100,
      });
    expect(download.anchorClick).toHaveBeenCalledOnce();
    expect(download.anchorClick.mock.instances[0]?.download).toMatch(
      /^orders-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(download.revokeObjectURL).toHaveBeenCalledOnce();
    expect(message.warning).not.toHaveBeenCalled();
    // Once: a second click in the same tick must not download a second file.  Asserted here rather
    // than on a `loading` attribute because an invisible flag is only observable through what it
    // stops the page from doing.
    expect(message.success).toHaveBeenCalledTimes(1);
    expect(message.success).toHaveBeenCalledWith("已导出 3 条订单");
  });

  it("warns instead of handing over an empty file when the filter matches nothing", async () => {
    const download = startDownload();
    get.mockImplementation(((url: string) =>
      Promise.resolve(
        url === "/orders/summary"
          ? summary
          : url === "/orders/facets"
            ? facets
            : { items: [], total: 0, page: 1, pageSize: 100 },
      )) as never);
    const root = mount();
    await flush();
    click(buttonNamed(root, "导出订单"));
    await flush();

    expect(message.warning).toHaveBeenCalledWith("当前条件下没有订单");
    expect(download.createObjectURL).not.toHaveBeenCalled();
    expect(message.success).not.toHaveBeenCalled();
  });

  it("reports the server's own words when the export fails", async () => {
    const download = startDownload();
    get.mockImplementation(((url: string) =>
      url === "/orders"
        ? Promise.reject(new Error("Export conflict"))
        : Promise.resolve(
            url === "/orders/summary"
              ? summary
              : url === "/orders/facets"
                ? facets
                : { items: [order()], total: 1, page: 1, pageSize: 100 },
          )) as never);
    const root = mount();
    await flush();
    click(buttonNamed(root, "导出订单"));
    await flush();

    // 4xx answers are not announced by the request layer, so the export says it itself; a silent
    // button that looks like an empty result is the worse failure.
    expect(message.error).toHaveBeenCalledWith("Export conflict");
    expect(download.createObjectURL).not.toHaveBeenCalled();
    // The next click has to walk again rather than sit on a flag the failed export never released.
    click(buttonNamed(root, "导出订单"));
    await flush();
    expect(message.error).toHaveBeenCalledTimes(2);
  });
});

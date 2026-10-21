import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Customers from "@/pages/(admin)/crm/customers.vue";
import request from "@/utils/request";
import { reportFailure } from "@/utils/report-failure";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/utils/report-failure", () => ({ reportFailure: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("header", [slots.default?.(), slots.actions?.()]),
  },
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const auth = reactive({ user: { permissions: ["*"] as string[] } });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const report = vi.mocked(reportFailure);

// The page's own list, which is a different row set from the one the cards answer for: the list
// follows the filters on screen, the cards are the whole company. Keeping the two fixtures apart is
// what stops a card wired to `items.length` from reading as a pass.
const list = {
  items: [
    {
      id: "c1",
      name: "星河云科",
      industry: "企业服务",
      level: "strategic",
      status: "active",
      contact: "林晓",
      phone: "13800000000",
      email: "a@example.test",
      city: "武汉",
      createdAt: "2026-09-01T08:00:00",
      updatedAt: "2026-10-01T08:00:00",
      ownerName: "陈默",
      orderCount: 3,
      annualValue: "30.30",
      lastContactAt: "2026-10-19T16:05:41",
    },
    {
      id: "c2",
      name: "青屿网络",
      industry: "互联网",
      level: "growth",
      status: "follow",
      contact: "周宁",
      phone: "",
      email: "",
      city: "杭州",
      createdAt: "2026-09-02T08:00:00",
      updatedAt: "2026-10-02T08:00:00",
      ownerName: null,
      orderCount: 0,
      annualValue: "0.00",
      lastContactAt: null,
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
};

// One aggregate read, with the same four numbers the four cards show. `beforeThisMonth` is the
// baseline the 客户总数 trend is measured against, `strategicAnnualValue` the numerator of 战略
// 客户's share, and `annualValue` the sum of the 年价值 column -- the page prints it in 万 because
// that is the unit the card was built for.
const aggregate = {
  total: 1286,
  byLevel: { strategic: 86 },
  monthlyAdded: 38,
  lastMonthlyAdded: 25,
  beforeThisMonth: 1200,
  annualValue: "7140000.00",
  strategicAnnualValue: "2998800.00",
};

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
          props.columns.map((column: any) => h("span", { class: "head-" + column.key }, column.title)),
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

// A card the test can read: the title is the promise, the number is what the server answered, and
// `data-item` hands back the whole item the page built, so a card wired to the wrong key of the
// summary -- or formatted in the wrong unit -- is caught by the pair.
const statCardStub = {
  props: ["title", "items"],
  setup(props: any) {
    const item = props.items?.[0] ?? {};
    return () =>
      h(
        "div",
        { class: "stat", "data-title": props.title, "data-item": JSON.stringify(item) },
        [
          h("strong", `${item.prefix ?? ""}${item.value ?? ""}${item.suffix ?? ""}`),
          h("small", String(item.desc ?? "")),
          h("em", String(item.trend ?? "")),
        ],
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

// A FormItem that names the box it wraps and an Input that keeps the value the page gave it: the
// create path is only testable if typing in the drawer reaches the page's form, and the assertion
// that follows the save is about which reads the page runs afterwards.
const formItemStub = {
  props: ["label"],
  setup(props: any, { slots }: { slots: Record<string, () => unknown> }) {
    return () =>
      h("div", { class: "form-item", "data-label": props.label }, Object.values(slots).map((s) => s()));
  },
};
const inputStub = {
  props: ["modelValue", "placeholder"],
  emits: ["update:modelValue"],
  setup(props: any, { emit }: { emit: (event: string, value: unknown) => void }) {
    return () =>
      h("input", {
        class: "stub-input",
        value: props.modelValue ?? "",
        onInput: (event: Event) =>
          emit("update:modelValue", (event.target as HTMLInputElement).value),
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

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Customers);
  for (const name of [
    "Badge",
    "Button",
    "Drawer",
    "Form",
    "Grid",
    "GridItem",
    "Icon",
    "ListPanel",
    "Page",
    "Select",
    "Space",
    "TableColumnSetting",
    "Tag",
  ]) {
    app.component(name, box(name.toLowerCase()) as never);
  }
  app.component("Input", inputStub as never);
  app.component("FormItem", formItemStub as never);
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
  [...root.querySelectorAll<HTMLElement>(".stat")].find(
    (node) => node.dataset.title === title,
  )!;
const callsTo = (path: string) => get.mock.calls.filter(([url]) => url === path).length;

describe("customer page", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    report.mockReset();
    auth.permissions = ["*"];
    get.mockImplementation(((path: string) =>
      path === "/customers/summary" ? { ...aggregate } : { ...list }) as never);
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
  });

  it("shows who owns each customer and what their orders add up to", async () => {
    const root = mount();
    await flush();

    // The four columns exist because the customer row cannot answer them: the name is the row
    // `ownerId` points at and the figures fold the orders pointing back at it.
    for (const title of ["负责人", "订单数", "年价值", "最近联系"]) {
      expect(root.querySelector(".head")!.textContent).toContain(title);
    }
    expect(cell(root, "ownerName")).toBe("陈默");
    expect(cell(root, "orderCount")).toBe("3");
    expect(cell(root, "annualValue")).toBe("¥30.30");
    expect(cell(root, "lastContactAt")).toBe("2026-10-19 16:05");
    // Neither the key a lookup resolved nor the id the fold grouped by reaches the screen.
    expect(root.textContent).not.toContain("c1");
    expect(root.textContent).not.toContain("u1");
  });

  it("answers zero and a dash for a customer nobody owns and nobody has ordered for", async () => {
    const root = mount();
    await flush();

    // An absent figure has to read as "no orders", not as a blank cell a stale build left behind,
    // and an unassigned owner has to say so instead of printing nothing.
    expect(cell(root, "ownerName", 1)).toBe("—");
    expect(cell(root, "orderCount", 1)).toBe("0");
    expect(cell(root, "annualValue", 1)).toBe("¥0.00");
    expect(cell(root, "lastContactAt", 1)).toBe("—");
  });

  it("answers the four numbers above the list from one aggregate read", async () => {
    const root = mount();
    await flush();

    for (const title of ["客户总数", "战略客户", "本月新增", "客户年价值"]) {
      expect(card(root, title)).toBeTruthy();
    }
    expect(get).toHaveBeenCalledWith("/customers/summary");
    expect(callsTo("/customers/summary")).toBe(1);
    // The cards are the company, the counter beside the table is the filtered page: one read of the
    // aggregate, and a card that counted `items.length` would print 2 here.
    expect(card(root, "客户总数").querySelector("strong")!.textContent).toBe("1286");
    expect(card(root, "战略客户").querySelector("strong")!.textContent).toBe("86");
    expect(card(root, "本月新增").querySelector("strong")!.textContent).toBe("38");
    // Master shows the yearly value in 万, and the server sends the yuan text the column shows, so
    // the card prints 7,140,000.00 as 714 -- the unit is the only thing the page decides.
    expect(card(root, "客户年价值").querySelector("strong")!.textContent).toBe("¥714万");
    expect(JSON.parse(card(root, "客户总数").dataset.item!)).toMatchObject({ separator: "," });
  });

  it("measures 较上月 against where the count stood at the end of last month", async () => {
    const root = mount();
    await flush();

    // 1286 against 1200 is 7.166%, and the baseline is the row set the server named
    // `beforeThisMonth` -- not this month's additions over whatever the total happens to be now.
    expect(card(root, "客户总数").querySelector("em")!.textContent).toBe("+7.2%");
    expect(JSON.parse(card(root, "客户总数").dataset.item!).trendStatus).toBe("success");
    expect(card(root, "战略客户").querySelector("small")!.textContent).toBe("贡献 42% 收入");
    expect(card(root, "本月新增").querySelector("small")!.textContent).toBe("上月新增 25 家");
  });

  it("says so when there is nothing to compare a trend or a share against", async () => {
    get.mockImplementation(((path: string) =>
      path === "/customers/summary"
        ? { ...aggregate, beforeThisMonth: 0, annualValue: "0.00", strategicAnnualValue: "0.00" }
        : { ...list }) as never);
    const root = mount();
    await flush();

    // A first month has no last month to divide by, and customers who have not ordered yet have no
    // revenue to hold a share of: the cards say what is missing instead of printing +0% or NaN%.
    expect(card(root, "客户总数").querySelector("em")!.textContent).toBe("");
    expect(card(root, "客户总数").querySelector("small")!.textContent).toBe("上月末还没有客户");
    expect(card(root, "战略客户").querySelector("small")!.textContent).toBe("客户订单还没有收入");
    expect(card(root, "客户年价值").querySelector("strong")!.textContent).toBe("¥0万");
  });

  it("leaves the cards off the page and says why when the aggregate read fails", async () => {
    get.mockImplementation(((path: string) =>
      path === "/customers/summary"
        ? Promise.reject(new Error("请求失败：500"))
        : { ...list }) as never);
    const root = mount();
    await flush();

    expect(root.querySelectorAll(".stat")).toHaveLength(0);
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0][1]).toBe("客户统计加载失败");
    // The list is its own read: a missing aggregate cannot take the table down with it.
    expect(cell(root, "ownerName")).toBe("陈默");
  });

  it("refreshes the cards with the list after a new customer", async () => {
    post.mockResolvedValue({ id: "c3", name: "青屿网络科技", contact: "Nina" } as never);
    const root = mount();
    await flush();
    const saved = get.mock.calls.length;
    expect(callsTo("/customers/summary")).toBe(1);

    const save = [...root.querySelectorAll("button")].find((node) =>
      node.textContent?.includes("保存"),
    )!;
    const type = (label: string, value: string) => {
      const box = [...root.querySelectorAll<HTMLElement>(".form-item")].find(
        (node) => node.dataset.label === label,
      )!;
      const input = box.querySelector("input")!;
      input.value = value;
      input.dispatchEvent(new Event("input"));
    };

    // A drawer that says nothing about who the customer is gets refused before any request leaves,
    // and a refused save re-reads nothing.
    save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
    expect(post).not.toHaveBeenCalled();
    expect(get.mock.calls.length).toBe(saved);

    type("企业名称", "青屿网络科技");
    type("联系人", "Nina");
    save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    expect(post).toHaveBeenCalledWith(
      "/customers",
      expect.objectContaining({ name: "青屿网络科技", contact: "Nina" }),
    );
    // A row the operator just added belongs above the list as much as in it, so both reads happen:
    // a page that re-reads only the table leaves 客户总数 a customer short.
    expect(callsTo("/customers/summary")).toBe(2);
    expect(callsTo("/customers")).toBeGreaterThanOrEqual(2);
  });
});

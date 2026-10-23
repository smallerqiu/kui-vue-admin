import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Orders from "@/pages/(admin)/commerce/orders.vue";
import { message } from "kui-vue";
import request from "@/utils/request";
import { reportFailure } from "@/utils/report-failure";
import { flush } from "./filter-settle";
import { skeletonStub } from "./skeleton-stub";

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
  modal: { confirm: vi.fn() },
}));

const auth = reactive({ user: { permissions: ["*"] as string[] } });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const report = vi.mocked(reportFailure);

const customer = (over: Record<string, unknown> = {}) => ({
  id: "c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1",
  name: "星河云科",
  industry: "企业服务",
  level: "strategic",
  status: "active",
  contact: "林晓",
  phone: "13800000000",
  email: "buyer@example.test",
  city: "武汉",
  createdAt: "2026-09-01T08:00:00",
  updatedAt: "2026-10-01T08:00:00",
  ownerName: "陈默",
  orderCount: 3,
  annualValue: "30.30",
  lastContactAt: null,
  ...over,
});
const second = customer({
  id: "c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2c2",
  name: "青屿网络",
  contact: "周宁",
  phone: "13900000000",
  city: "杭州",
});
const flagship = product("p1", "旗舰路由", "R-1", "黑色", "1286.00", 12);
const switchProduct = product("p2", "接入交换机", "S-9", "24 口", "2330.50", 3);
function product(id: string, name: string, sku: string, specs: string, price: string, stock: number) {
  return {
    id: id.repeat(16).slice(0, 32),
    name,
    sku,
    category: "网络",
    specs,
    image: "",
    price,
    stock,
    enabled: true,
    updatedAt: "2026-10-01T08:00:00",
  };
}

const orderPage = {
  items: [
    {
      id: "a".repeat(32),
      customer: "星河云科",
      contact: "林晓",
      phone: "13800000000",
      paidAmount: "12345.00",
      status: "pending",
      paymentMethod: "",
      source: "admin",
      note: "",
      merchantRemark: "",
      createdAt: "2026-10-19T16:05:41",
      items: [],
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};
const summary = { today: 41, byStatus: { pending: 7, paid: 19 }, refundRequests: 3 };
const facets = { paymentMethods: ["bank-transfer"], sources: ["admin"], carriers: ["DHL"] };

// Kui's Table renders one named slot per column and prints the cell when a column has none, so the
// stub does the same; the drawer is the only part of this page the test drives, and it drives the
// controls a person sees rather than the page's own variables.
const tableStub = {
  props: ["data", "columns", "rowKey", "loading"],
  setup(
    props: any,
    { slots }: { slots: Record<string, (arg: { record: any; value: unknown }) => unknown> },
  ) {
    return () =>
      h(
        "div",
        { class: "table" },
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
      );
  },
};

// A box that is only open when the page says it is: Kui's Drawer destroys its panel on close, so an
// assertion on what the drawer holds has to be an assertion about a drawer that is actually showing.
const drawerStub = {
  props: ["modelValue", "title"],
  setup(
    props: any,
    { slots }: { slots: Record<string, () => unknown>; props: Record<string, unknown> },
  ) {
    return () =>
      h(
        "div",
        { class: "drawer", "data-open": String(Boolean(props.modelValue)), "data-title": props.title },
        props.modelValue
          ? [...Object.values(slots).map((slot: () => unknown) => slot())]
          : [],
      );
  },
};

const formItemStub = {
  props: ["label"],
  setup(props: any, { slots }: { slots: Record<string, () => unknown> }) {
    return () =>
      h("div", { class: "form-item", "data-label": props.label }, Object.values(slots).map((s) => s()));
  },
};

// Text boxes the test can type into and read back, including what they hold after a save the page
// refused: a draft that silently cleared itself would pass an assertion about the request alone.
const textField =
  (tag: string, type?: string) =>
  ({
    props: ["modelValue", "placeholder", "disabled"],
    emits: ["update:modelValue"],
    setup(
      props: any,
      { emit }: { emit: (event: string, value: unknown) => void },
    ) {
      return () =>
        h(tag, {
          class: type === undefined ? "stub-text" : "stub-text stub-number",
          type,
          value: String(props.modelValue ?? ""),
          onInput: (event: Event) => {
            const node = event.target as HTMLInputElement;
            emit("update:modelValue", type === "number" ? Number(node.value) : node.value);
          },
        });
    },
  });

// A picker that prints the rows it was handed, fires `search` the way Kui's Select does (with the
// input event, so the page reads the term off the box), and lets the test choose one of them.
const selectStub = {
  props: ["modelValue", "options", "placeholder", "loading", "emptyText"],
  emits: ["update:modelValue", "search"],
  setup(
    props: any,
    { emit }: { emit: (event: string, value: unknown) => void },
  ) {
    return () =>
      h(
        "div",
        {
          class: "select",
          "data-placeholder": props.placeholder,
          "data-loading": String(Boolean(props.loading)),
          "data-options": JSON.stringify(props.options),
          "data-value": props.modelValue ?? "",
        },
        [
          h("input", {
            class: "stub-search",
            value: "",
            onInput: (event: Event) => emit("search", event),
          }),
          ...(props.options ?? []).map((option: { label: string; value: string }) =>
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
        ],
      );
  },
};

const box =
  (name: string) =>
  ({
    props: [] as string[],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) => () =>
      h(name === "button" ? "button" : "div", { class: name }, [
        ...Object.values(slots).map((slot: () => unknown) => slot()),
      ]),
  });

const disposers: Array<() => void> = [];

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Orders);
  for (const name of [
    "Badge",
    "Button",
    "Card",
    "DatePicker",
    "Form",
    "Grid",
    "GridItem",
    "Icon",
    "Image",
    "ListPanel",
    "Page",
    "Space",
    "TableColumnSetting",
    "Tag",
  ])
    app.component(name, box(name.toLowerCase()) as never);
  app.component("Input", textField("input") as never);
  app.component("TextArea", textField("textarea") as never);
  app.component("InputNumber", textField("input", "number") as never);
  app.component("Drawer", drawerStub as never);
  app.component("FormItem", formItemStub as never);
  app.component("Select", selectStub as never);
  app.component("Table", tableStub as never);
  app.component("Skeleton", skeletonStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const field = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll<HTMLElement>(".form-item")].find(
    (node) => node.dataset.label === label,
  )!;
const lines = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(".draft-line")];
const textOf = (root: HTMLElement, label: string) =>
  field(root, label).querySelector(".stub-text")!.value;
const typeIn = (root: HTMLElement, label: string, value: string) => {
  const node = field(root, label).querySelector(".stub-text")!;
  node.value = value;
  node.dispatchEvent(new Event("input"));
};
const search = (node: HTMLElement, term: string) => {
  const box = node.querySelector(".stub-search") as HTMLInputElement;
  box.value = term;
  box.dispatchEvent(new Event("input"));
};
const optionsIn = (node: HTMLElement) =>
  JSON.parse(node.querySelector<HTMLElement>(".select")!.dataset.options || "[]");
const choose = (node: HTMLElement, label: string) => {
  const target = [...node.querySelectorAll<HTMLButtonElement>("button.option")].find(
    (button) => button.textContent?.trim() === label,
  )!;
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};
const shown = (node: HTMLElement) => node.querySelector<HTMLElement>(".select")!.dataset.value;
const lineMeta = (root: HTMLElement, index: number) =>
  lines(root)[index].querySelector(".draft-line-meta")?.textContent?.trim();
const estimate = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll<HTMLElement>(".draft-estimate div")]
    .find((node) => node.querySelector("dt")!.textContent === label)!
    .querySelector("dd")!.textContent!.trim();
const buttonNamed = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
    node.textContent?.includes(label),
  );
const click = (node: HTMLElement) => node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const drawer = (root: HTMLElement) => root.querySelector<HTMLElement>(".drawer")!;
const calls = (path: string) => get.mock.calls.filter(([url]) => url === path);

/** The picker's own first page, plus the order list the page asks for on mount. */
const answerAll = (products = [flagship, switchProduct], customers = [customer(), second]) => {
  get.mockImplementation(((url: string, params?: Record<string, unknown>) => {
    if (url === "/orders/summary") return Promise.resolve(summary);
    if (url === "/orders/facets") return Promise.resolve(facets);
    if (url === "/customers")
      return Promise.resolve({
        // The three columns `admin_api/resources.py::list_records` matches for a customer row --
        // 电话 and 邮箱 are not among them, so a harness that filtered on those would let a page
        // claim a search the deployed server cannot answer.
        items: customers.filter((row) =>
          [row.name, row.contact, row.city].some((value) =>
            String(value).includes(String(params?.keyword ?? "")),
          ),
        ),
        total: 1,
        page: 1,
        pageSize: 20,
      });
    if (url === "/products")
      return Promise.resolve({
        items: products.filter((row) =>
          [row.name, row.sku].some((value) =>
            String(value).includes(String(params?.keyword ?? "")),
          ),
        ),
        total: 1,
        page: 1,
        pageSize: 20,
      });
    return Promise.resolve(orderPage);
  }) as never);
};

/** Every box a complete draft needs, filled from the rows the pickers answered with. */
const fill = async (root: HTMLElement) => {
  choose(field(root, "客户"), "星河云科 · 武汉");
  await flush();
  typeIn(root, "收货地址", "武汉市洪山区光谷大道 1 号");
  choose(lines(root)[0], "旗舰路由 · 黑色 · R-1");
  await flush();
};

describe("order create drawer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    get.mockReset();
    post.mockReset();
    report.mockReset();
    message.success = vi.fn();
    message.warning = vi.fn();
    auth.user.permissions = ["*"];
    answerAll();
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    vi.useRealTimers();
  });

  it("shows 新建订单 only to an account the create endpoint would accept", async () => {
    auth.user.permissions = ["order:read"];
    const root = mount();
    await flush();
    expect(buttonNamed(root, "新建订单")).toBeUndefined();
    // The list itself is unaffected: reading orders was never the question.
    expect(cell(root, "paidAmount")).toContain("¥ 12,345.00");

    auth.user.permissions = ["order:read", "order:write"];
    await flush();
    expect(buttonNamed(root, "新建订单")).toBeTruthy();
  });

  it("opens on the rows the server offers, asked as the list pages ask them", async () => {
    const root = mount();
    await flush();
    expect(calls("/customers")).toHaveLength(0);
    expect(calls("/products")).toHaveLength(0);

    click(buttonNamed(root, "新建订单")!);
    await flush();

    // The customer box asks the customer page's question and the goods box asks the product page's,
    // including `enabled: true`: 上架/下架 is a column the products page writes and `POST /orders`
    // answers 404 for a product nobody is selling, so offering one would offer a line that cannot be
    // filed.
    expect(calls("/customers").at(-1)![1]).toEqual({ keyword: "", pageSize: 20 });
    expect(calls("/products").at(-1)![1]).toEqual({ keyword: "", enabled: true, pageSize: 20 });
    expect(optionsIn(field(root, "客户"))).toEqual([
      { label: "星河云科 · 武汉", value: customer().id },
      { label: "青屿网络 · 杭州", value: second.id },
    ]);
    expect(optionsIn(lines(root)[0])).toEqual([
      { label: "旗舰路由 · 黑色 · R-1", value: flagship.id },
      { label: "接入交换机 · 24 口 · S-9", value: switchProduct.id },
    ]);
  });

  it("offers the rows the server matched, even when the label does not repeat the term", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();

    // 联系人 is one of the three columns `/customers` searches (名称, 联系人, 城市) and it appears in no
    // option label. Re-filtering the answer locally -- the thing `filterable` does -- would drop the
    // customer the server just returned and make the row unfindable from the page that lists it.
    search(field(root, "客户"), "周宁");
    await flush();
    expect(calls("/customers").at(-1)![1]).toMatchObject({ keyword: "周宁" });
    expect(optionsIn(field(root, "客户"))).toEqual([
      { label: "青屿网络 · 杭州", value: second.id },
    ]);
  });

  it("fills the chosen customer's own contact and phone, and never over what was typed", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();

    choose(field(root, "客户"), "星河云科 · 武汉");
    await flush();
    expect(textOf(root, "联系人")).toBe("林晓");
    expect(textOf(root, "联系电话")).toBe("13800000000");

    // This order goes to a different person at the same customer, and the 联系人/联系电话 columns
    // belong to the order, not to the customer row: a second pick must not erase the name typed for
    // this delivery.
    typeIn(root, "联系人", "前台代收");
    choose(field(root, "客户"), "青屿网络 · 杭州");
    await flush();
    expect(textOf(root, "联系人")).toBe("前台代收");
    expect(textOf(root, "联系电话")).toBe("13800000000");
  });

  it("adds up the prices the rows were read with, in the money type the column holds", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();
    await fill(root);

    // The two figures the server decides with, printed for the row the box just read: 库存 is what a
    // 409 不足库存 refusal is about, and 标价 is what the preview below is adding up.
    expect(lineMeta(root, 0)).toBe("¥1,286.00 · 库存 12 件");

    // 1286.00 × 2 + 10.00 − 0.30. Money arrives as decimal text, so the drawer's own sum is taken in
    // `Big`; a float pass would still print this one, which is why the cent below is the second half
    // of the assertion.
    (lines(root)[0].querySelector(".stub-number") as HTMLInputElement).value = "2";
    lines(root)[0].querySelector(".stub-number")!.dispatchEvent(new Event("input"));
    typeIn(root, "运费", "10.00");
    typeIn(root, "优惠", "0.30");
    await flush();
    expect(estimate(root, "商品金额（预估）")).toBe("¥2,572.00");
    expect(estimate(root, "实付金额（预估）")).toBe("¥2,581.70");

    // A box holding something nobody could have meant stops the preview rather than rounding it: the
    // number on screen has to be a number somebody typed.
    typeIn(root, "运费", "10,00");
    await flush();
    expect(estimate(root, "实付金额（预估）")).toBe("金额格式有误");

    // The same box is why 保存 refuses: `Money` would reject it as "Invalid request", and the
    // operator has to be told which of the two boxes they typed a comma into.
    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenLastCalledWith("运费与优惠须为非负金额，最多两位小数");
  });

  it("sends exactly the columns the create endpoint takes", async () => {
    post.mockResolvedValue({ ...orderPage.items[0], paidAmount: "2572.00" } as never);
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();
    await fill(root);
    (lines(root)[0].querySelector(".stub-number") as HTMLInputElement).value = "2";
    lines(root)[0].querySelector(".stub-number")!.dispatchEvent(new Event("input"));
    click(buttonNamed(root, "保存")!);
    await flush();

    // Eight keys, no more: 状态, 订单来源 and 支付方式 are not among them -- they start at their
    // column defaults and are written later from the detail page -- so a draft that tried to send one
    // would be a body the API refuses with "Invalid request".
    expect(post).toHaveBeenCalledTimes(1);
    const [path, body] = post.mock.calls[0]!;
    expect(path).toBe("/orders");
    expect(Object.keys(body).sort()).toEqual([
      "address",
      "contact",
      "customerId",
      "discount",
      "freight",
      "items",
      "note",
      "phone",
    ]);
    expect(body).toEqual({
      customerId: customer().id,
      contact: "林晓",
      phone: "13800000000",
      address: "武汉市洪山区光谷大道 1 号",
      items: [{ productId: flagship.id, quantity: 2 }],
      // A money box nobody typed in is the column's own default, not a blank to be guessed at.
      freight: "0.00",
      discount: "0.00",
      note: "",
    });
    // Nothing on a line but what the operator chose: the price comes off the product row the server
    // locks, so the 标价 and 库存 read for the label have no business in the body.
    expect(body.items[0]).not.toHaveProperty("price");
    expect(body.items[0]).not.toHaveProperty("stock");
  });

  it("refuses an incomplete draft before anything leaves the page", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();

    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenCalledWith("请选择客户");

    choose(field(root, "客户"), "星河云科 · 武汉");
    await flush();
    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenLastCalledWith("请填写联系人、联系电话和收货地址");

    typeIn(root, "收货地址", "武汉市洪山区光谷大道 1 号");
    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenLastCalledWith("请为每一行选择商品");
    // A draft that has not been filled is not a saved order: the list and the cards are not asked
    // again for a row that does not exist.
    expect(calls("/orders")).toHaveLength(1);
  });

  it("refuses two lines for one product and an order whose discount is larger than its total", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();
    await fill(root);

    click(buttonNamed(root, "添加一件商品")!);
    await flush();
    choose(lines(root)[1], "旗舰路由 · 黑色 · R-1");
    await flush();
    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).not.toHaveBeenCalled();
    // The server's rule, said in the words the operator can act on: 400 otherwise answers "Each
    // product must appear only once" for a form they have already submitted.
    expect(message.warning).toHaveBeenLastCalledWith("同一个商品只能出现在一行，请把数量合并");

    // The second line takes the other product, and the discount is set above goods plus freight.
    choose(lines(root)[1], "接入交换机 · 24 口 · S-9");
    await flush();
    typeIn(root, "优惠", "99999.00");
    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenLastCalledWith("优惠不能超过商品金额加运费");

    typeIn(root, "优惠", "0.30");
    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("names the box the create schema would refuse for length", async () => {
    post.mockResolvedValue(orderPage.items[0] as never);
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();
    await fill(root);

    // A pasted 客户备注 is where this happens in practice, and the request layer can only answer an
    // over-long box with "Invalid request" plus a column name -- `maxlength` on the control would be
    // worse still, because the paste would stop existing without saying so.
    typeIn(root, "联系人", "客".repeat(121));
    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).not.toHaveBeenCalled();
    expect(message.warning).toHaveBeenLastCalledWith("联系人不能超过 120 字");

    typeIn(root, "联系人", "林晓");
    click(buttonNamed(root, "保存")!);
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("keeps the draft and says the server's own sentence when the order is refused", async () => {
    post.mockRejectedValue(new Error("Insufficient stock") as never);
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();
    await fill(root);
    const reads = calls("/orders").length;

    click(buttonNamed(root, "保存")!);
    await flush();

    // Stock is the server's answer under a row lock, so this is the one refusal an operator cannot
    // see coming from the screen -- and the only thing they can do about it is change a line.
    expect(report).toHaveBeenCalledWith(expect.any(Error), "下单失败");
    expect(report.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(report.mock.calls[0][0]!.message).toBe("Insufficient stock");
    expect(message.success).not.toHaveBeenCalled();
    expect(drawer(root).dataset.open).toBe("true");
    expect(textOf(root, "收货地址")).toBe("武汉市洪山区光谷大道 1 号");
    expect(shown(lines(root)[0])).toBe(flagship.id);
    expect(calls("/orders")).toHaveLength(reads);
  });

  it("closes, re-reads both reads, and quotes the total the server computed", async () => {
    post.mockResolvedValue({ ...orderPage.items[0], paidAmount: "2581.70" } as never);
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();
    await fill(root);
    (lines(root)[0].querySelector(".stub-number") as HTMLInputElement).value = "2";
    lines(root)[0].querySelector(".stub-number")!.dispatchEvent(new Event("input"));
    typeIn(root, "运费", "10.00");
    typeIn(root, "优惠", "0.30");
    click(buttonNamed(root, "保存")!);
    await flush();

    expect(drawer(root).dataset.open).toBe("false");
    // The receipt is the server's arithmetic off the rows it locked, not the preview above: the
    // fixture's answer is a different number from the one the drawer was showing.
    expect(message.success).toHaveBeenCalledWith("订单已创建，实付 ¥2,581.70");
    // The new row belongs above the list and the 待付款 card, so both reads happen.
    expect(calls("/orders")).toHaveLength(2);
    expect(calls("/orders/summary")).toHaveLength(2);
  });

  it("opens a fresh drawer for the next order", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();
    await fill(root);
    typeIn(root, "客户备注", "上次的单子");
    click(buttonNamed(root, "取消")!);
    await flush();
    expect(drawer(root).dataset.open).toBe("false");

    click(buttonNamed(root, "新建订单")!);
    await flush();
    expect(shown(field(root, "客户"))).toBe("");
    expect(textOf(root, "收货地址")).toBe("");
    expect(textOf(root, "联系人")).toBe("");
    expect(textOf(root, "客户备注")).toBe("");
    expect(lines(root)).toHaveLength(1);
    expect(shown(lines(root)[0])).toBe("");
  });

  it("keeps the newest search when an older answer arrives late", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();

    // Both boxes debounce typing on their own, which does not order the two requests they send: the
    // late answer would replace the rows the fresh one fetched, and leave the box holding a product
    // the operator has already typed out of the list.
    const arrive: Array<(value: unknown) => void> = [];
    get.mockImplementation(((url: string) =>
      url === "/products"
        ? new Promise((resolve) => {
            arrive.push(resolve);
          })
        : Promise.resolve(url === "/orders/summary" ? summary : facets)) as never);
    const line = lines(root)[0];
    search(line, "旗舰");
    await flush();
    search(line, "交换");
    await flush();
    expect(arrive).toHaveLength(2);

    arrive[1]!({ items: [switchProduct], total: 1, page: 1, pageSize: 20 });
    await flush();
    expect(optionsIn(line)).toEqual([{ label: "接入交换机 · 24 口 · S-9", value: switchProduct.id }]);
    arrive[0]!({ items: [flagship], total: 1, page: 1, pageSize: 20 });
    await flush();
    expect(optionsIn(line)).toEqual([{ label: "接入交换机 · 24 口 · S-9", value: switchProduct.id }]);
    expect(line.querySelector<HTMLElement>(".select")!.dataset.loading).toBe("false");
  });

  it("keeps the newest customer search when an older answer arrives late", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新建订单")!);
    await flush();

    // The customer box debounces typing on its own, the same as the product boxes, so the two
    // requests it sends can still cross -- and the answer that lands last would be a list of
    // customers the operator has already typed away from, sitting in a box they can still pick from.
    const arrive: Array<(value: unknown) => void> = [];
    get.mockImplementation(((url: string) =>
      url === "/customers"
        ? new Promise((resolve) => {
            arrive.push(resolve);
          })
        : Promise.resolve(url === "/orders/summary" ? summary : facets)) as never);
    const picker = field(root, "客户");
    search(picker, "星河");
    await flush();
    search(picker, "青屿");
    await flush();
    expect(arrive).toHaveLength(2);

    arrive[1]!({ items: [second], total: 1, page: 1, pageSize: 20 });
    await flush();
    expect(optionsIn(picker)).toEqual([{ label: "青屿网络 · 杭州", value: second.id }]);
    arrive[0]!({ items: [customer()], total: 1, page: 1, pageSize: 20 });
    await flush();
    expect(optionsIn(picker)).toEqual([{ label: "青屿网络 · 杭州", value: second.id }]);
    expect(picker.querySelector<HTMLElement>(".select")!.dataset.loading).toBe("false");
  });
});

const cell = (root: HTMLElement, key: string, row = 0) =>
  Array.from(root.querySelectorAll(`.cell-${key}`))[row]?.textContent?.trim();

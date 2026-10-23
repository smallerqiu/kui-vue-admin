import { createApp, defineComponent, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrderDetail from "@/pages/(admin)/order/[id].vue";
import { commerceApi, hasFreight, type OrderRecord } from "@/api/commerce";
import { message } from "kui-vue";
import { skeletonStub } from "./skeleton-stub";

const route = reactive({ params: { id: "one" }, path: "/order/one" });
vi.mock("vue-router", () => ({ useRoute: () => route, useRouter: () => ({ back: vi.fn() }) }));
// Icons are presentation-only; isolate these workflow tests from their Node entry point.
vi.mock("kui-icons", () => ({
  ArrowLeft: [],
  CircleCheck: [],
  Clock: [],
  RotateCcw: [],
  Truck: [],
}));
vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({ user: { permissions: ["*"] } }) }));
// The page's 运费 cell asks the module's own `hasFreight`, so the mock keeps the real one and only
// stubs the api object: a fixture that answered the zero question for itself would test nothing.
vi.mock("@/api/commerce", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("@/api/commerce");
  return {
    ...actual,
    commerceApi: { detail: vi.fn(), action: vi.fn(), afterSale: vi.fn() },
  };
});
vi.mock("kui-vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    PageHeader: defineComponent({
      props: ["title"],
      setup:
        (props, { slots }) =>
        () =>
          h("header", [props.title, slots.actions?.()]),
    }),
    message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
    modal: { confirm: vi.fn() },
  };
});
const disposers: (() => void)[] = [];
const order = (id: string): OrderRecord => ({
  id,
  customer: "Real customer",
  customerId: "customer",
  contact: "Alice",
  phone: "123",
  address: "Address",
  goodsAmount: "10.10",
  freight: "0.00",
  discount: "0.00",
  paidAmount: "10.10",
  refundedAmount: "0.00",
  status: "pending",
  createdAt: "2026-09-28",
  paymentAt: null,
  paymentMethod: "",
  source: "manual",
  note: "",
  merchantRemark: "",
  items: [],
  shipments: [],
});
const flush = async () => {
  await Promise.resolve();
  await nextTick();
  await Promise.resolve();
  await nextTick();
};
// Kui's `Steps` takes its items through a prop, so a stub that ignored props would hide every date on
// the row. Each item renders as its own pair of nodes: the two other timestamps on this page
// (订单信息 and 发货记录) print the same strings, so a test has to read the description out of the
// step it belongs to rather than out of the page.
const stepsStub = defineComponent({
  props: ["current", "status", "items"],
  setup:
    (props) =>
    () =>
      h(
        "div",
        { class: "steps", "data-current": String(props.current ?? 0) },
        ((props.items ?? []) as { title: string; description?: string }[]).map((item) =>
          h("div", { class: "step" }, [
            h("span", { class: "step-title" }, item.title),
            h("span", { class: "step-description" }, item.description ?? ""),
          ]),
        ),
      ),
});
function stepDescription(root: HTMLElement, title: string) {
  const step = [...root.querySelectorAll(".step")].find(
    (el) => el.querySelector(".step-title")?.textContent === title,
  );
  return step?.querySelector(".step-description")?.textContent ?? null;
}
function mount() {
  const app = createApp(OrderDetail);
  const container = document.createElement("div");
  const box = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h("div", slots.default?.()),
  });
  for (const name of [
    "Grid",
    "GridItem",
    "Card",
    "Flex",
    "Space",
    "Icon",
    "Tag",
    "Image",
    "Descriptions",
    "DescriptionsItem",
    "Avatar",
    "Divider",
    "Form",
    "FormItem",
    "RadioGroup",
    "CheckboxGroup",
    "Select",
  ])
    app.component(name, box);
  app.component("Steps", stepsStub as never);
  app.component("Skeleton", skeletonStub as never);
  app.component(
    "Button",
    defineComponent({
      props: ["disabled", "loading"],
      setup:
        (props, { slots }) =>
        () =>
          h("button", { disabled: props.disabled || props.loading }, slots.default?.()),
    }),
  );
  const dialog = defineComponent({
    props: ["modelValue", "title"],
    setup:
      (props, { slots }) =>
      () =>
        props.modelValue
          ? h("section", { "data-dialog": props.title }, [slots.default?.(), slots.footer?.()])
          : null,
  });
  app.component("Modal", dialog);
  app.component("Drawer", dialog);
  const input = defineComponent({
    props: ["modelValue"],
    emits: ["update:modelValue"],
    setup:
      (props, { emit }) =>
      () =>
        h("input", {
          value: props.modelValue,
          onInput: (e: Event) => emit("update:modelValue", (e.target as HTMLInputElement).value),
        }),
  });
  app.component("Input", input);
  app.component("TextArea", input);
  app.component("InputNumber", input);
  app.mount(container);
  disposers.push(() => app.unmount());
  return container;
}
describe("order detail integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    route.params.id = "one";
    route.path = "/order/one";
  });
  afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));
  it("keeps the page shape while the first read is in flight", async () => {
    let arrive!: (value: OrderRecord) => void;
    vi.mocked(commerceApi.detail).mockReturnValueOnce(
      new Promise((done) => {
        arrive = done;
      }),
    );
    const root = mount();
    await flush();
    // The frame is the loaded layout: a status band over three panels and two.
    expect(root.querySelectorAll(".skeleton").length).toBe(6);
    expect(root.querySelectorAll(".skeleton-line").length).toBe(6);
    // Nothing on the frame reads as a result: no amount, no customer, no status.
    expect(root.textContent).not.toContain("¥");
    expect(root.textContent).not.toContain("Real customer");
    expect(root.textContent).not.toContain("待付款");

    arrive(order("one"));
    await flush();
    expect(root.querySelectorAll(".skeleton-line").length).toBe(0);
    expect(root.textContent).toContain("¥ 10.10");
    expect(root.textContent).toContain("Real customer");
  });
  it("shows missing-order errors, not the first order", async () => {
    vi.mocked(commerceApi.detail).mockRejectedValueOnce(new Error("Order not found"));
    const root = mount();
    await flush();
    expect(root.textContent).toContain("Order not found");
    expect(root.textContent).not.toContain("Real customer");
    // A refused read shows its sentence, not a frame still pretending to wait.
    expect(root.querySelectorAll(".skeleton-line").length).toBe(0);
  });
  it("ignores a delayed response after the route changes", async () => {
    let resolve!: (value: OrderRecord) => void;
    vi.mocked(commerceApi.detail).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const root = mount();
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(order("two"));
    route.params.id = "two";
    route.path = "/order/two";
    await flush();
    resolve(order("one"));
    await flush();
    expect(root.textContent).toContain("订单 two");
    expect(root.textContent).not.toContain("订单 one");
  });
  it("keeps payment input and avoids success when the API fails", async () => {
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(order("one"));
    vi.mocked(commerceApi.action).mockRejectedValueOnce(new Error("Payment conflict"));
    const root = mount();
    await flush();
    [...root.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "登记收款")!
      .click();
    await nextTick();
    const input = root.querySelector("section input") as HTMLInputElement;
    input.value = "bank-transfer";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    [...root.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "确认已收款并登记")!
      .click();
    await flush();
    expect(commerceApi.action).toHaveBeenCalledWith("one", "payment", { method: "bank-transfer" });
    expect(root.querySelector("section")).not.toBeNull();
    expect(message.success).not.toHaveBeenCalled();
    // A refused transition explains itself through the server's sentence, which the
    // request layer does not announce for 4xx responses.
    expect(message.error).toHaveBeenCalledWith("Payment conflict");
    expect((root.querySelector("section input") as HTMLInputElement).value).toBe("bank-transfer");
  });
  it("shows amounts in groups while the price dialog still works on the flat figure", async () => {
    // Two shapes of the same number are needed here at once: the operator reads 1,234,567.89,
    // while the dialog's own guard parses the preview with `new Big(...)`. Grouping inside the
    // computed would make that throw, which refuses a discount the server would have accepted.
    const amounts: OrderRecord = {
      ...order("one"),
      goodsAmount: "1234567.89",
      freight: "1000.00",
      discount: "0.00",
      paidAmount: "1234567.89",
      refundedAmount: "0.00",
    };
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(amounts);
    vi.mocked(commerceApi.action).mockResolvedValueOnce(amounts);
    const root = mount();
    await flush();
    expect(root.textContent).toContain("¥ 1,234,567.89");
    expect(root.textContent).not.toContain("1234567.89");

    [...root.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "调整价格")!
      .click();
    await nextTick();
    const input = root.querySelector("section input") as HTMLInputElement;
    input.value = "2345.67";
    input.dispatchEvent(new Event("input"));
    await nextTick();
    // 商品 1234567.89 + 运费 1000.00 − 优惠 2345.67.
    expect(root.textContent).toContain("¥ 1,233,222.22");

    [...root.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "确认提交")!
      .click();
    await flush();
    expect(commerceApi.action).toHaveBeenCalledWith("one", "adjust", { discount: "2345.67" });
    expect(message.warning).not.toHaveBeenCalled();
    expect(message.success).toHaveBeenCalledWith("操作已保存");
  });
  it("puts the first box's departure on 商品出库", async () => {
    // Two shipments because the page has to pick one, and one box is not a date: the row names the
    // moment goods went out, which is the earliest shipment the server lists.
    const shipped: OrderRecord = {
      ...order("one"),
      status: "shipped",
      paymentAt: "2026-09-28T09:00:00",
      shipments: [
        {
          id: "s1",
          company: "顺丰速运",
          trackingNo: "SF1",
          createdAt: "2026-09-29T10:00:00",
          items: [],
        },
        {
          id: "s2",
          company: "顺丰速运",
          trackingNo: "SF2",
          createdAt: "2026-09-30T08:30:00",
          items: [],
        },
      ],
    };
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(shipped);
    const root = mount();
    await flush();
    expect(stepDescription(root, "商品出库")).toBe("2026-09-29 10:00");
    // Nothing on the order says when the customer signed for the goods, so the last step stays empty
    // rather than borrowing a timestamp that any edit would move.
    expect(stepDescription(root, "确认收货")).toBe("");
  });
  it("leaves 商品出库 without a date until a box ships", async () => {
    // The default fixture ships nothing: an empty array is truthy, so reading the first element
    // without asking would throw here instead of leaving the row blank.
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(order("one"));
    const root = mount();
    await flush();
    expect(stepDescription(root, "商品出库")).toBe("");
  });
  it("writes 免运费 for the order that pays no freight", async () => {
    // The freight the server sends is the string "0.00", which is truthy: the label already says
    // 运费, so a cell that costs nothing is only free if something compares the figure instead of
    // asking whether characters exist.
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(order("one"));
    const root = mount();
    await flush();
    const cell = [...root.querySelectorAll("span")].find((el) => el.textContent?.includes("运费"));
    expect(cell?.querySelector("strong")?.textContent).toBe("免运费");
  });
  it("prices the freight an order does pay", async () => {
    const paid: OrderRecord = { ...order("one"), freight: "1234.50" };
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(paid);
    const root = mount();
    await flush();
    const cell = [...root.querySelectorAll("span")].find((el) => el.textContent?.includes("运费"));
    expect(cell?.querySelector("strong")?.textContent).toBe("¥ 1,234.50");
  });
  it("reads a zero freight in whatever shape the column writes it", () => {
    // `0`, `0.00` and an empty cell are the same order; matching the literal string would make the
    // page disagree with itself the moment the column is written with fewer decimals.
    expect([hasFreight("0"), hasFreight("0.00"), hasFreight(""), hasFreight("12.00")]).toEqual([
      false,
      false,
      false,
      true,
    ]);
  });
});

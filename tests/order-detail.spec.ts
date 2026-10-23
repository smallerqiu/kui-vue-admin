import { createApp, defineComponent, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrderDetail from "@/pages/(admin)/order/[id].vue";
import { commerceApi, hasFreight, type OrderRecord } from "@/api/commerce";
import { message, modal } from "kui-vue";
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
    commerceApi: { detail: vi.fn(), action: vi.fn(), afterSale: vi.fn(), facets: vi.fn() },
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
  receivedAt: null,
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
  // Kui's AutoComplete is the shape this dialog needs: the server's own carrier names are offered
  // and a name nobody has filed yet is still typed. Both halves are rendered so a test can pick a
  // suggestion or type past all of them.
  app.component(
    "AutoComplete",
    defineComponent({
      props: ["modelValue", "options", "placeholder", "loading"],
      emits: ["update:modelValue"],
      setup:
        (props, { emit }) =>
        () =>
          h(
            "div",
            {
              class: "autocomplete",
              "data-placeholder": props.placeholder,
              "data-options": JSON.stringify(props.options ?? []),
              "data-loading": String(Boolean(props.loading)),
            },
            [
              h("input", {
                class: "autocomplete-input",
                value: props.modelValue ?? "",
                onInput: (event: Event) =>
                  emit("update:modelValue", (event.target as HTMLInputElement).value),
              }),
              ...((props.options ?? []) as string[]).map((value) =>
                h(
                  "button",
                  {
                    type: "button",
                    class: "option",
                    onClick: () => emit("update:modelValue", value),
                  },
                  value,
                ),
              ),
            ],
          ),
    }),
  );
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
  it("signs for an order once every box is out", async () => {
    // `completed` is a status the page has always shown, and until the server had a receipt column
    // nothing could put an order there: the furthest a button could take one was `shipped`.
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
      ],
    };
    const signed: OrderRecord = { ...shipped, status: "completed", receivedAt: "2026-10-01T15:20:00" };
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(shipped);
    vi.mocked(commerceApi.action).mockResolvedValueOnce(signed);
    const root = mount();
    await flush();
    expect(stepDescription(root, "确认收货")).toBe("");
    [...root.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "确认收货")!
      .click();
    await flush();
    // Closing out a transaction is confirmed rather than fired on a click, then answered by the
    // server's own row -- the page never writes the status or the time itself.
    const confirm = vi.mocked(modal.confirm).mock.calls.at(-1)![0] as { onOk: () => void };
    expect(vi.mocked(modal.confirm).mock.calls.length).toBe(1);
    confirm.onOk();
    await flush();
    expect(commerceApi.action).toHaveBeenCalledWith("one", "receive", undefined);
    expect(stepDescription(root, "确认收货")).toBe("2026-10-01 15:20");
    expect(root.textContent).toContain("2026-10-01 15:20");
    // A signed-for order offers no second receipt, because the server refuses one.
    expect(
      [...root.querySelectorAll("button")].some((button) => button.textContent?.includes("确认收货")),
    ).toBe(false);
  });
  it("keeps the step blank when the server refuses the receipt", async () => {
    const shipped: OrderRecord = {
      ...order("one"),
      status: "shipped",
      shipments: [
        {
          id: "s1",
          company: "顺丰速运",
          trackingNo: "SF1",
          createdAt: "2026-09-29T10:00:00",
          items: [],
        },
      ],
    };
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(shipped);
    vi.mocked(commerceApi.action).mockRejectedValueOnce(
      new Error("Only a fully shipped order can be received"),
    );
    const root = mount();
    await flush();
    [...root.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "确认收货")!
      .click();
    await flush();
    vi.mocked(modal.confirm).mock.calls.at(-1)![0]!.onOk();
    await flush();
    // Refused: nothing moved, the row stays as the server last described it, and its sentence is
    // the explanation -- which also means no timestamp appeared on the step.
    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith("Only a fully shipped order can be received");
    expect(stepDescription(root, "确认收货")).toBe("");
    expect(stepDescription(root, "商品出库")).toBe("2026-09-29 10:00");
  });
  it("says 尚未签收 for an order closed out before the column existed", async () => {
    // A `completed` row imported before `received_at` was added really is completed and really has
    // no receipt time: the cell has to separate "nobody wrote one" from "this order is not done".
    const legacy: OrderRecord = { ...order("one"), status: "completed", receivedAt: null };
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(legacy);
    const root = mount();
    await flush();
    expect(stepDescription(root, "确认收货")).toBe("");
    expect(root.textContent).toContain("尚未签收");
    expect(
      [...root.querySelectorAll("button")].some((button) => button.textContent?.includes("确认收货")),
    ).toBe(false);
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

  // A box only goes out of an order that is paid and not yet fully shipped, and the dialog needs an
  // item with something left to send: `openShipping` pre-fills the quantity to ship from what is
  // outstanding, so an order with no items has nothing to put in the shipment.
  const shippable = (): OrderRecord => ({
    ...order("one"),
    status: "paid",
    paymentAt: "2026-09-28T09:00:00",
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
  });
  const shipDialog = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>("section")].find(
      (node) => node.dataset.dialog === "订单发货",
    )!;
  const shipCarrier = (root: HTMLElement) =>
    shipDialog(root).querySelector<HTMLInputElement>(".autocomplete-input")!;
  const shipTracking = (root: HTMLElement) =>
    [...shipDialog(root).querySelectorAll<HTMLInputElement>("input")].find(
      (node) => !node.classList.contains("autocomplete-input"),
    )!;
  const shipButton = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>("button")].find(
      (node) => node.textContent?.trim() === label,
    )!;
  const write = (field: HTMLInputElement, value: string) => {
    field.value = value;
    field.dispatchEvent(new Event("input"));
  };

  it("suggests the carriers that already have boxes out, and takes a name that does not", async () => {
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(shippable());
    vi.mocked(commerceApi.facets).mockResolvedValue({
      paymentMethods: [],
      sources: [],
      carriers: ["EMS", "顺丰速运"],
    });
    // The answer keeps the order shipable, because the dialog is re-opened to prove the read happens
    // again rather than once per page.
    vi.mocked(commerceApi.action).mockResolvedValue(shippable());
    const root = mount();
    await flush();

    // An order that is not awaiting a box has no use for the carrier list, so the read waits for the
    // dialog instead of costing the page a round trip on open.
    expect(commerceApi.facets).not.toHaveBeenCalled();

    shipButton(root, "订单发货").click();
    await flush();
    expect(commerceApi.facets).toHaveBeenCalledTimes(1);
    const field = shipCarrier(root);
    const box = shipDialog(root).querySelector<HTMLElement>(".autocomplete")!;
    // The names are the ones shipments were actually filed under, in the server's own order, and
    // this page keeps no copy of a courier list: a warehouse that starts using one is a name nobody
    // here would have thought to add.
    expect(JSON.parse(box.dataset.options!)).toEqual(["EMS", "顺丰速运"]);
    // No carrier is pre-selected. The last box went with whatever the warehouse typed and that says
    // nothing about the next one, so a default here is a guess written into a shipment row.
    expect(field.value).toBe("");

    write(field, "UPS");
    write(shipTracking(root), "1Z999");
    shipButton(root, "确认提交").click();
    await flush();
    expect(commerceApi.action).toHaveBeenCalledWith("one", "ship", {
      company: "UPS",
      trackingNo: "1Z999",
      quantities: { i1: 2 },
    });

    // Re-opening reads again: a carrier this dialog just typed is a name the next box should be
    // offered, which a once-per-page read could not know.
    shipButton(root, "订单发货").click();
    await flush();
    expect(commerceApi.facets).toHaveBeenCalledTimes(2);
  });

  it("writes the carrier exactly as the server named it when a suggestion is picked", async () => {
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(shippable());
    vi.mocked(commerceApi.facets).mockResolvedValue({
      paymentMethods: [],
      sources: [],
      carriers: ["EMS", "顺丰速运"],
    });
    vi.mocked(commerceApi.action).mockResolvedValueOnce(shippable());
    const root = mount();
    await flush();
    shipButton(root, "订单发货").click();
    await flush();

    // Picking is not choosing a code the page maps back to a name: what lands in the shipment row is
    // the same string the earlier boxes carry, which is what keeps the next read offering it.
    [...shipDialog(root).querySelectorAll<HTMLButtonElement>("button.option")]
      .find((node) => node.textContent?.trim() === "顺丰速运")!
      .click();
    await flush();
    expect(shipCarrier(root).value).toBe("顺丰速运");
    write(shipTracking(root), "SF-77");
    shipButton(root, "确认提交").click();
    await flush();
    expect(commerceApi.action).toHaveBeenCalledWith("one", "ship", {
      company: "顺丰速运",
      trackingNo: "SF-77",
      quantities: { i1: 2 },
    });
  });

  it("still ships the box when the carrier candidates cannot be read", async () => {
    vi.mocked(commerceApi.detail).mockResolvedValueOnce(shippable());
    vi.mocked(commerceApi.facets).mockRejectedValue(new Error("候选接口暂不可用"));
    vi.mocked(commerceApi.action).mockResolvedValueOnce(shippable());
    const root = mount();
    await flush();
    shipButton(root, "订单发货").click();
    await flush();

    // An empty suggestion list is not the server saying no carrier exists, so the refusal is said
    // out loud -- and it cannot be allowed to stop a shipment, because the name was always typed
    // rather than chosen.
    expect(message.error).toHaveBeenCalledWith("候选接口暂不可用");
    expect(JSON.parse(shipDialog(root).querySelector<HTMLElement>(".autocomplete")!.dataset.options!)).toEqual([]);
    write(shipCarrier(root), "EMS");
    write(shipTracking(root), "EM-3");
    shipButton(root, "确认提交").click();
    await flush();
    expect(commerceApi.action).toHaveBeenCalledWith("one", "ship", {
      company: "EMS",
      trackingNo: "EM-3",
      quantities: { i1: 2 },
    });
    expect(message.warning).not.toHaveBeenCalled();
  });
});

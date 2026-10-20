import { createApp, defineComponent, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OrderDetail from "@/pages/(admin)/order/[id].vue";
import { commerceApi, type OrderRecord } from "@/api/commerce";
import { message } from "kui-vue";

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
vi.mock("@/api/commerce", () => ({
  commerceApi: { detail: vi.fn(), action: vi.fn(), afterSale: vi.fn() },
}));
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
    "Steps",
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
  it("shows missing-order errors, not the first order", async () => {
    vi.mocked(commerceApi.detail).mockRejectedValueOnce(new Error("Order not found"));
    const root = mount();
    await flush();
    expect(root.textContent).toContain("Order not found");
    expect(root.textContent).not.toContain("Real customer");
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
});

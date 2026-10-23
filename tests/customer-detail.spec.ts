import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomerDetail from "@/pages/(admin)/customer/[id].vue";
import request from "@/utils/request";
import { reportFailure } from "@/utils/report-failure";
import { skeletonStub } from "./skeleton-stub";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/utils/report-failure", () => ({ reportFailure: vi.fn() }));
vi.mock("kui-icons", () => ({ ArrowLeft: [], Building2: [] }));

const route = reactive({ params: { id: "c1" }, path: "/customer/c1" });
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

const auth = reactive({ user: { permissions: ["*"] as string[] } });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("header", [slots.default?.(), slots.actions?.()]),
  },
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const get = vi.mocked(request.get);
const put = vi.mocked(request.put);
const report = vi.mocked(reportFailure);

// The row as the detail endpoint answers it: the eight columns a person may write, and the four the
// server works out -- whose customer this is, and what the orders pointing back at it add up to. The
// derived half is what a form must never send back.
const row = {
  id: "c1",
  name: "星河云科",
  industry: "企业服务",
  level: "strategic",
  status: "active",
  contact: "林晓",
  phone: "13800000000",
  email: "lin@example.test",
  city: "武汉",
  createdAt: "2026-09-01T08:00:00",
  updatedAt: "2026-10-01T08:00:00",
  ownerName: "陈默",
  orderCount: 3,
  annualValue: "30.30",
  lastContactAt: "2026-10-19T16:05:41",
};

const box =
  (name: string) =>
  ({
    props: [] as string[],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) => () =>
      h(name === "button" ? "button" : "div", { class: name }, [
        ...Object.values(slots).map((slot) => slot()),
      ]),
  });

const formItemStub = {
  props: ["label"],
  setup(props: any, { slots }: { slots: Record<string, () => unknown> }) {
    return () =>
      h(
        "div",
        { class: "form-item", "data-label": props.label },
        Object.values(slots).map((slot) => slot()),
      );
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
// Both editable codes are fixed sets the server answers with a 400 outside, so the stub prints the
// options it was handed and the value it is showing: the case for the write is about which code the
// body carries, and a Select the test cannot read would let a wrong key through.
const selectStub = {
  props: ["modelValue", "options"],
  emits: ["update:modelValue"],
  setup(props: any, { emit }: { emit: (event: string, value: unknown) => void }) {
    return () =>
      h(
        "div",
        {
          class: "select",
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
  const app = createApp(CustomerDetail);
  for (const name of [
    "Button",
    "Card",
    "Divider",
    "Form",
    "Grid",
    "GridItem",
    "Icon",
    "Space",
    "Tag",
  ]) {
    app.component(name, box(name.toLowerCase()) as never);
  }
  app.component("Input", inputStub as never);
  app.component("FormItem", formItemStub as never);
  app.component("Select", selectStub as never);
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
const typed = (root: HTMLElement, label: string) => field(root, label).querySelector("input")!.value;
const type = (root: HTMLElement, label: string, value: string) => {
  const input = field(root, label).querySelector("input")!;
  input.value = value;
  input.dispatchEvent(new Event("input"));
};
const codeShown = (root: HTMLElement, label: string) =>
  field(root, label).querySelector<HTMLElement>(".select")!.dataset.value;
const codesOffered = (root: HTMLElement, label: string) =>
  field(root, label).querySelector<HTMLElement>(".select")!.dataset.options;
const pick = (root: HTMLElement, label: string, optionLabel: string) => {
  const button = [...field(root, label).querySelectorAll<HTMLButtonElement>("button.option")].find(
    (node) => node.textContent?.trim() === optionLabel,
  )!;
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};
const saveButton = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
    node.textContent?.includes("保存资料"),
  )!;

describe("customer detail page", () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
    report.mockReset();
    auth.user.permissions = ["*"];
    route.params = { id: "c1" };
    route.path = "/customer/c1";
    get.mockResolvedValue({ ...row } as never);
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
  });

  it("fills every writable column from the row the server sent", async () => {
    const root = mount();
    await flush();

    // The form is prefilled from the read, so each of the eight columns the customers table stores
    // has to arrive in the field the operator edits -- not the four the server computes, which have
    // no field and are not meant to.
    expect(typed(root, "企业名称")).toBe("星河云科");
    expect(typed(root, "所属行业")).toBe("企业服务");
    expect(typed(root, "联系人")).toBe("林晓");
    expect(typed(root, "联系电话")).toBe("13800000000");
    expect(typed(root, "联系邮箱")).toBe("lin@example.test");
    expect(typed(root, "城市")).toBe("武汉");
    expect(codeShown(root, "客户等级")).toBe("strategic");
    expect(codeShown(root, "跟进状态")).toBe("active");
    // The same three codes the list filters and files customers by, spelled identically: a fourth
    // here would be a value no column on any screen can label.
    expect(JSON.parse(codesOffered(root, "跟进状态")!)).toEqual([
      { label: "合作中", value: "active" },
      { label: "跟进中", value: "follow" },
      { label: "风险关注", value: "risk" },
    ]);
    expect(JSON.parse(codesOffered(root, "客户等级")!)).toEqual([
      { label: "战略客户", value: "strategic" },
      { label: "企业客户", value: "enterprise" },
      { label: "成长客户", value: "growth" },
    ]);
  });

  it("writes the whole column set back and nothing the server works out", async () => {
    // The row comes back changed: the city is stored the way the server spells it and the level is
    // one the operator did not touch. Showing this answer rather than the draft is what keeps the
    // screen honest about what is now in the table.
    put.mockResolvedValue({ ...row, status: "risk", city: "成都市" } as never);
    const root = mount();
    await flush();

    type(root, "城市", "成都");
    pick(root, "跟进状态", "风险关注");
    saveButton(root).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();

    // PUT replaces the row, so the body is the eight writable columns exactly: an `ownerName` sent
    // along would be a claim about who owns the customer that only the server's own assignment makes,
    // and a hand-typed `annualValue` would be a figure nobody ordered.
    expect(put).toHaveBeenCalledWith("/customers/c1", {
      name: "星河云科",
      industry: "企业服务",
      level: "strategic",
      status: "risk",
      contact: "林晓",
      phone: "13800000000",
      email: "lin@example.test",
      city: "成都",
    });
    const body = put.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ["city", "contact", "email", "industry", "level", "name", "phone", "status"],
    );
    expect(typed(root, "城市")).toBe("成都市");
    expect(codeShown(root, "跟进状态")).toBe("risk");
    expect(report).not.toHaveBeenCalled();
  });

  it("holds no form over a row it could not read", async () => {
    get.mockRejectedValue(new Error("请求失败：404") as never);
    const root = mount();
    await flush();

    // No read means no id to put to, so there is nothing to edit and nothing that could be written
    // to the wrong customer: the server's own sentence is the only thing on screen.
    expect(root.textContent).toContain("请求失败：404");
    expect(root.querySelectorAll(".form-item")).toHaveLength(0);
    expect(root.querySelectorAll("input")).toHaveLength(0);
    expect(put).not.toHaveBeenCalled();
  });
});

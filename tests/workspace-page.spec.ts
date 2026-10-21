import { createApp, defineComponent, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResourceManager from "@/components/business/resource-manager.vue";
import { resources, type ResourceDefinition } from "@/api/workspace";
import request from "@/utils/request";
import { message } from "kui-vue";

const auth = reactive({ permissions: ["*"], user: { id: "actor" } });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));
// The component reads the router only for its detail link; mounting it outside a
// router would otherwise leave an unresolved injection in every test log.
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("kui-vue", () => ({
  message: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
const disposers: (() => void)[] = [];
const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
    await nextTick();
  }
};
function mount(definition: ResourceDefinition = resources.projects!) {
  const app = createApp(ResourceManager, { definition });
  const root = document.createElement("div");
  const box = defineComponent({
    props: ["label"],
    setup:
      (props, { slots }) =>
      () =>
        h("div", { "data-field": props.label }, [
          slots.default?.(),
          slots.actions?.(),
          slots.filters?.(),
          slots.footer?.(),
        ]),
  });
  for (const name of [
    "PageHeader",
    "ListPanel",
    "Form",
    "FormItem",
    "Space",
    "Page",
    "Select",
    "Switch",
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
  app.component("Drawer", dialog);
  app.component("Modal", dialog);
  const input = defineComponent({
    props: ["modelValue", "disabled"],
    emits: ["update:modelValue"],
    setup:
      (props, { emit }) =>
      () =>
        h("input", {
          value: props.modelValue,
          disabled: props.disabled,
          onInput: (event: Event) =>
            emit("update:modelValue", (event.target as HTMLInputElement).value),
        }),
  });
  for (const name of ["Input", "TextArea", "InputNumber"]) app.component(name, input);
  app.component(
    "Table",
    defineComponent({
      props: ["data"],
      setup:
        (props, { slots }) =>
        () =>
          h(
            "div",
            (props.data || []).map((record: object) =>
              h("div", [
                // The field slots are what the real table renders per cell, and the
                // label-versus-raw-id behaviour lives entirely in them.
                ...Object.entries(slots)
                  .filter(([name]) => name !== "action")
                  .flatMap(([, slot]) => slot?.({ record })),
                slots.action?.({ record }),
              ]),
            ),
          ),
    }),
  );
  app.mount(root);
  disposers.push(() => app.unmount());
  return root;
}
function click(root: Element, label: string) {
  const button = [...root.querySelectorAll("button")].find((node) => node.textContent?.trim() === label);
  expect(button).toBeDefined();
  button!.click();
}
function fill(root: Element, label: string, value: string) {
  const input = root.querySelector(`[data-field="${label}"] input`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
beforeEach(() => {
  vi.resetAllMocks();
  auth.permissions = ["*"];
  vi.mocked(request.get).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
});
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));
describe("workspace page workflows", () => {
  it("retains failed input, and only closes after a successful server save", async () => {
    const root = mount();
    await flush();
    click(root, "新增");
    await flush();
    fill(root, "名称", "Real project");
    fill(root, "项目编码", "P1");
    fill(root, "截止日期", "2026-12-31");
    await flush();
    vi.mocked(request.post).mockRejectedValueOnce(new Error("Offline"));
    click(root, "保存");
    await flush();
    expect(root.querySelector("[data-dialog]")).not.toBeNull();
    expect(message.success).not.toHaveBeenCalled();
    // A rejected write has to say why: the request layer only toasts timeouts and
    // network failures, so a 4xx sentence reaches the operator through this call.
    expect(message.error).toHaveBeenCalledWith("Offline");
    expect((root.querySelector('[data-field="名称"] input') as HTMLInputElement).value).toBe(
      "Real project",
    );
    vi.mocked(request.post).mockResolvedValueOnce({ id: "new" });
    click(root, "保存");
    await flush();
    expect(request.post).toHaveBeenLastCalledWith(
      "/projects",
      expect.objectContaining({ name: "Real project", code: "P1", deadline: "2026-12-31" }),
    );
    expect(root.querySelector("[data-dialog]")).toBeNull();
    expect(message.success).toHaveBeenCalledOnce();
  });
  it("keeps the row and quotes the server when a delete is refused", async () => {
    vi.mocked(request.get).mockResolvedValue({
      items: [{ id: "p1", name: "Locked" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const root = mount();
    await flush();
    click(root, "删除");
    await flush();
    vi.mocked(request.delete).mockRejectedValueOnce(
      new Error("3 orders record(s) still reference this project"),
    );
    click(root, "确认删除");
    await flush();

    expect(message.error).toHaveBeenCalledWith(
      "3 orders record(s) still reference this project",
    );
    expect(message.success).not.toHaveBeenCalled();
    // The confirmation stays open, so what was refused is still on screen.
    expect(root.querySelector('[data-dialog="删除记录"]')).not.toBeNull();
    expect(request.get).toHaveBeenCalledTimes(1);
  });
  it("does not offer create/delete to a read-only account", async () => {
    auth.permissions = ["project:read"];
    vi.mocked(request.get).mockResolvedValue({
      items: [{ id: "p" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const root = mount();
    await flush();
    expect(root.textContent).not.toContain("新增");
    expect(root.textContent).not.toContain("删除");
  });
  it("does not show a saveable default record when detail loading fails", async () => {
    vi.mocked(request.get)
      .mockResolvedValueOnce({ items: [{ id: "p" }], total: 1, page: 1, pageSize: 20 })
      .mockRejectedValueOnce(new Error("Record missing"));
    const root = mount();
    await flush();
    click(root, "详情 / 编辑");
    await flush();
    expect(root.textContent).toContain("Record missing");
    const save = [...root.querySelectorAll("button")].find((node) => node.textContent?.trim() === "保存");
    expect(save?.disabled).toBe(true);
    expect(request.put).not.toHaveBeenCalled();
  });
  it("names the related record in the list instead of its primary key", async () => {
    const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 20 });
    vi.mocked(request.get).mockImplementation(async (path: string) =>
      path === "/tasks"
        ? page([
            {
              id: "t1",
              title: "写月历",
              projectId: "p1",
              deadline: "2026-11-01",
              status: "todo",
              priority: "high",
            },
          ])
        : page([{ id: "p1", name: "Kui 组件库", code: "KUI" }]),
    );
    const root = mount(resources.tasks!);
    await flush();
    expect(request.get).toHaveBeenCalledWith("/projects", expect.anything());
    expect(root.textContent).toContain("Kui 组件库 (KUI)");
    expect(root.textContent).not.toContain("p1");
  });
  it("keeps the seconds the server always sends out of the time column", async () => {
    vi.mocked(request.get).mockImplementation(async (path: string) =>
      path === "/calendar"
        ? {
            items: [
              {
                id: "c1",
                title: "周会",
                date: "2026-10-21",
                time: "10:00:00",
                category: "meeting",
                location: "",
                online: false,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }
        : { items: [], total: 0, page: 1, pageSize: 20 },
    );
    const root = mount(resources.calendar!);
    await flush();
    expect(root.textContent).toContain("10:00");
    expect(root.textContent).not.toContain("10:00:00");
  });
  it("labels the review state the server owns", async () => {
    vi.mocked(request.get).mockImplementation(async (path: string) =>
      path === "/approvals"
        ? {
            items: [
              {
                id: "a1",
                title: "报销申请",
                type: "expense",
                amount: "200.00",
                description: "",
                status: "pending",
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          }
        : { items: [], total: 0, page: 1, pageSize: 20 },
    );
    const root = mount(resources.approvals!);
    await flush();
    // The state is not an editable field, so it reaches the table through no definition
    // field of its own -- and the enum must not be what the operator reads.
    expect(root.textContent).toContain("待审核");
    expect(root.textContent).not.toContain("pending");
  });
});

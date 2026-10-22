import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Departments from "@/pages/(admin)/system/departments.vue";
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

const auth = reactive({ permissions: ["*"] as string[] });
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const put = vi.mocked(request.put);
const del = vi.mocked(request.delete);

const rows = () => [
  { id: "d1", name: "平台组" },
  { id: "d2", name: "增长组" },
];

const slotBox =
  (name: string) =>
  ({
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) => () =>
      h("div", { class: name }, [slots.default?.(), slots.footer?.()]),
  });

/** Kui's Table renders one named slot per column, so the stub hands each row to `#action`. */
const tableStub = {
  props: ["data", "columns", "rowKey", "loading"],
  setup(
    props: any,
    { slots }: { slots: Record<string, (arg: { record: unknown }) => unknown> },
  ) {
    return () =>
      h(
        "div",
        {
          class: "table",
          "data-rows": String(props.data.length),
          "data-loading": String(Boolean(props.loading)),
        },
        props.data.map((record: any) =>
          h("div", { class: "row", "data-id": record[props.rowKey] }, [
            h("span", { class: "name" }, String(record.name)),
            slots.action?.({ record }),
          ]),
        ),
      );
  },
};

const inputStub = {
  props: ["modelValue", "maxlength", "disabled"],
  emits: ["update:modelValue"],
  setup(props: any, { emit }: { emit: (event: string, value: unknown) => void }) {
    return () =>
      h("input", {
        value: props.modelValue ?? "",
        disabled: props.disabled ? "" : undefined,
        onInput: (event: Event) =>
          emit("update:modelValue", (event.target as HTMLInputElement).value),
      });
  },
};

/** Declaring no props keeps `disabled` as a real attribute, which is what the checks read. */
const buttonStub = {
  setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) => () =>
    h("button", slots.default?.()),
};

const modalStub = {
  props: ["modelValue", "title"],
  emits: ["update:modelValue"],
  setup(props: any, { slots }: { slots: Record<string, () => unknown> }) {
    return () =>
      props.modelValue
        ? h("div", { class: "modal" }, [
            String(props.title ?? ""),
            slots.default?.(),
            slots.footer?.(),
          ])
        : null;
  },
};

const disposers: Array<() => void> = [];
const flush = async () => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await nextTick();
  }
};

/** Kui renders slot text with the template's own whitespace, so match it trimmed. */
function buttons(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
}
function findButton(root: HTMLElement, label: string) {
  return buttons(root).find((element) => element.textContent?.trim() === label);
}
function clickButton(root: HTMLElement, label: string) {
  const button = findButton(root, label);
  if (!button) throw new Error(`No button labelled ${label}`);
  button.click();
}

function typeInto(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Departments);
  app.component("Alert", {
    props: ["title", "description"],
    setup: (props: any) => () => h("div", { class: "alert" }, `${props.title}${props.description}`),
  } as never);
  app.component("Button", buttonStub as never);
  app.component("Form", slotBox("form") as never);
  app.component("FormItem", slotBox("form-item") as never);
  app.component("Input", inputStub as never);
  app.component("ListPanel", {
    props: ["summary"],
    setup: (props: any, { slots }: { slots: Record<string, () => unknown> }) => () =>
      h("div", { class: "list-panel" }, [
        h("span", { class: "summary" }, [slots.summary?.() ?? String(props.summary ?? "")]),
        slots.filters?.(),
        slots.actions?.(),
        slots.default?.(),
      ]),
  } as never);
  app.component("Skeleton", skeletonStub as never);
  app.component("Modal", modalStub as never);
  app.component("Space", slotBox("space") as never);
  app.component("Table", tableStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

describe("department page", () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    put.mockReset();
    del.mockReset();
    vi.clearAllMocks();
    auth.permissions = ["*"];
    get.mockResolvedValue(rows() as never);
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
  });

  it("keeps the panel and lets the table wait while the directory is in flight", async () => {
    let arrive!: (rows: unknown) => void;
    get.mockImplementation(
      (() =>
        new Promise((resolve) => {
          arrive = resolve;
        })) as never,
    );
    const root = mount();
    await flush();

    expect(root.querySelector(".list-panel")).not.toBeNull();
    expect(root.querySelector(".table")!.getAttribute("data-loading")).toBe("true");
    // Only the count waits: a strip reading "共 0 个部门" would be a number nobody counted.
    expect(root.querySelectorAll(".skeleton-line").length).toBe(1);
    expect(root.querySelector(".summary")!.textContent).not.toContain("0");
    expect(root.textContent).not.toContain("正在加载");

    arrive(rows());
    await flush();
    expect(root.querySelectorAll(".skeleton-line").length).toBe(0);
    expect(root.textContent).toContain("共 2 个部门");
    expect(root.querySelector(".table")!.getAttribute("data-loading")).toBe("false");
  });

  it("lists the directory the server returned", async () => {
    const root = mount();
    await flush();

    expect(get).toHaveBeenCalledWith("/departments");
    expect(root.querySelector(".table")!.getAttribute("data-rows")).toBe("2");
    expect(root.textContent).toContain("平台组");
    expect(root.textContent).toContain("共 2 个部门");
  });

  it("searches the rows it already has without another request", async () => {
    const root = mount();
    await flush();

    typeInto(root.querySelector(".list-panel input")!, "增长");
    await flush();

    expect(root.querySelector(".table")!.getAttribute("data-rows")).toBe("1");
    expect(root.textContent).toContain("增长组");
    expect(root.textContent).not.toContain("平台组");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("keeps a non-administrator from writing, even with the user permissions", async () => {
    auth.permissions = ["system:user:read", "system:user:write"];
    const root = mount();
    await flush();

    expect(findButton(root, "新增部门")).toBeUndefined();
    expect(findButton(root, "改名")!.disabled).toBe(true);
    expect(findButton(root, "删除")!.disabled).toBe(true);
    expect(root.textContent).toContain("只读");
    expect(root.querySelector(".table")!.getAttribute("data-rows")).toBe("2");
  });

  it("reports a failed read instead of showing an empty directory", async () => {
    get.mockRejectedValue(new Error("部门接口挂了"));
    const root = mount();
    await flush();

    expect(root.textContent).toContain("部门接口挂了");
    expect(root.querySelector(".table")).toBeNull();
    expect(message.success).not.toHaveBeenCalled();
  });

  it("creates a department and reloads only after the server accepted it", async () => {
    post.mockResolvedValue({ id: "d3" } as never);
    const root = mount();
    await flush();

    clickButton(root, "新增部门");
    await flush();
    typeInto(root.querySelector(".modal input")!, "  质量组  ");
    await flush();
    clickButton(root, "保存");
    await flush();

    expect(post).toHaveBeenCalledWith("/departments", { name: "质量组" });
    expect(message.success).toHaveBeenCalledWith("部门已创建");
    expect(root.querySelector(".modal")).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("refuses a blank name before spending a request", async () => {
    const root = mount();
    await flush();

    clickButton(root, "新增部门");
    await flush();
    clickButton(root, "保存");
    await flush();

    expect(post).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")!.textContent).toContain("请填写部门名称");
  });

  it("refuses a name the directory already has", async () => {
    const root = mount();
    await flush();

    clickButton(root, "新增部门");
    await flush();
    typeInto(root.querySelector(".modal input")!, "平台组");
    await flush();
    clickButton(root, "保存");
    await flush();

    expect(post).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")!.textContent).toContain("已经有同名部门了");
  });

  it("keeps the editor open with the server reason when the write is refused", async () => {
    post.mockRejectedValue(new Error("Input should be a valid string"));
    const root = mount();
    await flush();

    clickButton(root, "新增部门");
    await flush();
    typeInto(root.querySelector(".modal input")!, "质量组");
    await flush();
    clickButton(root, "保存");
    await flush();

    expect(root.querySelector(".modal")!.textContent).toContain("Input should be a valid string");
    expect(root.querySelector(".modal input")!.value).toBe("质量组");
    expect(message.success).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("renames through PUT with the record id", async () => {
    put.mockResolvedValue({ id: "d1", name: "平台与增长组" } as never);
    const root = mount();
    await flush();

    root.querySelector<HTMLElement>('[data-id="d1"] button')!.click();
    await flush();
    const name = root.querySelector(".modal input")!;
    expect(name.value).toBe("平台组");
    typeInto(name, "平台与增长组");
    await flush();
    clickButton(root, "保存");
    await flush();

    expect(put).toHaveBeenCalledWith("/departments/d1", { name: "平台与增长组" });
    expect(message.success).toHaveBeenCalledWith("部门已改名");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("deletes only after the confirmation and reloads the directory", async () => {
    del.mockResolvedValue({ ok: true } as never);
    const root = mount();
    await flush();

    clickButton(root, "删除");
    await flush();
    expect(del).not.toHaveBeenCalled();
    expect(root.querySelector(".modal")!.textContent).toContain("平台组");

    clickButton(root, "确认删除");
    await flush();

    expect(del).toHaveBeenCalledWith("/departments/d1");
    expect(message.success).toHaveBeenCalledWith("部门已删除");
    expect(root.querySelector(".modal")).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("shows which records block a deletion and keeps the row", async () => {
    del.mockRejectedValue(
      new Error("2 tasks record(s) still belong to this department; reassign them before deleting it"),
    );
    const root = mount();
    await flush();

    clickButton(root, "删除");
    await flush();
    clickButton(root, "确认删除");
    await flush();

    const modal = root.querySelector(".modal")!;
    expect(modal.textContent).toContain("2 tasks record(s) still belong to this department");
    expect(message.success).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(1);
    expect(root.querySelector(".table")!.getAttribute("data-rows")).toBe("2");
  });
});

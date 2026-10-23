import { createApp, h, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Products from "@/pages/(admin)/commerce/products.vue";
import request from "@/utils/request";
import { reportFailure } from "@/utils/report-failure";
import { flush, settle } from "./filter-settle";
import { skeletonStub } from "./skeleton-stub";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/utils/report-failure", () => ({ reportFailure: vi.fn() }));
vi.mock("kui-icons", () => ({ Package: [], Pencil: [], Plus: [], Search: [] }));
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

const product = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  name: "旗舰路由",
  sku: "R-1",
  category: "IT 设备",
  specs: "黑色",
  image: "",
  price: "1286.00",
  stock: 4,
  enabled: true,
  updatedAt: "2026-10-19T16:05:41",
  ...over,
});
// Labels in the order the server puts them, which is not the order a page would dream up, and wider
// than any list this page could keep: `办公家具` is a category a colleague filed, not a word in the
// code.
const categories = ["IT 设备", "it 周边", "办公家具"];

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

/**
 * An AutoComplete is the shape that keeps a write field free-typing: it shows what the server says
 * already exists and still takes a label nobody has filed yet, which is how a category comes to
 * exist. The stub renders both halves so a test can pick a suggestion or type past all of them.
 */
const autoCompleteStub = {
  props: ["modelValue", "options", "placeholder", "loading"],
  emits: ["update:modelValue"],
  setup(props: any, { emit }: { emit: (event: string, value: unknown) => void }) {
    return () =>
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
          ...(props.options ?? []).map((value: string) =>
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
      );
  },
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

// Kui's Drawer mounts its content only while open, so a test that reads the form has to open the
// drawer first -- and a field that was pre-filled with something the server never said is then
// visible as the value the input starts with.
const drawerStub = {
  props: ["modelValue", "title"],
  setup(
    props: any,
    { slots }: { slots: Record<string, () => unknown> },
  ) {
    return () =>
      props.modelValue
        ? h("section", { class: "drawer", "data-drawer": props.title }, [
            slots.default?.(),
            slots.footer?.(),
          ])
        : null;
  },
};

const inputStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  setup(props: any, { emit }: { emit: (event: string, value: unknown) => void }) {
    return () =>
      h("input", {
        class: "text-input",
        value: props.modelValue ?? "",
        onInput: (event: Event) =>
          emit("update:modelValue", (event.target as HTMLInputElement).value),
      });
  },
};

// Kui's ListPanel hands the selection strip its own count, so the stub carries the prop the page
// binds and passes it back: a strip that read a count the panel never gave would throw here instead
// of quietly rendering `undefined`.
const listPanelStub = {
  props: ["selectedCount"],
  setup(
    props: any,
    { slots }: { slots: Record<string, (arg?: any) => unknown> },
  ) {
    return () =>
      h("div", { class: "list-panel" }, [
        slots.summary?.(),
        slots.filters?.(),
        slots.actions?.(),
        props.selectedCount > 0 ? slots.selection?.({ count: props.selectedCount }) : null,
        slots.default?.(),
      ]);
  },
};

const disposers: Array<() => void> = [];

function mount() {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const app = createApp(Products);
  for (const name of [
    "Button",
    "Form",
    "FormItem",
    "Grid",
    "GridItem",
    "Icon",
    "Page",
    "Space",
    "Switch",
    "TableColumnSetting",
  ])
    app.component(name, box(name.toLowerCase()) as never);
  app.component("Input", inputStub as never);
  app.component("InputNumber", inputStub as never);
  app.component("Drawer", drawerStub as never);
  app.component("ListPanel", listPanelStub as never);
  app.component("Select", selectStub as never);
  app.component("AutoComplete", autoCompleteStub as never);
  app.component("Table", tableStub as never);
  app.component("Skeleton", skeletonStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const cell = (root: HTMLElement, key: string, row = 0) =>
  Array.from(root.querySelectorAll(`.cell-${key}`))[row]?.textContent?.trim();
const select = (root: HTMLElement, placeholder: string) =>
  [...root.querySelectorAll<HTMLElement>(".select")].find(
    (node) => node.dataset.placeholder === placeholder,
  )!;
const autoComplete = (root: HTMLElement, placeholder: string) =>
  [...root.querySelectorAll<HTMLElement>(".autocomplete")].find(
    (node) => node.dataset.placeholder === placeholder,
  )!;
const option = (node: HTMLElement, label: string) =>
  [...node.querySelectorAll<HTMLButtonElement>("button.option")].find(
    (button) => button.textContent?.trim() === label,
  )!;
const buttonNamed = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (node) => node.textContent?.trim() === label,
  )!;
const click = (node: HTMLElement) => node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
const type = (node: HTMLElement, value: string) => {
  const field = node as HTMLInputElement;
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("products page", () => {
  beforeEach(() => {
    // `settle` advances this clock.
    vi.useFakeTimers();
    get.mockReset();
    post.mockReset();
    report.mockReset();
    auth.user.permissions = ["*"];
    get.mockImplementation(((url: string) =>
      url === "/products/facets"
        ? Promise.resolve({ categories })
        : Promise.resolve({ items: [product()], total: 1, page: 1, pageSize: 20 })) as never);
    post.mockResolvedValue(product() as never);
  });
  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    vi.useRealTimers();
  });

  it("offers the categories the server says exist and filters by the one picked", async () => {
    const root = mount();
    await flush();

    expect(get).toHaveBeenCalledWith("/products/facets");
    // The labels arrive in the order the server sorted them, not the order a page would file them:
    // `办公家具` was typed by a colleague and is offered like any other, while nothing in this page
    // gets to decide which categories a deployed database has.
    expect(JSON.parse(select(root, "全部分类").dataset.options!)).toEqual(
      categories.map((value) => ({ label: value, value })),
    );
    expect(root.textContent).not.toContain("软件服务");

    click(option(select(root, "全部分类"), "办公家具"));
    await settle();
    // The filter question is sent under `category`, the key the list endpoint reads; a dropdown
    // wired to any other key offers a label and then ignores the choice.
    expect(get).toHaveBeenLastCalledWith("/products", {
      keyword: "",
      category: "办公家具",
      enabled: undefined,
      page: 1,
      pageSize: 20,
    });
    expect(cell(root, "category")).toBe("IT 设备");
  });

  it("says so when the candidate values cannot be read, and keeps the list", async () => {
    get.mockImplementation(((url: string) =>
      url === "/products/facets"
        ? Promise.reject(new Error("候选接口暂不可用"))
        : Promise.resolve({ items: [product()], total: 1, page: 1, pageSize: 20 })) as never);
    const root = mount();
    await flush();

    // An empty dropdown is not the server saying no such category exists, so the refusal is said out
    // loud -- and it cannot be allowed to hide the products the list did answer for.
    expect(report).toHaveBeenCalledWith(expect.any(Error), "筛选候选值加载失败");
    expect(JSON.parse(select(root, "全部分类").dataset.options!)).toEqual([]);
    expect(cell(root, "category")).toBe("IT 设备");
  });

  it("offers nothing when the catalogue has no category recorded, rather than inventing one", async () => {
    // A freshly seeded library really can answer this way, and it is not an error: every product was
    // filed without a category, which the server keeps out of the candidate list because a row that
    // has nothing recorded is not a label to filter for.
    get.mockImplementation(((url: string) =>
      url === "/products/facets"
        ? Promise.resolve({ categories: [] })
        : Promise.resolve({ items: [product({ category: "" })], total: 1, page: 1, pageSize: 20 })) as never);
    const root = mount();
    await flush();

    expect(report).not.toHaveBeenCalled();
    expect(JSON.parse(select(root, "全部分类").dataset.options!)).toEqual([]);
  });

  it("lets the form file a category nobody has used yet, and puts it in the filter", async () => {
    const filed = product({ name: "巡检机器人", sku: "BOT-1", category: "巡检服务" });
    // The second read is what the server answers once this product exists: a label is created by
    // filing a row with it, so the dropdown has to grow in the same visit.
    let reads = 0;
    get.mockImplementation(((url: string) =>
      url === "/products/facets"
        ? Promise.resolve({
            categories: reads++ === 0 ? categories : [...categories, "巡检服务"],
          })
        : Promise.resolve({ items: [product()], total: 1, page: 1, pageSize: 20 })) as never);
    post.mockResolvedValue(filed as never);
    const root = mount();
    await flush();

    click(buttonNamed(root, "新增商品"));
    await flush();

    // Nothing is pre-filled with a label the server did not offer: an unfiled category is a guess at
    // what the catalogue should say, and the row would arrive carrying it.
    const field = autoComplete(root, "选择已有分类或直接输入新分类");
    expect(field.querySelector<HTMLInputElement>(".autocomplete-input")!.value).toBe("");
    expect(JSON.parse(field.dataset.options!)).toEqual(categories);

    type(field.querySelector(".autocomplete-input")!, "巡检服务");
    const form = root.querySelector(".drawer")!;
    const inputs = [...form.querySelectorAll<HTMLInputElement>(".text-input")];
    type(inputs[0], "巡检机器人");
    type(inputs[1], "BOT-1");
    click(buttonNamed(form, "保存"));
    await flush();

    expect(post).toHaveBeenCalledWith("/products", {
      name: "巡检机器人",
      sku: "BOT-1",
      category: "巡检服务",
      specs: "",
      image: "",
      price: "0.00",
      stock: 0,
      enabled: true,
    });
    expect(reads).toBe(2);
    expect(JSON.parse(select(root, "全部分类").dataset.options!)).toContainEqual({
      label: "巡检服务",
      value: "巡检服务",
    });
  });

  it("keeps a category that has rows behind it pickable from the suggestion list", async () => {
    const root = mount();
    await flush();
    click(buttonNamed(root, "新增商品"));
    await flush();

    const field = autoComplete(root, "选择已有分类或直接输入新分类");
    // Picking a suggestion writes the label the rows already carry, which is the point of reading
    // them: retyping "IT 设备" by hand is how a catalogue ends up with "IT设备" next to it.
    click(option(field, "it 周边"));
    await flush();
    expect(field.querySelector<HTMLInputElement>(".autocomplete-input")!.value).toBe("it 周边");
  });
});

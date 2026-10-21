import { createApp, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Customers from "@/pages/(admin)/crm/customers.vue";
import request from "@/utils/request";

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

const box =
  (name: string) =>
  ({
    props: [] as string[],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) => () =>
      h("div", { class: name }, [slots.default?.(), slots.footer?.()]),
  });

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
    "FormItem",
    "Grid",
    "GridItem",
    "Icon",
    "Input",
    "ListPanel",
    "Page",
    "Select",
    "Space",
    "TableColumnSetting",
    "Tag",
  ]) {
    app.component(name, box(name.toLowerCase()) as never);
  }
  app.component("Table", tableStub as never);
  app.mount(root);
  disposers.push(() => {
    app.unmount();
    root.remove();
  });
  return root;
}

const cell = (root: HTMLElement, key: string, row = 0) =>
  Array.from(root.querySelectorAll(`.cell-${key}`))[row]?.textContent?.trim();

describe("customer page", () => {
  beforeEach(() => {
    get.mockReset();
    auth.permissions = ["*"];
    get.mockResolvedValue({
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
    } as never);
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
});

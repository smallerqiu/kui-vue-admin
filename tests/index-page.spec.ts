import { createApp, defineComponent, h, nextTick, reactive } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/(admin)/index.vue";
import { systemApi, type Dashboard as DashboardData } from "@/api/system";

const auth = reactive({
  permissions: ["*"],
  user: { id: "actor", name: "操作员", fullName: "" },
});
vi.mock("@/stores/auth", () => ({ useAuthStore: () => auth }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/api/system", () => ({ systemApi: { dashboard: vi.fn() } }));
vi.mock("kui-vue", () => ({ message: { success: vi.fn(), error: vi.fn() } }));

const disposers: (() => void)[] = [];
const figures: DashboardData = {
  orders: 12345,
  revenue: "1234567.89",
  customers: 42,
  products: 8,
  projects: 3,
  tasks: 17,
};
const flush = async () => {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
    await nextTick();
  }
};
function mount() {
  const app = createApp(Dashboard);
  const container = document.createElement("div");
  // Cards are where these tests read a figure from, so each one keeps its title reachable.
  app.component(
    "Card",
    defineComponent({
      props: ["title"],
      setup:
        (props, { slots }) =>
        () =>
          h("section", { "data-title": props.title }, slots.default?.()),
    }),
  );
  for (const name of ["PageHeader", "Grid", "GridItem", "Space"])
    app.component(
      name,
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h("div", slots.default?.()),
      }),
    );
  app.component(
    "Button",
    defineComponent({
      props: ["loading"],
      setup:
        (props, { slots }) =>
        () =>
          h("button", { disabled: props.loading }, slots.default?.()),
    }),
  );
  app.mount(container);
  disposers.push(() => app.unmount());
  return container;
}
const metric = (root: HTMLElement, label: string) =>
  root.querySelector(`section[data-title="${label}"] .metric`)?.textContent?.trim();

// The server's amounts arrive as decimal text and its counts as numbers, and this page shows both
// side by side. One helper has to serve them differently: grouping the revenue is what makes it
// readable, and grouping 订单总数 into "12,345.00" would turn a count of orders into a price.
describe("dashboard figures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(systemApi.dashboard).mockResolvedValue(figures);
  });
  afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));

  it("groups the money figure and leaves the counts as digits", async () => {
    const root = mount();
    await flush();
    expect(metric(root, "累计净收款金额")).toBe("1,234,567.89");
    expect(metric(root, "订单总数")).toBe("12345");
    expect(metric(root, "客户总数")).toBe("42");
  });
  it("prints the zero the server paid rather than a blank", async () => {
    vi.mocked(systemApi.dashboard).mockResolvedValueOnce({ ...figures, revenue: "0.00" });
    const root = mount();
    await flush();
    expect(metric(root, "累计净收款金额")).toBe("0.00");
  });
});

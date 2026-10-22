import { createApp, h, nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Analytics from "@/pages/(admin)/data/analytics.vue";
import { analyticsToCsv, loadAnalyticsReport } from "@/api/reports";
import type { AnalyticsReport } from "@/api/reports";
import { skeletonStub } from "./skeleton-stub";

vi.mock("@/api/reports", () => ({
  loadAnalyticsReport: vi.fn(),
  analyticsToCsv: vi.fn(() => "周期,订单量,收入"),
}));
// The charts draw into a canvas jsdom cannot back, so they become data sinks
// here: what these tests care about is what the page hands them, and whether it tells them to wait.
vi.mock("@/components/charts/TrendChart.vue", () => ({
  default: {
    props: ["data", "name", "suffix", "color", "loading"],
    setup: (props: { data: unknown; loading: boolean }) =>
      () =>
        h("div", {
          "data-trend": JSON.stringify(props.data),
          "data-loading": String(props.loading),
        }),
  },
}));
vi.mock("@/components/charts/DonutChart.vue", () => ({
  default: {
    props: ["data", "unit", "loading"],
    setup: (props: { data: unknown; loading: boolean }) =>
      () =>
        h("div", {
          "data-donut": JSON.stringify(props.data),
          "data-loading": String(props.loading),
        }),
  },
}));
vi.mock("kui-vue", () => ({
  PageHeader: {
    props: ["title", "description"],
    setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
      () => h("header", [slots.default?.(), slots.actions?.()]),
  },
  message: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Layout pieces only have to keep their slots reachable.
const layout = () => ({
  setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
    () => h("div", slots.default?.()),
});

const disposers: Array<() => void> = [];

function mount(root: HTMLElement) {
  const app = createApp(Analytics);
  for (const name of ["Grid", "GridItem", "Card", "Tag", "Flex"]) app.component(name, layout());
  app.component(
    "Segmented",
    {
      props: ["modelValue", "options"],
      emits: ["update:modelValue"],
      setup: (props: any, { emit }: { emit: (event: string, value: unknown) => void }) =>
        () =>
          h(
            "div",
            props.options.map((option: { label: string; value: string }) =>
              h(
                "button",
                { "data-range": option.value, onClick: () => emit("update:modelValue", option.value) },
                option.label,
              ),
            ),
          ),
    },
  );
  app.component(
    "StatCard",
    {
      props: ["title", "items"],
      setup: (props: { title: string; items: unknown[] }) =>
        () => h("div", { "data-stat": JSON.stringify({ title: props.title, item: props.items[0] }) }),
    },
  );
  app.component(
    "Button",
    {
      props: ["disabled", "loading", "icon"],
      setup: (_props: object, { slots }: { slots: Record<string, () => unknown> }) =>
        () => h("button", slots.default?.()),
    },
  );
  app.component("Skeleton", skeletonStub as never);
  app.mount(root);
  disposers.push(() => app.unmount());
}

async function flush() {
  for (let index = 0; index < 8; index++) {
    await Promise.resolve();
    await nextTick();
  }
}

function report(overrides: Partial<AnalyticsReport> = {}): AnalyticsReport {
  return {
    range: "30d",
    bucket: "day",
    start: "2026-09-20T00:00:00",
    end: "2026-10-19T12:30:00",
    previousStart: "2026-08-21T00:00:00",
    previousEnd: "2026-09-19T12:30:00",
    metrics: {
      revenue: { current: "123456.00", previous: "100000.00", change: 23.5 },
      orders: { current: 42, previous: 40, change: 5 },
      averageOrderValue: { current: "2939.43", previous: "2500.00", change: 17.6 },
      refundRate: { current: 4, previous: 2, change: 100 },
    },
    trend: [
      { bucket: "2026-10-18", orders: 1, revenue: "1000.00" },
      { bucket: "2026-10-19", orders: 2, revenue: "2000.00" },
    ],
    channels: [
      { name: "官方网站", value: 30 },
      { name: "", value: 12 },
    ],
    paymentMethods: [{ name: "支付宝", value: 42 }],
    fulfillment: [
      { name: "submitted", value: 42 },
      { name: "paid", value: 40 },
      { name: "shipped", value: 30 },
      { name: "completed", value: 20 },
    ],
    ...overrides,
  };
}

let root: HTMLElement;
beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
  vi.mocked(loadAnalyticsReport).mockResolvedValue(report());
});
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  root.remove();
  vi.unstubAllGlobals();
});

const stats = () =>
  [...root.querySelectorAll("[data-stat]")].map((node) => JSON.parse(node.getAttribute("data-stat")!));
const click = (element: Element) => (element as HTMLElement).click();

describe("analytics page", () => {
  it("renders the report the data source returned", async () => {
    mount(root);
    await flush();
    expect(loadAnalyticsReport).toHaveBeenCalledWith("30d");
    const cards = stats();
    expect(cards.map((card) => card.title)).toEqual(["营业收入", "订单量", "客单价", "退款率"]);
    // 123456.00 yuan reads as 12.35 万, and the comparison is the server's.
    expect(cards[0].item).toMatchObject({ value: 12.35, suffix: "万", trend: "+23.5%" });
    expect(cards[1].item).toMatchObject({ value: 42, trend: "+5.0%" });
    expect(cards[2].item).toMatchObject({ value: 2939.43, prefix: "¥" });
    // A refund rate that doubled is bad news, not a green arrow.
    expect(cards[3].item).toMatchObject({ value: 4, trend: "+100.0%", trendStatus: "danger" });
    expect(root.textContent).toContain("2026-08-21 至 2026-09-19（UTC）");
  });

  it("holds the layout while the first report is in flight", async () => {
    let arrive!: (value: AnalyticsReport) => void;
    vi.mocked(loadAnalyticsReport).mockReturnValue(
      new Promise<AnalyticsReport>((resolve) => {
        arrive = resolve;
      }),
    );
    mount(root);
    await nextTick();

    // Four card positions, the comparison note and the funnel are on the page before a single figure
    // is known, and the page prints nothing that looks like one: no money sign, no 万, no window.
    expect(root.querySelectorAll(".stat-skeleton")).toHaveLength(4);
    expect(root.querySelectorAll(".skeleton-line")).toHaveLength(6);
    expect(root.querySelectorAll("[data-stat]")).toHaveLength(0);
    expect(root.querySelector(".funnel-item")).toBeNull();
    expect(root.textContent).not.toContain("¥");
    expect(root.textContent).not.toContain("对比周期");
    // The three charts report their own wait inside the boxes they already occupy.
    expect(root.querySelectorAll("[data-loading='true']")).toHaveLength(3);
    expect(JSON.parse(root.querySelector("[data-trend]")!.getAttribute("data-trend")!)).toEqual([]);

    arrive(report());
    await flush();
    expect(root.querySelectorAll(".stat-skeleton")).toHaveLength(0);
    expect(root.querySelectorAll(".skeleton-line")).toHaveLength(0);
    expect(stats()).toHaveLength(4);
    expect(root.querySelectorAll("[data-loading='true']")).toHaveLength(0);
    expect(root.querySelectorAll(".funnel-item")).toHaveLength(4);
  });

  it("says so when a metric has no value or no baseline instead of inventing one", async () => {
    vi.mocked(loadAnalyticsReport).mockResolvedValue(
      report({
        trend: [{ bucket: "2026-10-19", orders: 0, revenue: "0.00" }],
        metrics: {
          revenue: { current: "0.00", previous: "0.00", change: null },
          orders: { current: 1, previous: 0, change: null },
          averageOrderValue: { current: null, previous: null, change: null },
          refundRate: { current: null, previous: null, change: null },
        },
      }),
    );
    mount(root);
    await flush();
    const cards = stats();
    expect(cards[0].item).toMatchObject({ value: 0, desc: "上期无可比数据", trend: "" });
    expect(cards[2].item).toMatchObject({ value: 0, desc: "所选周期没有已支付订单" });
    expect(cards[3].item).toMatchObject({ value: 0, desc: "所选周期没有收款" });
    expect(root.textContent).toContain("所选周期内没有订单");
  });

  it("hands the charts UTC bucket labels and the unrecorded group names", async () => {
    mount(root);
    await flush();
    expect(JSON.parse(root.querySelector("[data-trend]")!.getAttribute("data-trend")!)).toEqual([
      { label: "10/18", value: 0.1 },
      { label: "10/19", value: 0.2 },
    ]);
    const donuts = [...root.querySelectorAll("[data-donut]")].map((node) =>
      JSON.parse(node.getAttribute("data-donut")!),
    );
    expect(donuts[0].map((row: { name: string }) => row.name)).toEqual(["官方网站", "未记录"]);
    expect(donuts[1]).toEqual([{ name: "支付宝", value: 42, color: "#54a9ff" }]);
  });

  it("labels monthly buckets as months for the year range", async () => {
    vi.mocked(loadAnalyticsReport).mockResolvedValue(
      report({
        range: "year",
        bucket: "month",
        trend: [
          { bucket: "2026-01", orders: 3, revenue: "500.00" },
          { bucket: "2026-10", orders: 0, revenue: "0.00" },
        ],
      }),
    );
    mount(root);
    await flush();
    expect(JSON.parse(root.querySelector("[data-trend]")!.getAttribute("data-trend")!)).toEqual([
      { label: "1 月", value: 0.05 },
      { label: "10 月", value: 0 },
    ]);
    expect(loadAnalyticsReport).toHaveBeenCalledWith("30d");
  });

  it("shows the funnel as counts with conversion to the next stage", async () => {
    mount(root);
    await flush();
    const stages = [...root.querySelectorAll(".funnel-item")];
    expect(stages).toHaveLength(4);
    expect(stages[0].textContent).toContain("提交订单");
    expect(stages[0].querySelector("small")!.textContent).toContain("95.2%");
    expect(stages[1].querySelector(".funnel-track span")!.getAttribute("style")).toContain("width: 95%");
    // The last stage has nothing to convert into.
    expect(stages[3].querySelector("small")).toBeNull();
  });

  it("reloads the selected range from the same data source", async () => {
    mount(root);
    await flush();
    click(root.querySelector('[data-range="7d"]')!);
    await flush();
    expect(loadAnalyticsReport).toHaveBeenLastCalledWith("7d");
    expect(stats()).toHaveLength(4);
  });

  it("reports the failure and retries it without falling back to demo figures", async () => {
    vi.mocked(loadAnalyticsReport).mockRejectedValueOnce(new Error("Analytics unavailable"));
    mount(root);
    await flush();
    expect(root.querySelector("[role=alert]")?.textContent).toContain("Analytics unavailable");
    expect(root.querySelector("[data-stat]")).toBeNull();
    expect(root.textContent).not.toContain("12.35");
    click([...root.querySelectorAll("button")].find((node) => node.textContent?.includes("重试"))!);
    await flush();
    expect(loadAnalyticsReport).toHaveBeenCalledTimes(2);
    expect(stats()).toHaveLength(4);
  });

  it("exports the loaded report as csv", async () => {
    const createObjectURL = vi.fn(() => "blob:demo");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    // jsdom would try to navigate for a real anchor click; only the download handoff matters.
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    mount(root);
    await flush();
    click(
      [...root.querySelectorAll("button")].find((node) =>
        node.textContent?.includes("导出趋势 CSV"),
      )!,
    );
    await flush();
    expect(analyticsToCsv).toHaveBeenCalledWith(report());
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchorClick.mock.instances[0]?.download).toBe("analytics-30d-2026-10-19.csv");
    expect(revokeObjectURL).toHaveBeenCalledOnce();
  });
});

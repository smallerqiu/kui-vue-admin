import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderRecord } from "@/api/commerce";
import { utcStamp } from "@/utils/common";

vi.mock("@/utils/request", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const AT = new Date(Date.UTC(2026, 9, 19, 12, 30, 0));

function order(patch: Partial<OrderRecord>): OrderRecord {
  return {
    id: "K1",
    customerId: "C1001",
    customer: "示例客户",
    contact: "",
    phone: "",
    address: "",
    goodsAmount: "100.00",
    freight: "0.00",
    discount: "0.00",
    paidAmount: "100.00",
    refundedAmount: "0.00",
    status: "paid",
    createdAt: "2026-10-19T01:00:00",
    paymentMethod: "支付宝",
    paymentAt: "2026-10-19T01:00:00",
    source: "官方网站",
    note: "",
    merchantRemark: "",
    items: [],
    shipments: [],
    ...patch,
  } as OrderRecord;
}

describe("analytics windows", () => {
  it("covers N natural UTC days including today and shifts both bounds by N days", async () => {
    const { analyticsWindows } = await import("@/data/analytics-demo");
    const week = analyticsWindows("7d", AT);
    expect(week.start.toISOString()).toBe("2026-10-13T00:00:00.000Z");
    expect(week.end).toBe(AT);
    expect(week.previousStart.toISOString()).toBe("2026-10-06T00:00:00.000Z");
    expect(week.previousEnd.toISOString()).toBe("2026-10-12T12:30:00.000Z");
    // Equal lengths make the percentage comparable at all.
    expect(week.end.getTime() - week.start.getTime()).toBe(
      week.previousEnd.getTime() - week.previousStart.getTime(),
    );
  });

  it("compares year to date against the same moment a year earlier", async () => {
    const { analyticsWindows } = await import("@/data/analytics-demo");
    const year = analyticsWindows("year", AT);
    expect(year.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(year.previousStart.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(year.previousEnd.toISOString()).toBe("2025-10-19T12:30:00.000Z");
  });

  it("falls back to February 28th when the comparison year has no leap day", async () => {
    const { analyticsWindows } = await import("@/data/analytics-demo");
    const leap = analyticsWindows("year", new Date(Date.UTC(2024, 1, 29, 6, 0, 0)));
    expect(leap.previousEnd.toISOString()).toBe("2023-02-28T06:00:00.000Z");
  });

  it("keeps every bucket visible, including empty days and month starts", async () => {
    const { analyticsWindows, bucketSequence } = await import("@/data/analytics-demo");
    const week = analyticsWindows("7d", AT);
    expect(bucketSequence(week.start, week.end, "day")).toEqual([
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
      "2026-10-19",
    ]);
    const year = analyticsWindows("year", AT);
    const months = bucketSequence(year.start, year.end, "month");
    expect(months).toHaveLength(10);
    expect(months[0]).toBe("2026-01");
    expect(months[9]).toBe("2026-10");
  });

  it("reports no change instead of inventing a percentage without a baseline", async () => {
    const { changeRatio } = await import("@/data/analytics-demo");
    expect(changeRatio("100.00", "0.00")).toBeNull();
    expect(changeRatio(3, 0)).toBeNull();
    expect(changeRatio(null, null)).toBeNull();
    expect(changeRatio("150.00", "100.00")).toBe(50);
    expect(changeRatio("100.00", "125.00")).toBe(-20);
  });
});

describe("buildAnalyticsReport", () => {
  it("sums money as decimals and keeps the totals as strings", async () => {
    const { buildAnalyticsReport } = await import("@/data/analytics-demo");
    const report = buildAnalyticsReport(
      [
        order({ id: "A", paidAmount: "0.10", createdAt: "2026-10-18T03:00:00" }),
        order({ id: "B", paidAmount: "0.20", createdAt: "2026-10-19T03:00:00" }),
      ],
      "7d",
      AT,
    );
    // Float arithmetic would answer 0.30000000000000004.
    expect(report.metrics.revenue.current).toBe("0.30");
    expect(report.trend.map((point) => [point.bucket, point.revenue])).toEqual([
      ["2026-10-13", "0.00"],
      ["2026-10-14", "0.00"],
      ["2026-10-15", "0.00"],
      ["2026-10-16", "0.00"],
      ["2026-10-17", "0.00"],
      ["2026-10-18", "0.10"],
      ["2026-10-19", "0.20"],
    ]);
  });

  it("subtracts refunds from revenue and excludes unpaid statuses", async () => {
    const { buildAnalyticsReport } = await import("@/data/analytics-demo");
    const report = buildAnalyticsReport(
      [
        order({ id: "A", status: "completed", paidAmount: "500.00", refundedAmount: "100.00" }),
        order({ id: "B", status: "pending", paidAmount: "900.00", paymentAt: null }),
        order({ id: "C", status: "closed", paidAmount: "900.00", paymentAt: null }),
      ],
      "7d",
      AT,
    );
    expect(report.metrics.revenue.current).toBe("400.00");
    expect(report.metrics.orders.current).toBe(3);
    expect(report.metrics.averageOrderValue.current).toBe("400.00");
    expect(report.metrics.refundRate.current).toBe(20);
    expect(report.fulfillment).toEqual([
      { name: "submitted", value: 3 },
      { name: "paid", value: 1 },
      { name: "shipped", value: 1 },
      { name: "completed", value: 1 },
    ]);
  });

  it("leaves a metric null rather than reporting zero when it has no meaning", async () => {
    const { buildAnalyticsReport } = await import("@/data/analytics-demo");
    const report = buildAnalyticsReport(
      [order({ id: "A", status: "pending", paidAmount: "0.00", paymentAt: null })],
      "7d",
      AT,
    );
    expect(report.metrics.averageOrderValue.current).toBeNull();
    expect(report.metrics.refundRate.current).toBeNull();
    expect(report.metrics.revenue.current).toBe("0.00");
  });

  it("ignores rows outside the selected window", async () => {
    const { buildAnalyticsReport } = await import("@/data/analytics-demo");
    const report = buildAnalyticsReport(
      [
        order({ id: "inside", createdAt: "2026-10-13T00:00:00" }),
        order({ id: "before", createdAt: "2026-10-12T23:59:59" }),
        order({ id: "after", createdAt: "2026-10-19T12:30:00" }),
      ],
      "7d",
      AT,
    );
    expect(report.metrics.orders.current).toBe(1);
    expect(report.trend[0].orders).toBe(1);
  });

  it("groups channels and payment methods by stored value, keeping the empty one", async () => {
    const { buildAnalyticsReport } = await import("@/data/analytics-demo");
    const report = buildAnalyticsReport(
      [
        order({ id: "A", source: "小程序", paymentMethod: "微信支付" }),
        order({ id: "B", source: "小程序", paymentMethod: "微信支付" }),
        order({ id: "C", source: "线下", paymentMethod: "" }),
      ],
      "7d",
      AT,
    );
    expect(report.channels).toEqual([
      { name: "小程序", value: 2 },
      { name: "线下", value: 1 },
    ]);
    expect(report.paymentMethods).toEqual([
      { name: "微信支付", value: 2 },
      { name: "", value: 1 },
    ]);
  });

  it("stays internally consistent: buckets, channels and the funnel all match the window", async () => {
    const { buildAnalyticsReport } = await import("@/data/analytics-demo");
    const orders = Array.from({ length: 45 }, (_unused, index) =>
      order({
        id: `K${index}`,
        createdAt: new Date(Date.UTC(2026, 9, 19 - (index % 40), 5, 0, 0))
          .toISOString()
          .slice(0, 19),
        status: (["paid", "pending", "completed", "refunded"] as const)[index % 4],
        source: (["官方网站", "小程序", "线下"] as const)[index % 3],
      }),
    );
    for (const range of ["7d", "30d", "year"] as const) {
      const report = buildAnalyticsReport(orders, range, AT);
      const expectedBuckets = range === "year" ? 10 : range === "7d" ? 7 : 30;
      expect(report.trend).toHaveLength(expectedBuckets);
      expect(report.trend.reduce((sum, point) => sum + point.orders, 0)).toBe(
        report.metrics.orders.current,
      );
      expect(report.channels.reduce((sum, row) => sum + row.value, 0)).toBe(
        report.metrics.orders.current,
      );
      expect(report.fulfillment[0].value).toBe(report.metrics.orders.current);
    }
  });

  it("derives the shipped demo report from real fixture rows", async () => {
    const { buildAnalyticsReport } = await import("@/data/analytics-demo");
    const { demoOrders } = await import("@/data/demo/orders");
    const now = new Date();
    const report = buildAnalyticsReport(demoOrders, "30d", now);
    expect(report.trend).toHaveLength(30);
    // Rows dated today must not be in the future, or the current window drops them.
    const stamps = demoOrders.map((row) => row.createdAt).sort();
    const oldest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 58));
    expect(stamps[0].slice(0, 10)).toBe(utcStamp(oldest).slice(0, 10));
    // Lexicographic compare on the shared naive-UTC format; no Date parsing.
    expect(stamps[stamps.length - 1] <= utcStamp(now)).toBe(true);
    expect(Number(report.metrics.revenue.current)).toBeGreaterThan(0);
    expect(report.channels.length).toBeGreaterThan(1);
    expect(report.paymentMethods.length).toBeGreaterThan(1);
    // Every bucket inside 30 days still counts, so the totals have to line up.
    expect(report.trend.reduce((sum, point) => sum + point.orders, 0)).toBe(
      report.metrics.orders.current,
    );
  });
});

describe("loadAnalyticsReport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("asks the server for the requested range in API mode", async () => {
    const { loadAnalyticsReport } = await import("@/api/reports");
    const live = (await import("@/utils/request")).default;
    vi.mocked(live.get).mockResolvedValueOnce({ ok: true });
    await expect(loadAnalyticsReport("7d")).resolves.toEqual({ ok: true });
    expect(live.get).toHaveBeenCalledWith("/analytics", { range: "7d" });
  });

  it("builds the same contract from demo rows in mock mode and never calls the API", async () => {
    vi.stubEnv("VITE_USE_MOCK", "true");
    const { loadAnalyticsReport } = await import("@/api/reports");
    const live = (await import("@/utils/request")).default;
    const report = await loadAnalyticsReport("7d");
    expect(live.get).not.toHaveBeenCalled();
    expect(report.trend).toHaveLength(7);
    expect(report.range).toBe("7d");
    expect(report.fulfillment.map((stage) => stage.name)).toEqual([
      "submitted",
      "paid",
      "shipped",
      "completed",
    ]);
  });
});

describe("analyticsToCsv", () => {
  it("exports one row per bucket with the decimal revenue text", async () => {
    const [{ analyticsToCsv }, { buildAnalyticsReport }] = await Promise.all([
      import("@/api/reports"),
      import("@/data/analytics-demo"),
    ]);
    const report = buildAnalyticsReport([order({ id: "A" })], "7d", AT);
    const csv = analyticsToCsv(report);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe("周期,订单量,收入");
    expect(lines[7]).toBe("2026-10-19,1,100.00");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyticsReport } from "@/api/reports";

vi.mock("@/utils/request", () => ({ default: { get: vi.fn(), post: vi.fn() } }));

/**
 * The window arithmetic lives in the server (`admin_api/analytics.py`), so it is tested there.
 * What this page owns is the request it makes and the file it writes from the answer, and the
 * fixture below is a hand-written copy of one `/analytics` response for exactly that.
 */
function report(): AnalyticsReport {
  return {
    range: "7d",
    bucket: "day",
    start: "2026-10-13T00:00:00",
    end: "2026-10-19T12:30:00",
    previousStart: "2026-10-06T00:00:00",
    previousEnd: "2026-10-12T12:30:00",
    metrics: {
      revenue: { current: "100.00", previous: "0.00", change: null },
      orders: { current: 1, previous: 0, change: null },
      averageOrderValue: { current: "100.00", previous: null, change: null },
      refundRate: { current: null, previous: null, change: null },
    },
    trend: [
      { bucket: "2026-10-13", orders: 0, revenue: "0.00" },
      { bucket: "2026-10-14", orders: 0, revenue: "0.00" },
      { bucket: "2026-10-15", orders: 0, revenue: "0.00" },
      { bucket: "2026-10-16", orders: 0, revenue: "0.00" },
      { bucket: "2026-10-17", orders: 0, revenue: "0.00" },
      { bucket: "2026-10-18", orders: 0, revenue: "0.00" },
      { bucket: "2026-10-19", orders: 1, revenue: "100.00" },
    ],
    channels: [{ name: "官方网站", value: 1 }],
    paymentMethods: [{ name: "微信支付", value: 1 }],
    fulfillment: [
      { name: "submitted", value: 1 },
      { name: "paid", value: 1 },
      { name: "shipped", value: 0 },
      { name: "completed", value: 0 },
    ],
  };
}

describe("loadAnalyticsReport", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("asks the server for the requested range", async () => {
    const { loadAnalyticsReport } = await import("@/api/reports");
    const live = (await import("@/utils/request")).default;
    vi.mocked(live.get).mockResolvedValueOnce(report());
    await expect(loadAnalyticsReport("7d")).resolves.toMatchObject({ range: "7d" });
    expect(live.get).toHaveBeenCalledWith("/analytics", { range: "7d" });
  });
});

describe("analyticsToCsv", () => {
  it("exports one row per bucket with the decimal revenue text", async () => {
    const { analyticsToCsv } = await import("@/api/reports");
    const lines = analyticsToCsv(report()).split("\r\n");
    expect(lines).toHaveLength(8);
    expect(lines[0]).toBe("周期,订单量,收入");
    expect(lines[7]).toBe("2026-10-19,1,100.00");
  });

  it("keeps the empty buckets the server sent instead of trimming the file", async () => {
    const { analyticsToCsv } = await import("@/api/reports");
    const lines = analyticsToCsv(report()).split("\r\n");
    // A period without orders is a real answer, and the chart above the table counts it too.
    expect(lines[1]).toBe("2026-10-13,0,0.00");
  });
});

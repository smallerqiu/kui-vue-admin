import { appConfig } from "@/config/app";
import request from "@/utils/request";

/** Mirrors `GET /api/analytics` in kui-admin-api; the demo builder returns the same shape. */

export type AnalyticsRange = "7d" | "30d" | "year";

/** `change` is null when the comparison window had no baseline, never a fake 0%. */
export interface Comparison<T> {
  current: T;
  previous: T;
  change: number | null;
}
/** Money leaves the API as decimal text so no binary float rounding enters the totals. */
export interface AnalyticsMetrics {
  revenue: Comparison<string>;
  orders: Comparison<number>;
  averageOrderValue: Comparison<string | null>;
  refundRate: Comparison<number | null>;
}
export interface TrendPoint {
  /** UTC bucket key: `YYYY-MM-DD` for day ranges, `YYYY-MM` for the year range. */
  bucket: string;
  orders: number;
  revenue: string;
}
export interface NameValue {
  name: string;
  value: number;
}
export type FulfillmentStage = "submitted" | "paid" | "shipped" | "completed";
export interface AnalyticsReport {
  range: AnalyticsRange;
  bucket: "day" | "month";
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  metrics: AnalyticsMetrics;
  /** Continuous buckets: periods without orders are present with zero values. */
  trend: TrendPoint[];
  channels: NameValue[];
  paymentMethods: NameValue[];
  fulfillment: Array<{ name: FulfillmentStage; value: number }>;
}

export const analyticsRanges: AnalyticsRange[] = ["7d", "30d", "year"];

export function isAnalyticsRange(value: unknown): value is AnalyticsRange {
  return analyticsRanges.includes(value as AnalyticsRange);
}

export const reportsApi = {
  analytics: (range: AnalyticsRange) => request.get<AnalyticsReport>("/analytics", { range }),
};

/**
 * One page code path for both data sources: demo mode derives the report from
 * the offline orders fixture, API mode asks the server. The server also applies
 * the account's data scope, which offline mode cannot. A failed request is never
 * answered with demo figures, so the offline modules load only in demo mode and
 * stay out of the API bundle.
 */
export async function loadAnalyticsReport(range: AnalyticsRange): Promise<AnalyticsReport> {
  if (!appConfig.useMock) return reportsApi.analytics(range);
  const [{ buildAnalyticsReport }, { demoOrders }] = await Promise.all([
    import("@/data/analytics-demo"),
    import("@/data/demo/orders"),
  ]);
  return buildAnalyticsReport(demoOrders, range);
}

const csvCell = (value: string | number) =>
  /[",\n]/.test(String(value)) ? `"${String(value).replace(/"/g, '""')}"` : String(value);

/** The trend table is the part users re-import elsewhere; totals stay on the page. */
export function analyticsToCsv(report: AnalyticsReport): string {
  const rows = [["周期", "订单量", "收入"], ...report.trend.map((point) => [point.bucket, point.orders, point.revenue])];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

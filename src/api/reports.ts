import { toCsv } from "@/utils/csv";
import request from "@/utils/request";

/** Mirrors `GET /api/analytics` in kui-admin-api. */

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

/**
 * The report is the server's arithmetic: it applies this account's data scope and
 * compares two equal windows, neither of which the page could do from one list page.
 */
export const loadAnalyticsReport = (range: AnalyticsRange) =>
  request.get<AnalyticsReport>("/analytics", { range });

/** The trend table is the part users re-import elsewhere; totals stay on the page. */
export function analyticsToCsv(report: AnalyticsReport): string {
  return toCsv([
    ["周期", "订单量", "收入"],
    ...report.trend.map((point) => [point.bucket, point.orders, point.revenue]),
  ]);
}

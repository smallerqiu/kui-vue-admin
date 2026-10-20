import Big from "big.js";
import { utcStamp } from "@/utils/common";
import type { OrderRecord, OrderStatus } from "@/api/commerce";
import type {
  AnalyticsMetrics,
  AnalyticsRange,
  AnalyticsReport,
  Comparison,
  NameValue,
  TrendPoint,
} from "@/api/reports";

/**
 * Offline twin of `admin_api/analytics.py`. Both paths feed the same page, so
 * this mirrors the server rules exactly: the same paid/shipped/completed status
 * sets, the same window arithmetic, continuous UTC buckets, decimal money, and a
 * null comparison whenever the previous window has no baseline.
 *
 * Rounding note: the server rounds with Python's banker's rounding, Big.js rounds
 * half-up here. They can differ by 0.01 on an exact tie, which only shows on the
 * offline demo and never changes a total.
 */

export const PAID_STATUSES: OrderStatus[] = [
  "paid",
  "partial_shipped",
  "shipped",
  "completed",
  "refunded",
];
export const SHIPPED_STATUSES: OrderStatus[] = [
  "partial_shipped",
  "shipped",
  "completed",
  "refunded",
];
export const COMPLETED_STATUSES: OrderStatus[] = ["completed"];

const RANGE_DAYS: Record<"7d" | "30d", number> = { "7d": 7, "30d": 30 };
const DAY_MS = 86_400_000;

export interface Window {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
}

/** Rolling ranges count N natural UTC days including today; "year" is year-to-date. */
export function analyticsWindows(range: AnalyticsRange, at: Date): Window {
  if (range === "year") {
    const start = new Date(Date.UTC(at.getUTCFullYear(), 0, 1));
    return {
      start,
      end: at,
      previousStart: new Date(Date.UTC(start.getUTCFullYear() - 1, 0, 1)),
      // 去年同期, not a whole previous year: an equal-length window is what makes
      // the comparison honest, and Feb 29th has no counterpart in a common year.
      previousEnd: shiftYear(at),
    };
  }
  const days = RANGE_DAYS[range];
  const start = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() - (days - 1)),
  );
  return {
    start,
    end: at,
    previousStart: new Date(start.getTime() - days * DAY_MS),
    previousEnd: new Date(at.getTime() - days * DAY_MS),
  };
}

function shiftYear(moment: Date): Date {
  const year = moment.getUTCFullYear() - 1;
  const month = moment.getUTCMonth();
  const day = moment.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(day, lastDay),
      moment.getUTCHours(),
      moment.getUTCMinutes(),
      moment.getUTCSeconds(),
    ),
  );
}

export type Bucket = "day" | "month";

/** Continuous buckets so periods without orders stay visible on the chart. */
export function bucketSequence(start: Date, end: Date, bucket: Bucket): string[] {
  const labels: string[] = [];
  if (bucket === "month") {
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      labels.push(utcStamp(cursor).slice(0, 7));
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    return labels;
  }
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    labels.push(utcStamp(cursor).slice(0, 10));
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return labels;
}

/** Percentage change, or null when the previous window gives no baseline. */
export function changeRatio(current: string | number | null, previous: string | number | null) {
  const base = Big(previous ?? 0);
  if (base.eq(0)) return null;
  return Number(Big(current ?? 0).minus(base).div(base).times(100).round(1).toFixed(1));
}

// Fixed-width naive UTC stamps compare lexicographically, which is the same
// ordering the server's datetime columns use.
function inWindow(rows: OrderRecord[], start: Date, end: Date) {
  const from = utcStamp(start),
    to = utcStamp(end);
  return rows.filter((row) => row.createdAt >= from && row.createdAt < to);
}

const total = (rows: OrderRecord[], pick: (row: OrderRecord) => string) =>
  rows.reduce((sum, row) => sum.plus(pick(row)), new Big(0)).toFixed(2);

function summarize(rows: OrderRecord[]) {
  const paid = rows.filter((row) => PAID_STATUSES.includes(row.status));
  return {
    orders: rows.length,
    paidOrders: paid.length,
    shippedOrders: rows.filter((row) => SHIPPED_STATUSES.includes(row.status)).length,
    completedOrders: rows.filter((row) => COMPLETED_STATUSES.includes(row.status)).length,
    revenue: total(paid, (row) => Big(row.paidAmount).minus(row.refundedAmount).toFixed(2)),
    paidAmount: total(paid, (row) => row.paidAmount),
    refundedAmount: total(paid, (row) => row.refundedAmount),
  };
}

type Summary = ReturnType<typeof summarize>;

function comparison<T>(current: T, previous: T): Comparison<T> {
  return { current, previous, change: changeRatio(current as string | number, previous as string | number) };
}

function metrics(current: Summary, previous: Summary): AnalyticsMetrics {
  // Null, not 0: no paid orders means there is no average order value to report.
  const average = (row: Summary) =>
    row.paidOrders === 0 ? null : Big(row.revenue).div(row.paidOrders).round(2).toFixed(2);
  const refundRate = (row: Summary) =>
    Big(row.paidAmount).eq(0)
      ? null
      : Number(Big(row.refundedAmount).div(row.paidAmount).times(100).round(2).toFixed(2));
  const [currentAverage, previousAverage] = [average(current), average(previous)];
  const [currentRate, previousRate] = [refundRate(current), refundRate(previous)];
  return {
    revenue: comparison(current.revenue, previous.revenue),
    orders: comparison(current.orders, previous.orders),
    averageOrderValue: {
      current: currentAverage,
      previous: previousAverage,
      change: currentAverage !== null && previousAverage !== null ? changeRatio(currentAverage, previousAverage) : null,
    },
    refundRate: {
      current: currentRate,
      previous: previousRate,
      change: currentRate !== null && previousRate !== null ? changeRatio(currentRate, previousRate) : null,
    },
  };
}

/** Server orders by count then by the stored value; empty values stay empty strings. */
function grouped(rows: OrderRecord[], pick: (row: OrderRecord) => string): NameValue[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = pick(row) || "";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
}

function trend(rows: OrderRecord[], start: Date, end: Date, bucket: Bucket): TrendPoint[] {
  const key = (row: OrderRecord) => row.createdAt.slice(0, bucket === "month" ? 7 : 10);
  const counts = new Map<string, number>();
  const revenue = new Map<string, string>();
  for (const row of rows) {
    const label = key(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
    if (!PAID_STATUSES.includes(row.status)) continue;
    const sum = Big(revenue.get(label) ?? 0).plus(row.paidAmount).minus(row.refundedAmount);
    revenue.set(label, sum.toFixed(2));
  }
  return bucketSequence(start, end, bucket).map((label) => ({
    bucket: label,
    orders: counts.get(label) ?? 0,
    revenue: revenue.get(label) ?? "0.00",
  }));
}

export function buildAnalyticsReport(
  orders: OrderRecord[],
  range: AnalyticsRange,
  at: Date = new Date(),
): AnalyticsReport {
  const bucket: Bucket = range === "year" ? "month" : "day";
  const { start, end, previousStart, previousEnd } = analyticsWindows(range, at);
  const currentRows = inWindow(orders, start, end);
  const current = summarize(currentRows);
  const previous = summarize(inWindow(orders, previousStart, previousEnd));
  return {
    range,
    bucket,
    start: utcStamp(start),
    end: utcStamp(end),
    previousStart: utcStamp(previousStart),
    previousEnd: utcStamp(previousEnd),
    metrics: metrics(current, previous),
    trend: trend(currentRows, start, end, bucket),
    channels: grouped(currentRows, (row) => row.source),
    paymentMethods: grouped(currentRows, (row) => row.paymentMethod),
    fulfillment: [
      { name: "submitted", value: current.orders },
      { name: "paid", value: current.paidOrders },
      { name: "shipped", value: current.shippedOrders },
      { name: "completed", value: current.completedOrders },
    ],
  };
}

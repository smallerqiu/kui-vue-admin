import request from "@/utils/request";
import type { PageResult } from "./catalog";

/**
 * Mirrors `GET|POST|PUT|DELETE /api/calendar` in kui-admin-api.
 *
 * The month is read as a window (`dateFrom`/`dateTo`), not as page 1 of the whole
 * table, so a busy month never hides events behind pagination and an empty month
 * costs one short request. This page has no demo data source: it talks to the API
 * only, and a failed request is reported instead of being answered with samples.
 */

export type CalendarCategory = "meeting" | "project" | "personal" | "deadline";

export const calendarCategories: Record<CalendarCategory, { label: string; color: string }> = {
  meeting: { label: "会议", color: "#3a95ff" },
  project: { label: "项目", color: "#7b61ff" },
  personal: { label: "个人", color: "#22a06b" },
  deadline: { label: "截止事项", color: "#ef6b73" },
};

export const calendarCategoryOptions = (
  Object.entries(calendarCategories) as [CalendarCategory, { label: string }][]
).map(([value, item]) => ({ value, label: item.label }));

/** `calendar_events` row, camelCased by the server. */
export interface CalendarRecord {
  id: string;
  title: string;
  /** `YYYY-MM-DD`, as stored. */
  date: string;
  /** `HH:MM:SS`; MySQL keeps the seconds the form does not collect. */
  time: string;
  category: CalendarCategory;
  location: string | null;
  attendees: string | null;
  online: boolean;
  description: string | null;
  ownerId: string;
  departmentId: string | null;
  createdAt: string;
  [key: string]: unknown;
}

/** Everything the table stores except the identity the server assigns. */
export interface CalendarForm {
  title: string;
  date: string;
  time: string;
  category: CalendarCategory;
  location: string;
  attendees: string;
  online: boolean;
  description: string;
}

export interface CalendarMonth {
  events: CalendarRecord[];
  total: number;
  /** True when the month held more rows than this loader reads. */
  truncated: boolean;
}

export interface MonthWindow {
  from: string;
  to: string;
}

/**
 * A page walks one month at a time and the server caps a page at 100 rows, so this
 * is the reading limit for a single month. Beyond it the page says so instead of
 * presenting a partial month as the whole schedule.
 */
export const MAX_MONTH_EVENTS = 500;

const asCategory = (value: unknown): CalendarCategory =>
  value === "project" || value === "personal" || value === "deadline" || value === "meeting"
    ? value
    : "meeting";

const asText = (value: unknown): string => (value == null ? "" : String(value));

/** Keeps a row usable even when seeded data left a column NULL. */
export function toCalendarRecord(row: Record<string, unknown>): CalendarRecord {
  return {
    ...row,
    id: asText(row.id),
    title: asText(row.title),
    date: asText(row.date),
    time: asText(row.time),
    category: asCategory(row.category),
    location: row.location == null ? null : asText(row.location),
    attendees: row.attendees == null ? null : asText(row.attendees),
    online: Boolean(row.online),
    description: row.description == null ? null : asText(row.description),
    ownerId: asText(row.ownerId),
    departmentId: row.departmentId == null ? null : asText(row.departmentId),
    createdAt: asText(row.createdAt),
  } as CalendarRecord;
}

/**
 * A month window is derived here rather than from the component's rendered grid:
 * the cells show neighbouring days, but the schedule belongs to the calendar month.
 */
export function monthWindow(year: number, month: number): MonthWindow {
  const pad = (value: number) => String(value).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

/** `09:30:00` is what MySQL returns; a schedule reads better without seconds. */
export const formatTime = (value: string) => (/:00$/.test(value) ? value.slice(0, -3) : value);

export const calendarApi = {
  save: (form: CalendarForm, id?: string) =>
    id
      ? request.put<Record<string, unknown>>(`/calendar/${encodeURIComponent(id)}`, form)
      : request.post<Record<string, unknown>>("/calendar", form),
  remove: (id: string) => request.delete(`/calendar/${encodeURIComponent(id)}`),
};

/** Reads every page the month needs, so the day panel and the legend stay truthful. */
export async function loadCalendarMonth(
  window: MonthWindow,
  category?: CalendarCategory,
): Promise<CalendarMonth> {
  const events: CalendarRecord[] = [];
  let total = 0;
  for (let page = 1; ; page++) {
    const result = await fetchMonthPage(window, category, page);
    total = result.total;
    events.push(...result.items.map(toCalendarRecord));
    if (!result.items.length || events.length >= total || events.length >= MAX_MONTH_EVENTS) break;
  }
  return { events: events.sort(byDateThenTime), total, truncated: events.length < total };
}

async function fetchMonthPage(
  window: MonthWindow,
  category: CalendarCategory | undefined,
  page: number,
) {
  return request.get<PageResult<Record<string, unknown>>>("/calendar", {
    dateFrom: window.from,
    dateTo: window.to,
    page,
    pageSize: 100,
    ...(category ? { category } : {}),
  });
}

function byDateThenTime(a: CalendarRecord, b: CalendarRecord) {
  return a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date);
}

export async function saveCalendarEvent(form: CalendarForm, id?: string): Promise<CalendarRecord> {
  return toCalendarRecord(id ? await calendarApi.save(form, id) : await calendarApi.save(form));
}

export async function removeCalendarEvent(id: string): Promise<void> {
  await calendarApi.remove(id);
}

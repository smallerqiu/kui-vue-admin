import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_MONTH_EVENTS,
  calendarCategories,
  formatTime,
  loadCalendarMonth,
  monthWindow,
  removeCalendarEvent,
  saveCalendarEvent,
  toCalendarRecord,
  type CalendarForm,
} from "@/api/calendar";
import request from "@/utils/request";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const put = vi.mocked(request.put);
const del = vi.mocked(request.delete);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

const page = (items: object[], total: number, pageNumber: number) => ({
  items,
  total,
  page: pageNumber,
  pageSize: 100,
});

const row = (id: string, date: string, time: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `日程 ${id}`,
  date,
  time,
  category: "meeting",
  location: "会议室",
  attendees: "6 人",
  online: false,
  description: "",
  ownerId: "u1",
  departmentId: null,
  createdAt: "2026-10-01T00:00:00",
  ...extra,
});

const form: CalendarForm = {
  title: "产品周会",
  date: "2026-10-22",
  time: "09:30",
  category: "meeting",
  location: "腾讯会议",
  attendees: "8 人",
  online: true,
  description: "同步本周进展。",
};

describe("calendar month window", () => {
  it("spans the calendar month, including a leap February", () => {
    expect(monthWindow(2026, 10)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthWindow(2026, 9)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthWindow(2024, 2)).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthWindow(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("queries the window instead of paging the whole table", async () => {
    get.mockResolvedValue(page([row("1", "2026-10-05", "18:00:00")], 1, 1));
    const result = await loadCalendarMonth(monthWindow(2026, 10));
    expect(get).toHaveBeenCalledWith("/calendar", {
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      page: 1,
      pageSize: 100,
    });
    expect(result.total).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("adds the category only when one is selected", async () => {
    get.mockResolvedValue(page([], 0, 1));
    await loadCalendarMonth(monthWindow(2026, 10), "project");
    expect(get.mock.calls[0][1]).toMatchObject({ category: "project" });

    get.mockResolvedValue(page([], 0, 1));
    await loadCalendarMonth(monthWindow(2026, 10), undefined);
    expect("category" in (get.mock.calls[1][1] as object)).toBe(false);
  });

  it("reads every page a month holds", async () => {
    get
      .mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, index) => row(`${index}`, "2026-10-02", "10:00:00")), 150, 1))
      .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, index) => row(`p2-${index}`, "2026-10-03", "09:00:00")), 150, 2));
    const result = await loadCalendarMonth(monthWindow(2026, 10));
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.events).toHaveLength(150);
    expect(result.truncated).toBe(false);
  });

  it("stops at the reading limit and reports the month as incomplete", async () => {
    get.mockResolvedValue(
      page(
        Array.from({ length: 100 }, (_, index) => row(`${index}`, "2026-10-02", "10:00:00")),
        MAX_MONTH_EVENTS + 100,
        1,
      ),
    );
    const result = await loadCalendarMonth(monthWindow(2026, 10));
    expect(result.events).toHaveLength(MAX_MONTH_EVENTS);
    expect(result.truncated).toBe(true);
  });

  it("orders the month by date then time, not by arrival", async () => {
    get.mockResolvedValue(
      page(
        [
          row("late", "2026-10-20", "18:00:00"),
          row("early", "2026-10-02", "09:00:00"),
          row("second", "2026-10-20", "09:00:00"),
        ],
        3,
        1,
      ),
    );
    const result = await loadCalendarMonth(monthWindow(2026, 10));
    expect(result.events.map((event) => event.id)).toEqual(["early", "second", "late"]);
  });

  it("carries a failed request instead of answering with samples", async () => {
    get.mockRejectedValue(new Error("账号或密码不正确"));
    await expect(loadCalendarMonth(monthWindow(2026, 10))).rejects.toThrow("账号或密码不正确");
  });
});

describe("calendar record shape", () => {
  it("drops the seconds MySQL returns", () => {
    expect(formatTime("09:30:00")).toBe("09:30");
    expect(formatTime("18:00:00")).toBe("18:00");
    expect(formatTime("09:30")).toBe("09:30");
  });

  it("keeps a NULL column readable and an unknown category from crashing the legend", () => {
    const record = toCalendarRecord(
      row("1", "2026-10-02", "09:00:00", { location: null, category: "other" }),
    );
    // NULL stays NULL rather than becoming the text "null"; the page prints its own
    // "未填写地点" placeholder for it.
    expect(record.location).toBeNull();
    expect(record.online).toBe(false);
    expect(record.category).toBe("meeting");
    // The legend and the grid dot both read this map, so every value must resolve.
    expect(calendarCategories[record.category].color).toBe("#3a95ff");
    expect(toCalendarRecord(row("2", "2026-10-02", "09:00:00", { online: 1 })).online).toBe(true);
  });
});

describe("calendar writes", () => {
  it("creates with POST and edits with PUT, sending only the columns the table has", async () => {
    post.mockResolvedValue(row("1", form.date, "09:30:00", form));
    const created = await saveCalendarEvent(form);
    expect(post).toHaveBeenCalledWith("/calendar", form);
    expect(created.id).toBe("1");

    put.mockResolvedValue(row("1", form.date, "09:30:00", { ...form, online: false }));
    await saveCalendarEvent({ ...form, online: false }, "1");
    expect(put).toHaveBeenCalledWith("/calendar/1", { ...form, online: false });
  });

  it("encodes the id on delete and resolves only when the server agrees", async () => {
    del.mockResolvedValue({ ok: true });
    await removeCalendarEvent("a b/c");
    expect(del).toHaveBeenCalledWith("/calendar/a%20b%2Fc");

    del.mockRejectedValue(new Error("Record not found"));
    await expect(removeCalendarEvent("missing")).rejects.toThrow("Record not found");
  });

  it("hands the page the row the server stored, not the form it sent", async () => {
    put.mockResolvedValue(row("7", "2026-10-23", "14:00:00", { title: "改期后的日程" }));
    const saved = await saveCalendarEvent({ ...form, date: "2026-10-22" }, "7");
    expect(saved.date).toBe("2026-10-23");
    expect(saved.title).toBe("改期后的日程");
  });
});

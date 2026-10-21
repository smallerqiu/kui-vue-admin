import Big from "big.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "K", "M", "G", "T"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(100 * (bytes / Math.pow(k, i))) / 100 + "" + sizes[i];
}
export function formatNumber(number: number) {
  if (number >= 1000000000) {
    const result = new Big(number).div(1000000000).toFixed(1);
    return result + "B";
  } else if (number >= 1000000) {
    return (number / 1000000).toFixed(1) + "M";
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + "K";
  } else {
    return number.toString();
  }
}
dayjs.extend(utc);

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Naive UTC ISO without an offset — the exact wire format kui-admin-api uses for
 * timestamps. `new Date("2026-10-19T01:02:03")` would read that as local time, so
 * window bounds compare these strings instead of Date objects.
 */
export function utcStamp(value: Date): string {
  return (
    `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}` +
    `T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`
  );
}

/**
 * Reads one of those stamps the way it was written: `2026-10-20T08:59:02.975709` becomes
 * `2026-10-20 08:59`. No zone shift and no `Date` object, because a row that displayed
 * its own instant in the viewer's zone would show a created time eight hours away from
 * the last-seen time sitting next to it. Day and minute are all the screens have room
 * for; the seconds the server always sends carry nothing an operator acts on.
 */
export function formatDateTime(value: string | null | undefined) {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : (value ?? "—");
}

/**
 * Primary keys are 32 hex characters, which no one reads off a list. The first eight
 * separate the rows on screen; the whole value stays available on hover and in full on
 * the detail page, which is where it gets quoted from.
 */
export function shortId(value: string) {
  return value.length > 8 ? value.slice(0, 8) : value;
}

/** Joins the parts a cell has to say, skipping the ones the record leaves empty. */
export function joinParts(...parts: (string | null | undefined)[]) {
  return parts.filter((part) => part && part.trim()).join(" · ");
}

/**
 * Money leaves the API as two-decimal text, and text does not group itself: `toLocaleString` on a
 * string is the one inherited from `Object.prototype`, which hands the same characters back, so
 * "12345.00" prints as 12345.00 no matter how many times it is called. Converting first is the
 * whole fix, and the two decimals are then held in place — a row worth 12345.00 must not round
 * down to 12,345 and one worth 0.50 must not lose its cent to 0.5.
 *
 * The separator is pinned to `en-US` rather than left to the browser because the application has
 * no language switch yet (its own copy is Chinese, Kui's built-in strings are English), and a
 * figure that changes shape with the operator's OS locale cannot be checked on screen or in a
 * test. An empty value stays empty: a cell the server left blank is not a zero somebody paid.
 */
export function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseTime(date: string) {
  return dayjs(date).format("YYYY/MM/DD HH:mm:ss");
}

export function decodeJwt(token: string) {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );

  return JSON.parse(jsonPayload);
}

export const dateRange = () => {
  return [
    { label: "Past 30 minutes", value: () => [dayjs().add(-30, "m"), dayjs()] },
    { label: "Past 1 hour", value: () => [dayjs().add(-1, "h"), dayjs()] },
    { label: "Past 2 hours", value: () => [dayjs().add(-2, "h"), dayjs()] },
    { label: "Past 3 hours", value: () => [dayjs().add(-3, "h"), dayjs()] },
    { label: "Past 6 hours", value: () => [dayjs().add(-6, "h"), dayjs()] },
    { label: "Past 12 hours", value: () => [dayjs().add(-12, "h"), dayjs()] },
    { label: "Past 1 day", value: () => [dayjs().add(-24, "h"), dayjs()] },
    { label: "Past 3 days", value: () => [dayjs().add(-72, "h"), dayjs()] },
  ];
};

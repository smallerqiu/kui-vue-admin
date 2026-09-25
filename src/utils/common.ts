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

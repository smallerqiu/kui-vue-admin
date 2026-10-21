import {
  clearAuthSession,
  getAuthUser,
  getToken,
  getRefreshToken,
  isTokenExpired,
  setAuthSession,
} from "@/utils/auth";
import { beforeEach, describe, expect, it } from "vitest";

describe("auth session", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // The transport reads the expiry off the token so a cold boot refreshes before it asks the server
  // anything, so the claim has to survive the base64url payload a signed token carries.
  it("reads the expiry off a signed token", () => {
    const token = (payload: unknown) =>
      `${btoa(JSON.stringify({ alg: "HS256" }))}.${btoa(JSON.stringify(payload))}.signature`;
    expect(isTokenExpired(token({ exp: 1_000 }), 2_000_000)).toBe(true);
    expect(isTokenExpired(token({ exp: 2_000 }), 1_000_000)).toBe(false);
    // Unreadable means the server decides, not that the session is over.
    expect(isTokenExpired(token({}))).toBe(false);
    expect(isTokenExpired("demo-1730000000000")).toBe(false);
    expect(isTokenExpired("header.@@@not-base64@@@.signature")).toBe(false);
  });

  it("persists remembered sessions in localStorage", () => {
    setAuthSession("local-token", { name: "admin" }, true);
    expect(localStorage.getItem("token")).toBe("local-token");
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(getAuthUser().name).toBe("admin");
  });

  it("stores temporary sessions in sessionStorage and clears stale values", () => {
    localStorage.setItem("token", "stale");
    setAuthSession("session-token", { name: "operator" }, false);
    expect(getToken()).toBe("session-token");
    expect(localStorage.getItem("token")).toBeNull();
    expect(getAuthUser().name).toBe("operator");
  });

  it("clears both storage scopes", () => {
    setAuthSession("token", { name: "admin" });
    clearAuthSession();
    expect(getToken()).toBe("");
    expect(getAuthUser()).toEqual({});
  });

  it("never carries a refresh token between accounts or storage scopes", () => {
    setAuthSession("a", { name: "a" }, true, "refresh-a");
    setAuthSession("b", { name: "b" }, false, "refresh-b");
    expect(localStorage.getItem("refresh_token")).toBeNull();
    expect(getRefreshToken()).toBe("refresh-b");
    setAuthSession("c", { name: "c" }, false);
    expect(getRefreshToken()).toBe("");
  });
});

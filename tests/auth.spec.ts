import {
  clearAuthSession,
  getAuthUser,
  getToken,
  setAuthSession,
} from "@/utils/auth";
import { beforeEach, describe, expect, it } from "vitest";

describe("auth session", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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
});

import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("kui-vue", () => ({ message: { error: vi.fn(), show: vi.fn() } }));
vi.mock("@/config/app", () => ({ appConfig: { useMock: false, apiBaseUrl: "/api" } }));
import request from "@/utils/request";
import { getRefreshToken, getToken, setAuthSession, clearAuthSession } from "@/utils/auth";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

describe("real API transport", () => {
  beforeEach(() => {
    localStorage.clear(); sessionStorage.clear();
    request._refreshPromise = null;
    request._401Lock = false;
  });

  it("keeps explicit empty strings and null when updating a record", async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    await request.put("/auth/me", { email: "", phone: "", departmentId: null });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ email: "", phone: "", departmentId: null });
  });

  it("shares refresh and persists both rotated tokens for temporary sessions", async () => {
    setAuthSession("old", { name: "a" }, false, "old-refresh");
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith("/auth/refresh")) return json({ token: "new", refreshToken: "new-refresh", user: { name: "a" } });
      return new Headers(options.headers).get("Authorization") === "Bearer new"
        ? json({ ok: true }) : json({ msg: "expired" }, 401);
    });
    vi.stubGlobal("fetch", fetcher);
    await Promise.all([request.get("/first"), request.get("/second")]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
    expect(getToken()).toBe("new");
    expect(getRefreshToken()).toBe("new-refresh");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("does not restore credentials after logout during refresh", async () => {
    setAuthSession("old", {}, false, "old-refresh");
    let complete!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; })));
    const pending = request.refreshSession();
    clearAuthSession();
    complete(json({ token: "new", refreshToken: "new-refresh", user: {} }));
    expect(await pending).toBe(false);
    expect(getToken()).toBe("");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("kui-vue", () => ({ message: { error: vi.fn(), show: vi.fn() } }));
vi.mock("@/config/app", () => ({ appConfig: { apiBaseUrl: "/api" } }));
import request from "@/utils/request";
import { message } from "kui-vue";
import { getRefreshToken, getToken, setAuthSession, clearAuthSession } from "@/utils/auth";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});

// The api signs access tokens with an `exp` claim, and the transport reads it the same way.
const signed = (expiresAtSeconds: number) =>
  `${btoa(JSON.stringify({ alg: "HS256" }))}.${btoa(JSON.stringify({ exp: expiresAtSeconds }))}.signature`;

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

  // A session that sat past its access token's lifetime used to open every page with a request the
  // server had already refused. The stale token must never leave the browser.
  it("refreshes a stored token that passed its expiry before sending it", async () => {
    setAuthSession(signed((Date.now() - 1_000) / 1000), { name: "a" }, false, "old-refresh");
    const asked: string[] = [];
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith("/auth/refresh"))
        return json({ token: "fresh", refreshToken: "new-refresh", user: { name: "a" } });
      const bearer = new Headers(options.headers).get("Authorization") || "";
      asked.push(bearer);
      return bearer === "Bearer fresh" ? json({ ok: true }) : json({ msg: "expired" }, 401);
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(request.get("/navigation")).resolves.toEqual({ ok: true });
    expect(asked).toEqual(["Bearer fresh"]);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("sends a token still inside its lifetime without refreshing", async () => {
    setAuthSession(signed((Date.now() + 60_000) / 1000), { name: "a" }, false, "old-refresh");
    const fetcher = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    await expect(request.get("/navigation")).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getRefreshToken()).toBe("old-refresh");
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

  // Two tabs of one session share the stored refresh token, and the server rotates it in
  // place, so the tab that loses that race is told its token is spent. Its session is not
  // over - the winner has already written the new pair where both tabs can read it.
  it("adopts the rotated tokens the other tab stored instead of logging out", async () => {
    setAuthSession("old", { name: "a" }, false, "r1");
    const fetcher = vi.fn(async (url: string, options: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        setAuthSession("t2", { name: "a" }, false, "r2");
        return json({ msg: "refresh token already spent" }, 401);
      }
      return new Headers(options.headers).get("Authorization") === "Bearer t2"
        ? json({ ok: true })
        : json({ msg: "expired" }, 401);
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(request.get("/data")).resolves.toEqual({ ok: true });
    expect(getToken()).toBe("t2");
    expect(getRefreshToken()).toBe("r2");
    expect(message.show).not.toHaveBeenCalled();
  });

  // A refresh that really is spent still ends the session; only a token the shared
  // storage proves to have moved on counts as the other tab winning.
  it("still logs out when no tab rotated the token", async () => {
    setAuthSession("old", { name: "a" }, false, "r1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/auth/refresh")
          ? json({ msg: "refresh token already spent" }, 401)
          : json({ msg: "expired" }, 401),
      ),
    );
    await expect(request.get("/data")).rejects.toThrow();
    expect(getToken()).toBe("");
    expect(message.show).toHaveBeenCalledOnce();
  });
});

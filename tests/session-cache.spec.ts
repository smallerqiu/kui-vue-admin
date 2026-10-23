import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, watch } from "vue";
import { clearAuthSession, setAuthSession } from "@/utils/auth";
import { loadServerMenu } from "@/routers/server-menu";
import { sessionSignature, useAuthStore } from "@/stores/auth";
import type { AdminMenuItem } from "@/components/system/useMenu";
import request from "@/utils/request";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const localMenu = [
  {
    key: "/system",
    path: "/system",
    meta: { title: "System" },
    children: [{ key: "/system/users", path: "/system/users", meta: { title: "Users" } }],
  },
] as unknown as AdminMenuItem[];

const allowedUsers = [{ path: "/system/users", sortOrder: 1, permissionCode: "system:user:read" }];

describe("server menu session cache", () => {
  afterEach(() => {
    clearAuthSession();
  });

  it("fetches the menu once per account instead of once per navigation", async () => {
    setAuthSession("token-first", { id: "user-first" });
    vi.mocked(request.get).mockResolvedValue(allowedUsers);
    const first = await loadServerMenu(localMenu);
    const second = await loadServerMenu(localMenu);
    expect(request.get).toHaveBeenCalledTimes(1);
    expect(request.get).toHaveBeenCalledWith("/navigation");
    expect(second).toEqual(first);
    expect(first[0].children?.[0].meta.permissions).toEqual(["system:user:read"]);
  });

  it("keys the entry by account so a different login refetches", async () => {
    setAuthSession("token-a", { id: "user-a" });
    vi.mocked(request.get).mockResolvedValue(allowedUsers);
    await loadServerMenu(localMenu);
    setAuthSession("token-b", { id: "user-b" });
    await loadServerMenu(localMenu);
    expect(request.get).toHaveBeenCalledTimes(2);
  });

  it("drops the entry when the fetch fails so the next navigation retries", async () => {
    setAuthSession("token-retry", { id: "user-retry" });
    vi.mocked(request.get).mockRejectedValueOnce(new Error("offline"));
    await expect(loadServerMenu(localMenu)).rejects.toThrow("offline");
    vi.mocked(request.get).mockResolvedValueOnce(allowedUsers);
    await loadServerMenu(localMenu);
    expect(request.get).toHaveBeenCalledTimes(2);
  });

  it("draws nothing before a login", async () => {
    clearAuthSession();
    await expect(loadServerMenu(localMenu)).resolves.toEqual([]);
    expect(request.get).not.toHaveBeenCalled();
  });
});

describe("auth user snapshot", () => {
  beforeEach(() => {
    // Only Date is faked, so the background refresh can still be flushed with real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    localStorage.clear();
    setActivePinia(createPinia());
    setAuthSession("token-user", { id: "user-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  it("awaits the snapshot on the first navigation and never again after that", async () => {
    const snapshot = { id: "user-1", permissions: ["order:read"] };
    vi.mocked(request.get).mockResolvedValue(snapshot);
    const auth = useAuthStore();
    await auth.refreshUser();
    expect(request.get).toHaveBeenCalledTimes(1);
    expect(auth.user.permissions).toEqual(["order:read"]);
    const firstLoadAt = auth.userLoadedAt;

    await auth.refreshUser();
    await auth.refreshUser();
    expect(request.get).toHaveBeenCalledTimes(1);

    // A response this next call deliberately never resolves until the test says so: if the
    // refresh were still on the critical path, the guard would be stuck behind it.
    let deliver = (value: unknown) => void value;
    vi.mocked(request.get).mockImplementationOnce(
      () => new Promise((resolve) => (deliver = resolve)),
    );
    vi.setSystemTime(Date.now() + 61_000);
    let settled = false;
    const navigation = auth.refreshUser().then(() => (settled = true));
    await settle();
    expect(settled).toBe(true);
    expect(request.get).toHaveBeenCalledTimes(2);
    expect(auth.userLoadedAt).toBe(firstLoadAt);

    deliver(snapshot);
    await settle();
    expect(auth.userLoadedAt).toBeGreaterThan(firstLoadAt);
    await navigation;

    vi.setSystemTime(Date.now() + 61_000);
    await auth.refreshUser();
    expect(request.get).toHaveBeenCalledTimes(3);
  });

  it("holds the navigation while there is no snapshot to gate on", async () => {
    vi.mocked(request.get).mockRejectedValueOnce(new Error("offline"));
    const auth = useAuthStore();
    await expect(auth.refreshUser()).rejects.toThrow("offline");
    expect(auth.userLoadedAt).toBe(0);
    expect(auth.userAttemptedAt).toBe(0);

    vi.mocked(request.get).mockResolvedValueOnce({ id: "user-1", permissions: ["*"] });
    await auth.refreshUser();
    expect(auth.permissions).toEqual(["*"]);
  });

  it("treats a login or a profile write as a fresh snapshot", async () => {
    const auth = useAuthStore();
    auth.login("token-login", { id: "user-2", permissions: ["order:read"] });
    expect(auth.userLoadedAt).toBe(Date.now());
    await auth.refreshUser();
    expect(request.get).not.toHaveBeenCalled();

    vi.setSystemTime(Date.now() - 61_000);
    auth.userLoadedAt = auth.userAttemptedAt = 0;
    auth.updateUser({ permissions: ["customer:read"] });
    expect(auth.userLoadedAt).toBe(Date.now());
    await auth.refreshUser();
    expect(request.get).not.toHaveBeenCalled();
  });
});

describe("session signature", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    setAuthSession("token-sign", { id: "user-1", permissions: ["order:read"] });
  });

  // The shell reloads the notification list and the system settings off this value, so a
  // snapshot that repeats what is already drawn has to compare equal.
  it("holds still for a refreshed snapshot that draws the same session", async () => {
    const auth = useAuthStore();
    const fired: string[] = [];
    watch(
      () => sessionSignature(auth.user.id, auth.permissions),
      (value) => fired.push(value),
    );

    auth.updateUser({ id: "user-1", permissions: ["order:read"] });
    await nextTick();
    expect(fired).toEqual([]);

    auth.updateUser({ id: "user-1", permissions: ["order:read", "customer:read"] });
    auth.updateUser({ id: "user-1", permissions: ["order:read", "customer:read"] });
    await nextTick();
    expect(fired).toEqual(["user-1|order:read,customer:read"]);

    auth.updateUser({ id: "user-2", permissions: ["order:read", "customer:read"] });
    await nextTick();
    expect(fired).toEqual(["user-1|order:read,customer:read", "user-2|order:read,customer:read"]);
  });
});

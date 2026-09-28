import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import request from "@/utils/request";
import { formValue, payload, referenceOptions, resources, workspaceApi } from "@/api/workspace";
import { notificationPath } from "@/api/system";
import { useNotificationStore } from "@/stores/notifications";
import { defaultSystemSettings, useSystemSettingsStore } from "@/stores/system-settings";
import { useAuthStore } from "@/stores/auth";
vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setActivePinia(createPinia());
});
describe("workspace contracts", () => {
  it.each(Object.keys(resources))("whitelists writable fields for %s", (key) => {
    const definition = resources[key]!;
    const record = {
      id: "server-id",
      ownerId: "owner",
      createdAt: "date",
      ...formValue(definition),
    };
    const form = formValue(definition, record);
    expect(Object.keys(payload(definition, { ...form, ownerId: "forged" })).sort()).toEqual(
      definition.fields.map((field) => field.key).sort(),
    );
    expect(form).not.toHaveProperty("id");
  });
  it("retains null clearing, empty role arrays and decimal text", async () => {
    const definition = resources.users!;
    const form = formValue(definition, {
      id: "user",
      roleIds: ["role"],
      departmentId: "dept",
      enabled: 0,
    });
    expect(form.enabled).toBe(false);
    form.departmentId = "";
    form.roleIds = [];
    await workspaceApi.save(definition, form, "user");
    expect(request.put).toHaveBeenCalledWith(
      "/users/user",
      expect.objectContaining({ departmentId: null, roleIds: [], password: null }),
    );
    expect(
      payload(resources.approvals!, { ...formValue(resources.approvals!), amount: "0.10" }).amount,
    ).toBe("0.10");
  });
  it("loads all reference pages instead of dropping options after 100", async () => {
    vi.mocked(request.get)
      .mockResolvedValueOnce({ items: [{ id: "a", name: "A" }], total: 2 })
      .mockResolvedValueOnce({ items: [{ id: "b", name: "B" }], total: 2 });
    expect((await referenceOptions("projects")).map((option) => option.value)).toEqual(["a", "b"]);
    expect(request.get).toHaveBeenLastCalledWith("/projects", { page: 2, pageSize: 100 });
  });
  it("rejects external notification links", () => {
    for (const link of [
      "//evil.test",
      "https://evil.test",
      "javascript:alert(1)",
      "/\\evil.test",
      null,
    ])
      expect(notificationPath(link)).toBeUndefined();
    expect(notificationPath("/tasks")).toBe("/tasks");
  });
  it("does not commit settings when saving fails", async () => {
    const store = useSystemSettingsStore();
    vi.mocked(request.put).mockRejectedValueOnce(new Error("Offline"));
    await expect(store.save({ ...defaultSystemSettings, shortName: "Changed" })).rejects.toThrow(
      "Offline",
    );
    expect(store.settings.shortName).toBe(defaultSystemSettings.shortName);
  });
  it("does not mark notifications read optimistically", async () => {
    const store = useNotificationStore();
    store.unreadCount = 5;
    vi.mocked(request.post).mockRejectedValueOnce(new Error("Forbidden"));
    expect(await store.markAllRead()).toBe(false);
    expect(store.unreadCount).toBe(5);
  });
  it("discards another account's pending notification response", async () => {
    const auth = useAuthStore();
    auth.user = { id: "first" };
    const store = useNotificationStore();
    let resolve!: (value: unknown) => void;
    vi.mocked(request.get).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const pending = store.load();
    auth.user = { id: "second" };
    await nextTick();
    resolve({ items: [{ id: "private" }], unreadCount: 1, total: 1, page: 1 });
    await pending;
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
  });
});

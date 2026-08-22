import { useNotificationStore } from "@/stores/notifications";
import { defaultSystemSettings, useSystemSettingsStore } from "@/stores/system-settings";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

describe("persistent stores", () => {
  beforeEach(() => { localStorage.clear(); setActivePinia(createPinia()); });

  it("synchronizes notification read state", () => {
    const store = useNotificationStore();
    expect(store.unreadCount).toBe(3);
    store.markAllRead();
    expect(store.unreadCount).toBe(0);
  });

  it("saves and restores system settings", () => {
    const store = useSystemSettingsStore();
    store.settings.organizationName = "KUI Test";
    store.save();
    expect(JSON.parse(localStorage.getItem("system_settings") || "{}").organizationName).toBe("KUI Test");
    store.reset();
    expect(store.settings.organizationName).toBe(defaultSystemSettings.organizationName);
  });

  it("applies the configured primary color", async () => {
    const store = useSystemSettingsStore();
    store.settings.primaryColor = "#7b61ff";
    await nextTick();
    expect(document.documentElement.style.getPropertyValue("--kui-color-primary")).toBe("#7b61ff");
  });
});

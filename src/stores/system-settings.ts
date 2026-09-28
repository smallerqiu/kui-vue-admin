import { defineStore } from "pinia";
import { reactive, watch } from "vue";
import { systemApi, type SystemSettings } from "@/api/system";
import { useAuthStore } from "./auth";
export type { SystemSettings } from "@/api/system";
export const defaultSystemSettings: SystemSettings = {
  organizationName: "KUI Admin",
  shortName: "KUI Admin",
  domain: "",
  timezone: "Asia/Shanghai",
  locale: "zh-CN",
  primaryColor: "#54a9ff",
  layoutMode: "side",
  sessionTimeout: 120,
  allowMultiLogin: true,
  passwordExpiry: 90,
};
export const useSystemSettingsStore = defineStore("system-settings", () => {
  const settings = reactive<SystemSettings>({ ...defaultSystemSettings });
  const auth = useAuthStore();
  let generation = 0;
  const reset = () => {
    generation++;
    Object.assign(settings, defaultSystemSettings);
  };
  watch(() => auth.user.id, reset);
  async function save(value: SystemSettings) {
    const current = ++generation,
      user = auth.user.id;
    const saved = await systemApi.saveSettings(value);
    if (current === generation && user === auth.user.id) Object.assign(settings, saved);
    return saved;
  }
  function apply(value: SystemSettings) {
    generation++;
    Object.assign(settings, value);
  }
  async function load() {
    const current = generation,
      user = auth.user.id;
    try {
      const value = await systemApi.settings();
      if (current === generation && user === auth.user.id) apply(value);
    } catch {
      /* Keep deployment defaults; the settings page exposes retry. */
    }
  }
  watch(
    () => settings.primaryColor,
    (value) => document.documentElement.style.setProperty("--kui-color-primary", value),
    { immediate: true },
  );
  return { settings, reset, save, apply, load };
});

import { defineStore } from "pinia";
import { reactive, watch } from "vue";
import { appConfig } from "@/config/app";

export interface SystemSettings {
  organizationName: string;
  shortName: string;
  domain: string;
  timezone: string;
  locale: string;
  primaryColor: string;
  sessionTimeout: number;
  allowMultiLogin: boolean;
  passwordExpiry: number;
  orderNotification: boolean;
  securityNotification: boolean;
  weeklyReport: boolean;
}

export const defaultSystemSettings: SystemSettings = {
  organizationName: "KUI Technology Co., Ltd.", shortName: appConfig.shortName, domain: appConfig.siteUrl.replace(/^https?:\/\//, ""),
  timezone: "Asia/Shanghai", locale: "zh-CN", primaryColor: "#54a9ff", sessionTimeout: 120,
  allowMultiLogin: true, passwordExpiry: 90, orderNotification: true, securityNotification: true, weeklyReport: true,
};

const readSettings = (): SystemSettings => {
  try { return { ...defaultSystemSettings, ...JSON.parse(localStorage.getItem("system_settings") || "{}") }; }
  catch { return { ...defaultSystemSettings }; }
};

export const useSystemSettingsStore = defineStore("system-settings", () => {
  const settings = reactive<SystemSettings>(readSettings());
  const applyTheme = () => document.documentElement.style.setProperty("--kui-color-primary", settings.primaryColor);
  const reset = () => Object.assign(settings, defaultSystemSettings);
  const save = () => localStorage.setItem("system_settings", JSON.stringify(settings));
  watch(() => settings.primaryColor, applyTheme, { immediate: true });
  return { settings, reset, save };
});

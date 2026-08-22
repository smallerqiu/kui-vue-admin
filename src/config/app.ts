export const appConfig = Object.freeze({
  name: import.meta.env.VITE_APP_NAME || "KUI Vue Pro",
  shortName: import.meta.env.VITE_APP_SHORT_NAME || "KUI Pro",
  description: import.meta.env.VITE_APP_DESCRIPTION || "Enterprise admin solution powered by KUI Vue",
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, ""),
  siteUrl: import.meta.env.VITE_SITE_URL || "https://admin.k-ui.cn",
});

export const getRuntimeAppName = () => {
  try {
    const settings = JSON.parse(localStorage.getItem("system_settings") || "{}");
    return settings.shortName || appConfig.shortName;
  } catch {
    return appConfig.shortName;
  }
};

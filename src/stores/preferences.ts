import { defineStore } from "pinia";
import { ref, watch } from "vue";

interface Preferences {
  notification: boolean;
  watermark: boolean;
}

const readPreferences = (): Preferences => {
  try {
    return { notification: true, watermark: true, ...JSON.parse(localStorage.getItem("preferences") || "{}") };
  } catch {
    return { notification: true, watermark: true };
  }
};

export const usePreferenceStore = defineStore("preferences", () => {
  const initial = readPreferences();
  const notification = ref(initial.notification);
  const watermark = ref(initial.watermark);

  watch([notification, watermark], () => {
    localStorage.setItem("preferences", JSON.stringify({ notification: notification.value, watermark: watermark.value }));
  });

  return { notification, watermark };
});

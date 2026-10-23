import { defineStore } from "pinia";
import { ref, watch } from "vue";

/**
 * The watermark is the one preference with a reader: `src/App.vue` decides from it whether the
 * business pages carry the account watermark. A switch nobody reads is a setting the operator
 * believes is doing something, which is why the desktop-notification flag is gone -- nothing asked
 * the browser for permission, and nothing on the client turns a server notification into a system
 * one.
 */
interface Preferences {
  watermark: boolean;
}

const readPreferences = (): Preferences => {
  try {
    return {
      watermark: true,
      ...JSON.parse(localStorage.getItem("preferences") || "{}"),
    };
  } catch {
    return { watermark: true };
  }
};

export const usePreferenceStore = defineStore("preferences", () => {
  const watermark = ref(readPreferences().watermark);

  watch(watermark, () => {
    localStorage.setItem("preferences", JSON.stringify({ watermark: watermark.value }));
  });

  return { watermark };
});

import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { systemApi, type NotificationItem } from "@/api/system";
import { useAuthStore } from "./auth";
export type { NotificationItem } from "@/api/system";
export const useNotificationStore = defineStore("notifications", () => {
  const auth = useAuthStore();
  const items = ref<NotificationItem[]>([]),
    unreadCount = ref(0),
    total = ref(0),
    page = ref(1);
  const loading = ref(false),
    saving = ref(false),
    error = ref("");
  let generation = 0;
  function reset() {
    generation++;
    items.value = [];
    unreadCount.value = 0;
    total.value = 0;
    page.value = 1;
    loading.value = false;
    error.value = "";
  }
  watch(() => auth.user.id, reset);
  async function load(target = page.value) {
    const current = ++generation,
      user = auth.user.id;
    loading.value = true;
    error.value = "";
    items.value = [];
    try {
      const result = await systemApi.notifications(target);
      if (current !== generation || user !== auth.user.id) return;
      items.value = result.items;
      total.value = result.total;
      unreadCount.value = result.unreadCount;
      page.value = result.page;
    } catch (reason) {
      if (current === generation) {
        error.value = reason instanceof Error ? reason.message : "加载失败";
        unreadCount.value = 0;
        total.value = 0;
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  async function markRead(id: string) {
    if (saving.value) return false;
    const user = auth.user.id;
    saving.value = true;
    try {
      await systemApi.markRead(id);
      if (user !== auth.user.id) return false;
      await load();
      return true;
    } catch {
      return false;
    } finally {
      saving.value = false;
    }
  }
  const markAllRead = () => markRead("all");
  return {
    items,
    unreadCount,
    total,
    page,
    loading,
    saving,
    error,
    load,
    markRead,
    markAllRead,
    reset,
  };
});

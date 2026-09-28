import { onActivated, onDeactivated, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import request from "@/utils/request";
import type { PageResult } from "@/api/catalog";

/** Server pagination; failed/stale responses never become a successful empty result. */
export function useResourcePage<T>(path: string, filters: () => Record<string, unknown>) {
  const items = shallowRef<T[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const loading = ref(false);
  const error = ref("");
  let generation = 0;
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function reload() {
    clearTimeout(timer);
    const current = ++generation;
    loading.value = true;
    error.value = "";
    items.value = [];
    try {
      const result = await request.get<PageResult<T>>(path, {
        ...filters(), page: page.value, pageSize: pageSize.value,
      });
      if (current !== generation) return;
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize.value));
      if (page.value > lastPage) { page.value = lastPage; return; }
      items.value = result.items;
      total.value = result.total;
    } catch (reason) {
      if (current === generation) {
        total.value = 0;
        error.value = reason instanceof Error ? reason.message : "加载失败，请重试";
      }
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  watch(filters, () => {
    ++generation;
    items.value = [];
    page.value = 1;
    clearTimeout(timer);
    if (active) timer = setTimeout(() => void reload(), 250);
  }, { deep: true });
  watch([page, pageSize], () => { if (active) void reload(); });
  onMounted(() => void reload());
  onActivated(() => { if (!active) { active = true; void reload(); } });
  const suspend = () => { active = false; ++generation; clearTimeout(timer); };
  onDeactivated(suspend);
  onScopeDispose(suspend);
  return { items, total, page, pageSize, loading, error, reload };
}

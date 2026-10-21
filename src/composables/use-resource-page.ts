import { onActivated, onDeactivated, onMounted, onScopeDispose, ref, shallowRef, watch } from "vue";
import request from "@/utils/request";
import type { PageResult } from "@/api/catalog";

/**
 * The part of a filter row the server can see: `request` drops empty cells from a GET query, so two
 * snapshots that differ only in `undefined` versus `""` ask for the same page. A control that
 * normalises its empty value on mount is not an edit, and a page against the deployed database
 * costs 1.6s when it is treated as one.
 */
const querySignature = (values: Record<string, unknown>) =>
  JSON.stringify(
    Object.entries(values)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .sort(([a], [b]) => a.localeCompare(b)),
  );

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
  // Comparing the signature string, not the object: an object identity changes on every
  // re-evaluation, and a string comparison is exact, so no deep traversal is needed.
  watch(() => querySignature(filters()), () => {
    ++generation;
    items.value = [];
    page.value = 1;
    clearTimeout(timer);
    if (active) timer = setTimeout(() => void reload(), 250);
  });
  watch([page, pageSize], () => { if (active) void reload(); });
  onMounted(() => void reload());
  // `active` keeps a hidden tab from asking for pages nobody is looking at. Coming back to it is not
  // an edit: the list on screen is the list its filters asked for, so it costs no round trip. A page
  // that wants the server's newest rows on return calls `reload()` from its own `onActivated`.
  onActivated(() => {
    active = true;
  });
  const suspend = () => {
    active = false;
    clearTimeout(timer);
  };
  // A request already on its way is left to land: dropping it would strand the tab on an empty list
  // with nothing scheduled to fill it back in.
  onDeactivated(suspend);
  onScopeDispose(() => {
    suspend();
    ++generation;
  });
  return { items, total, page, pageSize, loading, error, reload };
}

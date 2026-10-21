import { onMounted, onScopeDispose, ref, shallowRef } from "vue";

/**
 * Data for one page: fetched when the component mounts, kept while `keep-alive` parks it.
 *
 * Coming back to a cached tab shows what that tab already had. A tab switch is not an edit, and one
 * round trip to the deployed database costs more than the numbers it brings back. A page that does
 * want fresh values on return says so itself -- `onActivated(() => reload())` -- and a page that
 * writes data already reloads after the write, so its own view is never the stale one.
 */
export function useRemoteData<T>(fetcher: () => Promise<T>) {
  const data = shallowRef<T>();
  const loading = ref(false),
    error = ref("");
  let generation = 0;
  async function reload() {
    const current = ++generation;
    loading.value = true;
    error.value = "";
    data.value = undefined;
    try {
      const result = await fetcher();
      if (current === generation) data.value = result;
    } catch (reason) {
      if (current === generation)
        error.value = reason instanceof Error ? reason.message : "加载失败";
    } finally {
      if (current === generation) loading.value = false;
    }
  }
  onMounted(() => void reload());
  // A response still on its way when the tab is hidden is allowed to land. Dropping it would leave
  // the tab with nothing to show and no request left to fill it in.
  onScopeDispose(() => generation++);
  return { data, loading, error, reload };
}

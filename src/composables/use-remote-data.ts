import { onActivated, onDeactivated, onMounted, onScopeDispose, ref, shallowRef } from "vue";

export function useRemoteData<T>(fetcher: () => Promise<T>) {
  const data = shallowRef<T>();
  const loading = ref(false),
    error = ref("");
  let generation = 0,
    active = true;
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
  onActivated(() => {
    if (!active) {
      active = true;
      void reload();
    }
  });
  const suspend = () => {
    active = false;
    generation++;
  };
  onDeactivated(suspend);
  onScopeDispose(suspend);
  return { data, loading, error, reload };
}

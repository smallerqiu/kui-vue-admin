import { createApp, defineComponent, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useResourcePage } from "@/composables/use-resource-page";
import request from "@/utils/request";

vi.mock("@/utils/request", () => ({ default: { get: vi.fn() } }));
const disposers: (() => void)[] = [];
const result = (id: string) => ({ items: [{ id }], total: 1, page: 1, pageSize: 20 });
function setup() {
  const keyword = ref("");
  let state!: ReturnType<typeof useResourcePage<{ id: string }>>;
  const app = createApp(defineComponent({ setup() {
    state = useResourcePage("/customers", () => ({ keyword: keyword.value }));
    return () => null;
  } }));
  app.mount(document.createElement("div"));
  disposers.push(() => app.unmount());
  return { state, keyword };
}
describe("server resource pages", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.useRealTimers(); });
  it("ignores earlier requests when filters change", async () => {
    let resolveFirst!: (value: ReturnType<typeof result>) => void;
    vi.mocked(request.get).mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve; }));
    const { state, keyword } = setup();
    vi.mocked(request.get).mockResolvedValueOnce(result("new"));
    keyword.value = "new";
    await nextTick();
    await vi.advanceTimersByTimeAsync(250);
    resolveFirst(result("old"));
    await nextTick();
    expect(state.items.value).toEqual([{ id: "new" }]);
    expect(request.get).toHaveBeenLastCalledWith("/customers", { keyword: "new", page: 1, pageSize: 20 });
  });
  it("does not refetch for a filter change the server cannot see", async () => {
    const status = ref<string | undefined>(undefined);
    let state!: ReturnType<typeof useResourcePage<{ id: string }>>;
    vi.mocked(request.get).mockResolvedValue(result("page"));
    const app = createApp(defineComponent({
      setup() {
        state = useResourcePage("/customers", () => ({ status: status.value }));
        return () => null;
      },
    }));
    app.mount(document.createElement("div"));
    disposers.push(() => app.unmount());
    await nextTick();
    expect(request.get).toHaveBeenCalledTimes(1);
    // A control normalising its own empty value on mount is not an edit: the query it
    // asks for is the one already on screen.
    status.value = "";
    await nextTick();
    await vi.advanceTimersByTimeAsync(400);
    expect(request.get).toHaveBeenCalledTimes(1);
    status.value = "follow";
    await nextTick();
    expect(request.get).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(250);
    expect(request.get).toHaveBeenCalledTimes(2);
    expect(vi.mocked(request.get).mock.calls.at(-1)?.[1])
      .toEqual({ status: "follow", page: 1, pageSize: 20 });
    expect(state.total.value).toBe(1);
  });
  it("shows a failed request and supports retry without demo fallback", async () => {
    vi.mocked(request.get).mockRejectedValueOnce(new Error("Offline"));
    const { state } = setup();
    await nextTick();
    expect(state.error.value).toBe("Offline");
    expect(state.items.value).toEqual([]);
    vi.mocked(request.get).mockResolvedValueOnce(result("real"));
    await state.reload();
    expect(state.error.value).toBe("");
    expect(state.items.value).toEqual([{ id: "real" }]);
  });
});

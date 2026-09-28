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

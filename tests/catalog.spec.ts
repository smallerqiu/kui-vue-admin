import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogApi, type Product } from "@/api/catalog";
import request from "@/utils/request";

vi.mock("@/utils/request", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
describe("catalog API contracts", () => {
  beforeEach(() => vi.clearAllMocks());
  it("preserves decimal text and omits read-only product fields", async () => {
    const product: Product = {
      id: "abc", name: "Widget", sku: "SKU", price: "10.10", stock: 2,
      enabled: true, category: "", specs: "Original specs", image: "/image.png",
      updatedAt: "today", ownerId: "private", color: "red",
    };
    await catalogApi.saveProduct(product, product.id);
    expect(request.put).toHaveBeenCalledWith("/products/abc", {
      name: "Widget", sku: "SKU", price: "10.10", stock: 2, enabled: true,
      category: "", specs: "Original specs", image: "/image.png",
    });
  });
  it("propagates saving failures", async () => {
    vi.mocked(request.post).mockRejectedValueOnce(new Error("Offline"));
    await expect(catalogApi.saveCustomer({
      name: "Customer", contact: "Alice", industry: "", level: "growth", status: "follow",
      phone: "", email: "", city: "",
    })).rejects.toThrow("Offline");
  });
  it("changes availability without resubmitting stale stock or price", async () => {
    await catalogApi.setProductEnabled("abc", false);
    expect(request.post).toHaveBeenCalledWith("/products/abc/availability", { enabled: false });
  });
  it("does not replace a missing customer with demo data", async () => {
    vi.mocked(request.get).mockRejectedValueOnce(new Error("Record not found"));
    await expect(catalogApi.customer("missing")).rejects.toThrow("Record not found");
  });
  it("asks the server which categories the reachable products carry", async () => {
    vi.mocked(request.get).mockResolvedValueOnce({ categories: ["IT 设备", "it 周边"] });
    expect(await catalogApi.productFacets()).toEqual({ categories: ["IT 设备", "it 周边"] });
    expect(request.get).toHaveBeenCalledWith("/products/facets");
  });
  it("propagates a refused candidate read instead of answering with nothing", async () => {
    // An empty dropdown would look like a catalogue with no categories filed, so the page has to hear
    // the refusal rather than a quietly invented answer.
    vi.mocked(request.get).mockRejectedValueOnce(new Error("候选接口暂不可用"));
    await expect(catalogApi.productFacets()).rejects.toThrow("候选接口暂不可用");
  });
});

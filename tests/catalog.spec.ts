import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogApi, type Customer, type Product } from "@/api/catalog";
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
  it("sends only the columns a person may write when replacing a customer", async () => {
    // What the detail endpoint answers with is a row, not a form: its own id, when it was created and
    // last touched, whose customer it is, how many orders it has and what they add up to -- and any
    // column an older draft still carries. PUT replaces the row, so a body drawn from that answer
    // would hand the server back figures it computes and name an owner nobody assigned.
    const customer: Customer = {
      id: "abc", name: "星河云科", industry: "企业服务", level: "growth", status: "active",
      contact: "Alice", phone: "", email: "", city: "武汉",
      createdAt: "2026-09-01T08:00:00", updatedAt: "2026-10-01T08:00:00",
      ownerName: "陈默", orderCount: 3, annualValue: "30.30", lastContactAt: null,
      ownerId: "u1", departmentId: "d1", source: "官网",
    };
    await catalogApi.saveCustomer(customer, customer.id);
    expect(request.put).toHaveBeenCalledWith("/customers/abc", {
      name: "星河云科", industry: "企业服务", level: "growth", status: "active",
      contact: "Alice", phone: "", email: "", city: "武汉",
    });
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
  it("asks the customer list for the picker rather than keeping a copy of it", async () => {
    // One page, searched the way `/customers` really searches (名称、联系人、城市), because a picker
    // built from a cached directory could not name a customer a colleague added a minute ago.
    vi.mocked(request.get).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    await catalogApi.searchCustomers("武汉");
    expect(request.get).toHaveBeenCalledWith("/customers", { keyword: "武汉", pageSize: 20 });
  });
  it("offers the goods picker only what is still on sale", async () => {
    // 上架/下架 is a column the products page writes and `POST /orders` answers 404 for a product
    // nobody is selling, so the filter has to go to the server instead of trimming a page locally.
    vi.mocked(request.get).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    await catalogApi.searchProducts("R-1");
    expect(request.get).toHaveBeenCalledWith("/products", {
      keyword: "R-1",
      enabled: true,
      pageSize: 20,
    });
  });
});


import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  commerceApi,
  isMoneyText,
  orderEstimate,
  orderInput,
  pickedProduct,
} from "@/api/commerce";
import request from "@/utils/request";

vi.mock("@/utils/request", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
describe("commerce API", () => {
  beforeEach(() => vi.clearAllMocks());
  it("uses the requested detail ID and never falls back to another order", async () => {
    vi.mocked(request.get).mockRejectedValueOnce(new Error("Order not found"));
    await expect(commerceApi.detail("missing")).rejects.toThrow("Order not found");
    expect(request.get).toHaveBeenCalledWith("/orders/missing");
  });
  it("preserves decimal amounts instead of computing payment in the client", async () => {
    await commerceApi.action("id", "adjust", { discount: "0.10" });
    expect(request.post).toHaveBeenCalledWith("/orders/id/adjust", { discount: "0.10" });
  });
  it("sends selected shipment quantities without mutating cached orders", async () => {
    const payload = { company: "SF", trackingNo: "001", quantities: { item1: 2 } };
    await commerceApi.action("id", "ship", payload);
    expect(request.post).toHaveBeenCalledWith("/orders/id/ship", payload);
    expect(payload.quantities).toEqual({ item1: 2 });
  });
  it("propagates rejected operations rather than reporting success", async () => {
    vi.mocked(request.post).mockRejectedValueOnce(new Error("Already shipped"));
    await expect(commerceApi.action("id", "close", undefined)).rejects.toThrow("Already shipped");
  });
  it("creates a real after-sale request with string amounts", async () => {
    const data = {
      orderId: "id",
      type: "refund" as const,
      itemIds: ["item1"],
      amount: "10.10",
      reason: "Duplicate",
    };
    vi.mocked(request.post).mockResolvedValueOnce({ id: "sale" });
    expect(await commerceApi.afterSale(data)).toEqual({ id: "sale" });
    expect(request.post).toHaveBeenCalledWith("/after-sales", data);
  });
  it("sends approval and preserves external reference for refund retries", async () => {
    await commerceApi.review("sale", false, "Rejected");
    expect(request.post).toHaveBeenLastCalledWith("/after-sales/sale/review", {
      approved: false,
      note: "Rejected",
    });
    await commerceApi.refund("sale", "BANK-001");
    await commerceApi.refund("sale", "BANK-001");
    expect(request.post).toHaveBeenLastCalledWith("/after-sales/sale/refund", {
      reference: "BANK-001",
    });
  });
  it("reads the free-text candidate values, carriers included, off the orders endpoint", async () => {
    // The ship dialog reads `carriers` out of this one answer, so the key has to survive the call
    // rather than being a field only the server knows about.
    vi.mocked(request.get).mockResolvedValueOnce({
      paymentMethods: ["bank-transfer"],
      sources: ["admin"],
      carriers: ["DHL", "顺丰速运"],
    });
    expect(await commerceApi.facets()).toEqual({
      paymentMethods: ["bank-transfer"],
      sources: ["admin"],
      carriers: ["DHL", "顺丰速运"],
    });
    expect(request.get).toHaveBeenCalledWith("/orders/facets");
  });
  it("writes the create body as the columns the order table owns", () => {
    // A price or a stock count read for the screen has no business in the body: `POST /orders`
    // re-reads every product under a row lock and prices the order from what it finds there, and the
    // API forbids unknown keys -- a validation failure answers "Invalid request", which tells an
    // operator nothing about the box they should have filled.
    const body = orderInput({
      customerId: " c1 ",
      contact: " 林晓 ",
      phone: " 13800000000 ",
      address: " 光谷大道 1 号 ",
      lines: [
        { product: { id: "p1", price: "1286.00", stock: 12 } as never, quantity: 2 },
        { product: { id: "p2", price: "2330.50", stock: 3 } as never, quantity: 1 },
      ],
      freight: "",
      discount: " 0.30 ",
      note: "",
    });
    expect(body).toEqual({
      customerId: "c1",
      contact: "林晓",
      phone: "13800000000",
      address: "光谷大道 1 号",
      items: [
        { productId: "p1", quantity: 2 },
        { productId: "p2", quantity: 1 },
      ],
      // An empty money box is the column's own default, not a blank the server has to guess at.
      freight: "0.00",
      discount: "0.30",
      note: "",
    });
  });

  it("keeps the drawer's total on the decimal text the money column holds", () => {
    // 1286.00 x 2 + 0.10 + 0.20 - 0.30: added as floats this comes out 2572.0000000000005, and the
    // preview would print a cent the order does not have.
    const line = (product: { id: string; price: string } | null, quantity = 1) => ({
      productId: product?.id ?? "",
      quantity,
      rows: product ? [product] : [],
      loading: false,
    });
    const lines = [
      line({ id: "p1", price: "1286.00" }, 2),
      line({ id: "p2", price: "0.10" }),
      line({ id: "p3", price: "0.20" }),
      // A row whose search has not landed yet adds nothing rather than making the total NaN.
      line(null),
    ];
    expect(pickedProduct(lines[3])).toBeNull();
    expect(orderEstimate(lines, "0.00", "0.30")).toEqual({ goods: "2572.30", paid: "2572.00" });
    // The discount is allowed to take the order to nothing, and the page refuses it before the
    // server has to answer 400 for a negative amount.
    expect(orderEstimate([line({ id: "p1", price: "10.00" })], "0.00", "20.00").paid).toBe("-10.00");
  });

  it("accepts only the money the create endpoint's own column can hold", () => {
    for (const value of ["0", "0.00", "1286.00", "999999999999.99"]) expect(isMoneyText(value)).toBe(true);
    // Negative, more precision than the column, grouping, and exponent notation are all refused here
    // rather than reaching `Money` and coming back as "Invalid request".
    for (const value of ["-1", "0.001", "12,00", "1e3", "1.".repeat(13), ""]) expect(isMoneyText(value)).toBe(false);
  });

  it("files an order where the list reads it back from", async () => {
    const created = { id: "o1", paidAmount: "2572.00", status: "pending", source: "admin" };
    vi.mocked(request.post).mockResolvedValueOnce(created as never);
    // The answer is the created row, so the page can show the server's totals instead of its own
    // preview: 状态 and 订单来源 come from the column defaults, and this drawer never sends them.
    expect(await commerceApi.create({ customerId: "c1" } as never)).toEqual(created);
    expect(request.post).toHaveBeenCalledWith("/orders", { customerId: "c1" });
  });
});


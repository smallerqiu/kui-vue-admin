import { beforeEach, describe, expect, it, vi } from "vitest";
import { commerceApi } from "@/api/commerce";
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
});

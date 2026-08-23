import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useOrderStore } from "@/stores/orders";

describe("order store", () => {
  beforeEach(() => {
    localStorage.removeItem("pro_orders");
    localStorage.removeItem("pro_after_sales");
    setActivePinia(createPinia());
  });

  it("closes pending orders and recalculates adjusted prices", () => {
    const store = useOrderStore();
    const pending = store.getOrder("K202608230017")!;
    expect(store.adjustPrice(pending.id, 399)).toBe(true);
    expect(pending.paidAmount).toBe(2000);
    expect(
      store.updateAddress(pending.id, {
        contact: "新联系人",
        phone: "13800000000",
        address: "新的收货地址",
      }),
    ).toBe(true);
    expect(pending.contact).toBe("新联系人");
    expect(store.setMerchantRemark(pending.id, "优先处理")).toBe(true);
    expect(pending.merchantRemark).toBe("优先处理");
    expect(store.closeOrder(pending.id)).toBe(true);
    expect(pending.status).toBe("closed");
  });

  it("supports partial and complete shipments", () => {
    const store = useOrderStore();
    const order = store.getOrder("K202608230018")!;
    expect(store.shipOrder(order.id, "顺丰速运", "SF001", { I101: 1 })).toBe(
      true,
    );
    expect(order.status).toBe("partial_shipped");
    expect(store.shipOrder(order.id, "顺丰速运", "SF002", { I102: 2 })).toBe(
      true,
    );
    expect(order.status).toBe("shipped");
    expect(order.shipments).toHaveLength(2);
  });

  it("creates and reviews an after-sale request", () => {
    const store = useOrderStore();
    store.createAfterSale({
      orderId: "K202608230018",
      type: "refund",
      itemIds: ["I101"],
      amount: 12800,
      reason: "重复购买",
    });
    const record = store.afterSales[0];
    expect(record.status).toBe("pending");
    expect(store.reviewAfterSale(record.id, true, "同意退款")).toBe(true);
    expect(record.status).toBe("approved");
    expect(store.completeRefund(record.id)).toBe(true);
    expect(record.status).toBe("refunded");
  });
});

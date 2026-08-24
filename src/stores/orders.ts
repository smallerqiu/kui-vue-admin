import {
  initialAfterSales,
  orders as initialOrders,
  type AfterSaleRecord,
  type OrderRecord,
} from "@/data/orders";
import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";

interface AfterSaleInput {
  orderId: string;
  type: "refund" | "return_refund";
  itemIds: string[];
  amount: number;
  reason: string;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const readStored = <T>(key: string, fallback: T): T => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? clone(fallback);
  } catch {
    return clone(fallback);
  }
};

export const useOrderStore = defineStore("orders", () => {
  const orders = ref<OrderRecord[]>(readStored("pro_orders", initialOrders));
  const afterSales = ref<AfterSaleRecord[]>(readStored("pro_after_sales", initialAfterSales));
  const pendingAfterSaleCount = computed(
    () => afterSales.value.filter((item) => item.status === "pending").length,
  );
  const getOrder = (id: string) => orders.value.find((item) => item.id === id);

  const closeOrder = (id: string) => {
    const order = getOrder(id);
    if (!order || order.status !== "pending") return false;
    order.status = "closed";
    return true;
  };
  const updateAddress = (id: string, data: Pick<OrderRecord, "contact" | "phone" | "address">) => {
    const order = getOrder(id);
    if (!order) return false;
    Object.assign(order, data);
    return true;
  };
  const adjustPrice = (id: string, discount: number) => {
    const order = getOrder(id);
    if (!order || order.status !== "pending") return false;
    order.discount = Math.max(0, Math.min(discount, order.goodsAmount + order.freight));
    order.paidAmount = order.goodsAmount + order.freight - order.discount;
    return true;
  };
  const setMerchantRemark = (id: string, remark: string) => {
    const order = getOrder(id);
    if (!order) return false;
    order.merchantRemark = remark;
    return true;
  };
  const shipOrder = (
    id: string,
    company: string,
    trackingNo: string,
    quantities: Record<string, number>,
  ) => {
    const order = getOrder(id);
    if (!order || !["paid", "partial_shipped"].includes(order.status)) return false;
    const shipmentItems: Array<{ itemId: string; quantity: number }> = [];
    order.items.forEach((item) => {
      const remaining = item.quantity - (item.shippedQuantity || 0);
      const quantity = Math.max(0, Math.min(Number(quantities[item.id]) || 0, remaining));
      if (quantity) {
        item.shippedQuantity = (item.shippedQuantity || 0) + quantity;
        shipmentItems.push({ itemId: item.id, quantity });
      }
    });
    if (!shipmentItems.length) return false;
    const shipment = {
      id: `SHIP${Date.now()}`,
      company,
      trackingNo,
      createdAt: "刚刚",
      items: shipmentItems,
    };
    order.shipments = [...(order.shipments || []), shipment];
    order.shippingCompany = company;
    order.trackingNo = trackingNo;
    const finished = order.items.every((item) => (item.shippedQuantity || 0) >= item.quantity);
    order.status = finished ? "shipped" : "partial_shipped";
    return true;
  };
  const createAfterSale = (data: AfterSaleInput) => {
    const order = getOrder(data.orderId);
    if (!order) return;
    afterSales.value.unshift({
      ...data,
      id: `AS${Date.now()}`,
      customer: order.customer,
      status: "pending",
      createdAt: "刚刚",
    });
    order.status = "refund";
  };
  const reviewAfterSale = (id: string, approved: boolean, note: string) => {
    const record = afterSales.value.find((item) => item.id === id);
    if (!record || record.status !== "pending") return false;
    record.status = approved ? "approved" : "rejected";
    record.reviewer = "Administrator";
    record.reviewNote = note;
    const order = getOrder(record.orderId);
    if (order && !approved) order.status = order.shipments?.length ? "shipped" : "paid";
    return true;
  };
  const completeRefund = (id: string) => {
    const record = afterSales.value.find((item) => item.id === id);
    if (!record || record.status !== "approved") return false;
    record.status = "refunded";
    return true;
  };

  watch(orders, (value) => localStorage.setItem("pro_orders", JSON.stringify(value)), {
    deep: true,
  });
  watch(afterSales, (value) => localStorage.setItem("pro_after_sales", JSON.stringify(value)), {
    deep: true,
  });
  return {
    orders,
    afterSales,
    pendingAfterSaleCount,
    getOrder,
    closeOrder,
    updateAddress,
    adjustPrice,
    setMerchantRemark,
    shipOrder,
    createAfterSale,
    reviewAfterSale,
    completeRefund,
  };
});

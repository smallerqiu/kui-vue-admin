import { beforeEach, describe, expect, it, vi } from "vitest";
import { commerceApi, ordersToCsv } from "@/api/commerce";
import request from "@/utils/request";
import type { OrderRecord } from "@/api/commerce";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(request.get);
const order = (over: Partial<OrderRecord> = {}): OrderRecord => ({
  id: "a".repeat(32),
  customer: "星河云科",
  customerId: "c1",
  contact: "林晓",
  phone: "13800000000",
  address: "杭州市西湖区文一西路 100 号",
  goodsAmount: "2572.00",
  freight: "12.00",
  discount: "0.00",
  paidAmount: "2584.00",
  refundedAmount: "0.00",
  status: "paid",
  createdAt: "2026-10-19T16:05:41",
  paymentMethod: "bank-transfer",
  paymentAt: "2026-10-19T16:40:02",
  receivedAt: null,
  source: "admin",
  note: "尽快发货",
  merchantRemark: "",
  items: [
    {
      id: "i1",
      name: "旗舰路由",
      sku: "R-1",
      specs: "黑色",
      image: "",
      price: "1286.00",
      quantity: 2,
      shippedQuantity: 0,
    },
  ],
  shipments: [],
  ...over,
});
const answer = (items: OrderRecord[], total: number) =>
  ({ items, total, page: 1, pageSize: 100 }) as never;

describe("order export", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("walks every page the on-screen filter matched, carrying the filter along", async () => {
    get
      .mockResolvedValueOnce(answer([order(), order()], 5))
      .mockResolvedValueOnce(answer([order(), order()], 5))
      .mockResolvedValueOnce(answer([order()], 5));
    const { rows, truncated } = await commerceApi.allMatching({
      keyword: "星河",
      status: "paid",
      paymentMethod: "bank-transfer",
      source: "admin",
      startDate: "2026-10-01",
      endDate: "2026-10-19",
    });

    expect(rows).toHaveLength(5);
    expect(truncated).toBe(false);
    expect(get).toHaveBeenCalledTimes(3);
    // A walk that dropped the filter would hand over every order in the database under a file name
    // that says otherwise.
    expect(get).toHaveBeenLastCalledWith("/orders", {
      keyword: "星河",
      status: "paid",
      paymentMethod: "bank-transfer",
      source: "admin",
      startDate: "2026-10-01",
      endDate: "2026-10-19",
      page: 3,
      pageSize: 100,
    });
  });

  it("asks at most 100 rows per page, because that is all the API answers", async () => {
    const many = (count: number) =>
      answer(
        Array.from({ length: count }, (_, index) => order({ id: `o${index}` })),
        250,
      );
    get.mockResolvedValueOnce(many(100)).mockResolvedValueOnce(many(100)).mockResolvedValueOnce(many(50));
    const { rows, truncated } = await commerceApi.allMatching({});

    expect(rows).toHaveLength(250);
    expect(truncated).toBe(false);
    expect(get).toHaveBeenCalledTimes(3);
    // 100 is the server's ceiling (`schemas.PageQuery.page_size`, le=100): asking for 500 would come
    // back as 100 while the walk counted 500 rows it never received.
    for (const [, params] of get.mock.calls) expect(params.pageSize).toBeLessThanOrEqual(100);
    expect(get).toHaveBeenLastCalledWith("/orders", { page: 3, pageSize: 100 });
  });

  it("stops at the cap and says the file is short", async () => {
    const full = Array.from({ length: 100 }, (_, index) => order({ id: `o${index}` }));
    get.mockResolvedValue(answer(full, 5000));
    const { rows, truncated } = await commerceApi.allMatching({}, 150);

    expect(rows).toHaveLength(150);
    expect(truncated).toBe(true);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("does not walk past a total no page ever fills", async () => {
    get.mockResolvedValue(answer([], 50));
    const { rows, truncated } = await commerceApi.allMatching({});

    // A scope that moved between the two reads can report rows the server then refuses to hand over;
    // the export stops and calls itself short instead of looping.
    expect(rows).toEqual([]);
    expect(truncated).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("writes the page's columns with flat money and the words the tags show", () => {
    const csv = ordersToCsv([
      order(),
      order({
        id: "b".repeat(32),
        status: "partial_shipped",
        paymentAt: null,
        paymentMethod: "",
        note: '收货前打电话, 备注"周末不派送"',
        items: [
          {
            id: "i1",
            name: "旗舰路由",
            sku: "R-1",
            specs: "黑色",
            image: "",
            price: "1286.00",
            quantity: 2,
            shippedQuantity: 1,
          },
          {
            id: "i2",
            name: "交换机",
            sku: "S-9",
            specs: "24 口",
            image: "",
            price: "899.00",
            quantity: 1,
            shippedQuantity: 0,
          },
        ],
      }),
      // A row that has been signed for, because a column that is only ever seen empty proves nothing:
      // this is the one line in the file where the cell holds a stamp.
      order({
        id: "c".repeat(32),
        status: "completed",
        receivedAt: "2026-10-21T09:30:00",
      }),
    ]);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe(
      "订单号,下单时间 (UTC),买家,联系人,联系电话,收货地址,商品明细,件数,商品金额,运费,优惠,实付金额,已退金额,状态,支付方式,支付时间 (UTC),签收时间 (UTC),订单来源,客户备注,商家备注",
    );
    // The full id and the flat two-decimal amounts: a `2,584.00` cell is re-imported as `2`, and the
    // shortened id the cell displays is a display choice, not a key anyone can look the order up by.
    // The receipt cell is empty here -- this order was never signed for, and an empty file cell is
    // what the column actually holds, not a placeholder date.
    expect(lines[1]).toBe(
      `${"a".repeat(32)},2026-10-19T16:05:41,星河云科,林晓,13800000000,杭州市西湖区文一西路 100 号,旗舰路由 黑色 / R-1 ×2,2,2572.00,12.00,0.00,2584.00,0.00,待发货,bank-transfer,2026-10-19T16:40:02,,admin,尽快发货,`,
    );
    // A status code the 状态 tag spells out in Chinese is spelled out here too, two items join with a
    // count that adds both quantities, and a note holding a comma and quotes is quoted and doubled.
    expect(lines[2]).toBe(
      `${"b".repeat(32)},2026-10-19T16:05:41,星河云科,林晓,13800000000,杭州市西湖区文一西路 100 号,旗舰路由 黑色 / R-1 ×2; 交换机 24 口 / S-9 ×1,3,2572.00,12.00,0.00,2584.00,0.00,部分发货,,,,admin,"收货前打电话, 备注""周末不派送""",`,
    );
    expect(lines[3]).toBe(
      `${"c".repeat(32)},2026-10-19T16:05:41,星河云科,林晓,13800000000,杭州市西湖区文一西路 100 号,旗舰路由 黑色 / R-1 ×2,2,2572.00,12.00,0.00,2584.00,0.00,已完成,bank-transfer,2026-10-19T16:40:02,2026-10-21T09:30:00,admin,尽快发货,`,
    );
  });
});

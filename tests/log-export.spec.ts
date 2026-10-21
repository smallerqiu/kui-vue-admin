import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogApi, auditLogsToCsv } from "@/api/system";
import request from "@/utils/request";
import type { AuditLogRecord } from "@/api/system";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(request.get);
const row = (over: Partial<AuditLogRecord> = {}): AuditLogRecord => ({
  id: "l1",
  action: "order:close",
  actorId: "u1",
  actorName: "林晓",
  resourceId: "o1",
  requestId: "req-1",
  ip: "10.10.2.35",
  createdAt: "2026-10-19T16:05:41",
  module: "order",
  moduleName: "订单管理",
  operation: "关闭订单",
  level: "warning",
  levelName: "警告",
  ...over,
});
const answer = (items: AuditLogRecord[], total: number) =>
  ({
    items,
    total,
    page: 1,
    pageSize: 100,
    facets: { modules: [], levels: [] },
  }) as never;

describe("audit log export", () => {
  beforeEach(() => {
    get.mockReset();
  });

  it("walks every page the same filter matched, carrying the filter along", async () => {
    get
      .mockResolvedValueOnce(answer([row(), row()], 5))
      .mockResolvedValueOnce(answer([row(), row()], 5))
      .mockResolvedValueOnce(answer([row()], 5));
    const { rows, truncated } = await auditLogApi.allMatching({ keyword: "退款", level: "danger" });

    expect(rows).toHaveLength(5);
    expect(truncated).toBe(false);
    expect(get).toHaveBeenCalledTimes(3);
    // A walk that dropped the filter would export the whole log and read like a filtered file.
    expect(get).toHaveBeenLastCalledWith("/audit-logs", {
      keyword: "退款",
      level: "danger",
      page: 3,
      pageSize: 100,
    });
  });

  it("stops at the cap, asks only for what is left, and says the file is short", async () => {
    const full = Array.from({ length: 100 }, (_, index) => row({ id: `l${index}` }));
    get.mockResolvedValue(answer(full, 5000));
    const { rows, truncated } = await auditLogApi.allMatching({}, 250);

    expect(rows).toHaveLength(250);
    expect(truncated).toBe(true);
    expect(get).toHaveBeenCalledTimes(3);
    expect(get).toHaveBeenLastCalledWith("/audit-logs", { page: 3, pageSize: 50 });
  });

  it("does not walk past a total no page ever fills", async () => {
    get.mockResolvedValue(answer([], 50));
    const { rows, truncated } = await auditLogApi.allMatching({});

    // A filter can report rows the server then refuses to hand over (a scope that moved between
    // the two reads).  The export stops and calls itself short instead of looping.
    expect(rows).toEqual([]);
    expect(truncated).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("writes the columns the page shows, with the ids a server log is grepped by", () => {
    const csv = auditLogsToCsv([
      row(),
      row({
        id: "l2",
        actorName: null,
        ip: null,
        operation: '关闭订单, 备注"客户已取消"',
        action: "customer:delete",
      }),
    ]);

    expect(csv.split("\r\n")[0]).toBe(
      "时间 (UTC),操作用户,模块,操作内容,级别,IP 地址,动作码,资源编号,请求编号",
    );
    expect(csv.split("\r\n")[1]).toBe(
      "2026-10-19T16:05:41,林晓,订单管理,关闭订单,警告,10.10.2.35,order:close,o1,req-1",
    );
    // A cell holding a comma or a quote is quoted and doubled, or the row would land in Excel as
    // two rows' worth of columns; a name or address the row does not have is an empty cell.
    expect(csv.split("\r\n")[2]).toBe(
      '2026-10-19T16:05:41,,订单管理,"关闭订单, 备注""客户已取消""",警告,,customer:delete,o1,req-1',
    );
  });
});

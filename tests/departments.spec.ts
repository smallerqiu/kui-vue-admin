import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDepartment,
  loadDepartments,
  removeDepartment,
  renameDepartment,
} from "@/api/departments";
import request from "@/utils/request";

vi.mock("@/utils/request", () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const get = vi.mocked(request.get);
const post = vi.mocked(request.post);
const put = vi.mocked(request.put);
const del = vi.mocked(request.delete);

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  put.mockReset();
  del.mockReset();
});

describe("department directory", () => {
  it("reads the whole list without pagination parameters", async () => {
    get.mockResolvedValue([{ id: "d1", name: "平台组" }] as never);
    await expect(loadDepartments()).resolves.toEqual([{ id: "d1", name: "平台组" }]);
    expect(get).toHaveBeenCalledWith("/departments");
  });

  it("creates with just the name the operator typed", async () => {
    post.mockResolvedValue({ id: "d2" } as never);
    await expect(createDepartment("增长组")).resolves.toEqual({ id: "d2" });
    expect(post).toHaveBeenCalledWith("/departments", { name: "增长组" });
  });

  it("renames through the record id and keeps the server row", async () => {
    put.mockResolvedValue({ id: "d1", name: "平台与增长组" } as never);
    await expect(renameDepartment("d1", "平台与增长组")).resolves.toEqual({
      id: "d1",
      name: "平台与增长组",
    });
    expect(put).toHaveBeenCalledWith("/departments/d1", { name: "平台与增长组" });
  });

  it("encodes the id on the way to the delete route", async () => {
    del.mockResolvedValue({ ok: true } as never);
    await expect(removeDepartment("d 1/2")).resolves.toEqual({ ok: true });
    expect(del).toHaveBeenCalledWith(`/departments/${encodeURIComponent("d 1/2")}`);
  });

  it("lets a refusal reach the caller with the server wording", async () => {
    // The 409 body names the table and the count, and the page prints it verbatim.
    del.mockRejectedValue(new Error("3 users record(s) still belong to this department"));
    await expect(removeDepartment("d1")).rejects.toThrow(
      "3 users record(s) still belong to this department",
    );
  });
});

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { downloadCsv, toCsv } from "@/utils/csv";

describe("toCsv", () => {
  it("quotes only what needs quoting and doubles the quotes it holds", () => {
    const csv = toCsv([["名称", "数量"], ["旗舰路由", 2], ["交换机, 24 口", '含"型号"备注']]);
    expect(csv).toBe('名称,数量\r\n旗舰路由,2\r\n"交换机, 24 口","含""型号""备注"');
  });

  it("leaves a value the server never filled as an empty cell", () => {
    // `null` written into a cell reads as the word null in a spreadsheet, and `0` is a number nobody
    // typed -- an absent value has to be nothing at all.
    expect(toCsv([["备注"], [null], [undefined], [""]])).toBe("备注\r\n\r\n\r\n");
  });

  it("keeps money flat, because a grouped cell re-imports as its first digit", () => {
    expect(toCsv([["实付金额"], ["2584.00"]])).toBe("实付金额\r\n2584.00");
  });
});

describe("downloadCsv", () => {
  it("hands the file over with a BOM and releases the object URL", () => {
    const createObjectURL = vi.fn(() => "blob:demo");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    // jsdom would navigate for a real anchor click; only the handoff is under test.
    downloadCsv("订单号,金额\r\na,1", "orders-2026-10-22.csv");

    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe("text/csv;charset=utf-8");
    // Excel reads a bare-UTF-8 csv in its own legacy codepage, so the Chinese header arrives as
    // mojibake unless the file announces UTF-8 in its first three bytes.
    expect(blob.size).toBe(new Blob(["\ufeff订单号,金额\r\na,1"]).size);
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe("orders-2026-10-22.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:demo");

    click.mockRestore();
    vi.unstubAllGlobals();
  });
});

// The rule is read off the source: three list pages hand out CSV files now, and every one of them
// that keeps its own quoter or its own download dance is a file whose columns shift for a reason no
// other page has.
describe("modules use the one csv helper", () => {
  const srcRoot = path.resolve(fileURLToPath(import.meta.url), "../../src");
  const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|vue)$/.test(entry.name) && !full.endsWith(`utils${path.sep}csv.ts`) ? [full] : [];
    });

  it("finds the files it is meant to be checking", () => {
    // Guards the scan itself: a moved src directory would make every rule below pass by reading
    // nothing.
    const files = sourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(40);
    expect(files.some((file) => file.endsWith("system.ts"))).toBe(true);
  });

  it("never re-implements the quoter or the download", () => {
    for (const file of sourceFiles(srcRoot)) {
      const source = fs.readFileSync(file, "utf8");
      expect(source, `${file} keeps its own csv quoter`).not.toMatch(/\bcsvCell\b/);
      expect(source, `${file} joins csv rows itself`).not.toMatch(/join\("\\r\\n"\)/);
      // A page that prefixes the BOM in its own template literal is a file that can lose it without
      // any other file noticing.
      expect(source, `${file} writes its own csv download`).not.toMatch(/\\ufeff/);
    }
  });
});

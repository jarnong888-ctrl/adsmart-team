import ExcelJS from "exceljs";

export type ScriptExportRow = {
  date: string;
  pillar: string;
  title: string;
  language: string;
  hook: string;
  cta: string;
  commentKeyword: string;
  softSell: string;
  flags: string;
  sources: string;
  script: string;
  status: string;
};

export const EXPORT_COLUMNS: { key: keyof ScriptExportRow; header: string }[] = [
  { key: "date", header: "Date" },
  { key: "pillar", header: "Pillar" },
  { key: "title", header: "Title" },
  { key: "language", header: "Language" },
  { key: "hook", header: "Hook" },
  { key: "cta", header: "CTA" },
  { key: "commentKeyword", header: "Comment keyword" },
  { key: "softSell", header: "Soft sell" },
  { key: "flags", header: "Flags" },
  { key: "sources", header: "Sources" },
  { key: "script", header: "Script" },
  { key: "status", header: "Status" },
];

function escapeCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function toCsv(rows: ScriptExportRow[]): string {
  const header = EXPORT_COLUMNS.map((column) => column.header).join(",");
  const body = rows
    .map((row) => EXPORT_COLUMNS.map((column) => escapeCell(row[column.key] ?? "")).join(","))
    .join("\n");
  return `\uFEFF${header}\n${body}${rows.length ? "\n" : ""}`;
}

export async function toXlsx(rows: ScriptExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Adsmart Team";
  const sheet = workbook.addWorksheet("Scripts");
  sheet.columns = EXPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.key === "script" ? 72 : 22,
  }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

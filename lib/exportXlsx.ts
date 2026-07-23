/**
 * Utilitaire d'export Excel (.xlsx) côté client, basé sur exceljs.
 * Produit un classeur stylé : en-tête figé, filtres automatiques, largeurs de
 * colonnes, lignes alternées, et formats natifs (nombre / monétaire / date).
 *
 * Trois entrées : `exportToXlsx` (lignes d'objets + colonnes typées, un seul
 * onglet), `exportRowsToXlsx` (matrice dont la 1ʳᵉ ligne est l'en-tête, un
 * seul onglet), et `exportMultiSheetXlsx` (plusieurs onglets hétérogènes dans
 * un seul classeur — pour exporter d'un coup des sections de formes différentes,
 * ex. un dashboard avec KPIs + listes + séries temporelles).
 */
import ExcelJS from "exceljs";

export type XlsxColumnType = "text" | "number" | "currency" | "date" | "datetime";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface XlsxColumn<T extends Record<string, any>> {
  label: string;
  key: keyof T;
  /** Transformation de la valeur brute avant écriture (sinon valeur telle quelle). */
  format?: (v: T[keyof T], row: T) => string | number | Date | null;
  /** Type de cellule pour l'alignement et le format Excel natif. Défaut: "text". */
  type?: XlsxColumnType;
  /** Largeur de colonne (en caractères). Auto-calculée si absente. */
  width?: number;
}

export interface XlsxOptions {
  /** Nom de l'onglet. Défaut: "Export". */
  sheetName?: string;
  /** Titre affiché en grande ligne au-dessus du tableau (optionnel). */
  title?: string;
  /** Code devise pour les colonnes "currency" (format Excel). Défaut: "XOF". */
  currency?: string;
}

const HEADER_FILL = "FF059669";  // emerald-600
const HEADER_FONT = "FFFFFFFF";
const STRIPE_FILL  = "FFF1F5F9"; // slate-100
const BORDER_COLOR = "FFE2E8F0"; // slate-200

// ── Écriture d'un onglet "lignes d'objets + colonnes typées" ──────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function writeObjectSheet<T extends Record<string, any>>(
  ws: ExcelJS.Worksheet,
  rows: T[],
  columns: XlsxColumn<T>[],
  options: Pick<XlsxOptions, "title" | "currency"> = {}
) {
  const { title, currency = "XOF" } = options;
  const currencyFmt = `#,##0 "${currency}"`;
  const numberFmt   = "#,##0";
  const dateFmt     = "dd/mm/yyyy";
  const dateTimeFmt = "dd/mm/yyyy hh:mm";

  let headerRowIndex = 1;

  // ── Titre optionnel ────────────────────────────────────────────────────────
  if (title) {
    ws.mergeCells(1, 1, 1, columns.length);
    const titleCell = ws.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
    titleCell.alignment = { vertical: "middle" };
    ws.getRow(1).height = 22;
    headerRowIndex = 2;
  }

  // ── En-tête ──────────────────────────────────────────────────────────────
  const headerRow = ws.getRow(headerRowIndex);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      bottom: { style: "thin", color: { argb: BORDER_COLOR } },
    };
  });
  headerRow.height = 20;

  // ── Lignes de données ──────────────────────────────────────────────────────
  rows.forEach((row, r) => {
    const excelRow = ws.getRow(headerRowIndex + 1 + r);
    columns.forEach((col, i) => {
      const raw = row[col.key];
      const value = col.format ? col.format(raw, row) : raw ?? null;
      const cell = excelRow.getCell(i + 1);
      cell.value = value as ExcelJS.CellValue;

      switch (col.type) {
        case "currency":
          cell.numFmt = currencyFmt;
          cell.alignment = { horizontal: "right" };
          break;
        case "number":
          cell.numFmt = numberFmt;
          cell.alignment = { horizontal: "right" };
          break;
        case "date":
          cell.numFmt = dateFmt;
          cell.alignment = { horizontal: "left" };
          break;
        case "datetime":
          cell.numFmt = dateTimeFmt;
          cell.alignment = { horizontal: "left" };
          break;
        default:
          cell.alignment = { horizontal: "left", wrapText: false };
      }

      // Lignes alternées
      if (r % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE_FILL } };
      }
    });
  });

  // ── Filtres automatiques sur l'en-tête ─────────────────────────────────────
  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to:   { row: headerRowIndex, column: columns.length },
  };

  // ── Largeurs de colonnes (auto si non fournies) ────────────────────────────
  columns.forEach((col, i) => {
    const column = ws.getColumn(i + 1);
    if (col.width != null) {
      column.width = col.width;
      return;
    }
    let max = col.label.length;
    rows.forEach((row) => {
      const raw = row[col.key];
      const value = col.format ? col.format(raw, row) : raw ?? "";
      const len = String(value ?? "").length;
      if (len > max) max = len;
    });
    column.width = Math.min(Math.max(max + 2, 10), 45);
  });

  ws.views = [{ state: "frozen", ySplit: title ? 2 : 1 }];
}

// ── Écriture d'un onglet "matrice" (1ʳᵉ ligne = en-tête) ───────────────────────
function writeMatrixSheet(
  ws: ExcelJS.Worksheet,
  rows: (string | number | Date | null)[][],
  options: Pick<XlsxOptions, "currency"> & { columnTypes?: (XlsxColumnType | undefined)[] } = {}
) {
  const { currency = "XOF", columnTypes = [] } = options;
  const currencyFmt = `#,##0 "${currency}"`;
  const [headerCells, ...dataRows] = rows;
  const colCount = headerCells.length;

  const headerRow = ws.getRow(1);
  headerCells.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = { bottom: { style: "thin", color: { argb: BORDER_COLOR } } };
  });
  headerRow.height = 20;

  dataRows.forEach((cells, r) => {
    const excelRow = ws.getRow(2 + r);
    cells.forEach((value, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = value;
      const type = columnTypes[i];
      switch (type) {
        case "currency":
          cell.numFmt = currencyFmt;
          cell.alignment = { horizontal: "right" };
          break;
        case "number":
          cell.numFmt = "#,##0";
          cell.alignment = { horizontal: "right" };
          break;
        case "date":
          cell.numFmt = "dd/mm/yyyy";
          cell.alignment = { horizontal: "left" };
          break;
        case "datetime":
          cell.numFmt = "dd/mm/yyyy hh:mm";
          cell.alignment = { horizontal: "left" };
          break;
        default:
          cell.alignment = { horizontal: typeof value === "number" ? "right" : "left" };
          if (typeof value === "number") cell.numFmt = "#,##0";
      }
      if (r % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE_FILL } };
      }
    });
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colCount } };
  for (let i = 0; i < colCount; i++) {
    const type = columnTypes[i];
    let max = String(headerCells[i] ?? "").length;
    dataRows.forEach((cells) => {
      const v = cells[i];
      const len =
        type === "datetime" ? 16
        : type === "date" ? 10
        : v instanceof Date ? 12
        : String(v ?? "").length;
      if (len > max) max = len;
    });
    ws.getColumn(i + 1).width = Math.min(Math.max(max + 2, 10), 45);
  }

  ws.views = [{ state: "frozen", ySplit: 1 }];
}

// ── API publique : un seul onglet, lignes d'objets ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportToXlsx<T extends Record<string, any>>(
  rows: T[],
  columns: XlsxColumn<T>[],
  filename = "export.xlsx",
  options: XlsxOptions = {}
) {
  if (rows.length === 0) return;

  const { sheetName = "Export" } = options;
  const wb = new ExcelJS.Workbook();
  wb.creator = "AfriGes";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);
  writeObjectSheet(ws, rows, columns, options);

  await downloadWorkbook(wb, filename);
}

/**
 * Variante "matrice" : `rows[0]` est la ligne d'en-tête, le reste les données.
 * Utile pour migrer les exports qui construisent déjà un tableau de tableaux.
 * Applique le même style (en-tête figé, filtres, lignes alternées, largeurs).
 */
export async function exportRowsToXlsx(
  rows: (string | number | Date | null)[][],
  filename = "export.xlsx",
  options: Pick<XlsxOptions, "sheetName" | "currency"> & {
    /** Type par colonne (aligné sur l'ordre des colonnes), pour le format natif. */
    columnTypes?: (XlsxColumnType | undefined)[];
  } = {}
) {
  if (rows.length === 0) return;

  const { sheetName = "Export" } = options;
  const wb = new ExcelJS.Workbook();
  wb.creator = "AfriGes";
  wb.created = new Date();
  const ws = wb.addWorksheet(sheetName);
  writeMatrixSheet(ws, rows, options);

  await downloadWorkbook(wb, filename);
}

/** Description d'un onglet pour exportMultiSheetXlsx. */
export type XlsxSheetSpec =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { sheetName: string; kind: "object"; rows: Record<string, any>[]; columns: XlsxColumn<Record<string, any>>[]; title?: string }
  | { sheetName: string; kind: "matrix"; rows: (string | number | Date | null)[][]; columnTypes?: (XlsxColumnType | undefined)[] };

/**
 * Exporte plusieurs sections hétérogènes (KPIs, listes, séries temporelles…)
 * dans UN SEUL classeur à onglets multiples — un seul fichier téléchargé.
 * Les onglets vides (0 ligne de données) sont ignorés.
 */
export async function exportMultiSheetXlsx(
  sheets: XlsxSheetSpec[],
  filename = "export.xlsx",
  options: Pick<XlsxOptions, "currency"> = {}
) {
  const utiles = sheets.filter((s) => s.rows.length > 0);
  if (utiles.length === 0) return;

  const wb = new ExcelJS.Workbook();
  wb.creator = "AfriGes";
  wb.created = new Date();

  for (const sheet of utiles) {
    const ws = wb.addWorksheet(sheet.sheetName.slice(0, 31));
    if (sheet.kind === "object") {
      writeObjectSheet(ws, sheet.rows, sheet.columns, { title: sheet.title, currency: options.currency });
    } else {
      writeMatrixSheet(ws, sheet.rows, { currency: options.currency, columnTypes: sheet.columnTypes });
    }
  }

  await downloadWorkbook(wb, filename);
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

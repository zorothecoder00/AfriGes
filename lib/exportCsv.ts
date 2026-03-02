/**
 * Utilitaire d'export CSV côté client.
 * Prend un tableau d'objets et un mapping colonne → clé, génère un fichier CSV
 * et le télécharge dans le navigateur.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportToCsv<T extends Record<string, any>>(
  rows: T[],
  columns: { label: string; key: keyof T; format?: (v: T[keyof T], row: T) => string }[],
  filename = "export.csv"
) {
  if (rows.length === 0) return;

  const BOM = "\uFEFF"; // BOM UTF-8 pour que Excel l'ouvre correctement
  const sep = ";";

  const header = columns.map((c) => `"${c.label}"`).join(sep);
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = row[c.key];
          const val = c.format ? c.format(raw, row) : raw == null ? "" : String(raw);
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(sep)
    )
    .join("\n");

  const csv = BOM + header + "\n" + body;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

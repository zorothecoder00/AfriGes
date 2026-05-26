/**
 * Export Excel (format HTML/XLS compatible Excel 2003+).
 * Aucune dépendance externe — fonctionne dans tous les navigateurs modernes.
 */

export type XlsSection = {
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
};

const TH = (h: string) =>
  `<th style="background:#f3f4f6;font-weight:bold;border:1px solid #9ca3af;padding:5px 10px;text-align:left;white-space:nowrap">${h}</th>`;

const TD = (v: string | number | null | undefined) =>
  `<td style="border:1px solid #e5e7eb;padding:4px 10px">${String(v ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;

function sectionToHtml(s: XlsSection): string {
  const title = s.title
    ? `<h2 style="font-family:Arial,sans-serif;font-size:13px;margin:20px 0 6px;color:#1f2937;border-bottom:2px solid #3b82f6;padding-bottom:4px">${s.title}</h2>`
    : '';
  const headerRow = s.headers.map(TH).join('');
  const bodyRows  = s.rows.map(
    (row) => `<tr>${row.map(TD).join('')}</tr>`
  ).join('');
  return `${title}<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;margin-bottom:16px"><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

export function exportToXls(
  sections: XlsSection | XlsSection[],
  filename = 'export.xls',
) {
  const list = Array.isArray(sections) ? sections : [sections];
  const body = list.map(sectionToHtml).join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif">${body}</body>
</html>`;

  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

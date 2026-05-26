/**
 * Export PDF via la boîte de dialogue d'impression du navigateur.
 * Aucune dépendance externe.
 */

export type PdfSection = {
  heading?: string;
  content: string; // HTML (table, div, p…)
};

export function printToPdf(title: string, sections: PdfSection[]) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Autorisez les pop-ups pour exporter en PDF.');
    return;
  }

  const body = sections
    .map(
      (s) =>
        (s.heading
          ? `<h2>${s.heading}</h2>`
          : '') + s.content,
    )
    .join('');

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body  { font-family: Arial, sans-serif; font-size: 11px; margin: 24px; color: #111827; }
    h1    { font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 4px; }
    h2    { font-size: 13px; font-weight: bold; margin: 18px 0 6px; padding-bottom: 4px;
            border-bottom: 1px solid #e5e7eb; color: #374151; }
    .meta { color: #9ca3af; font-size: 10px; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
    th    { background: #f3f4f6; font-weight: bold; border: 1px solid #d1d5db;
            padding: 5px 8px; text-align: left; font-size: 10px; white-space: nowrap; }
    td    { border: 1px solid #e5e7eb; padding: 4px 8px; font-size: 10px; }
    tr:nth-child(even) td { background: #f9fafb; }
    .kpis { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
    .kpi  { padding: 8px 14px; background: #f9fafb; border: 1px solid #e5e7eb;
            border-radius: 6px; min-width: 120px; }
    .kpi-label { font-size: 9px; color: #6b7280; margin-bottom: 2px; }
    .kpi-value { font-size: 15px; font-weight: bold; color: #111827; }
    @media print {
      body { margin: 12px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p class="meta">Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
  ${body}
  <script>window.addEventListener('load', () => { setTimeout(() => { window.print(); }, 400); });</script>
</body>
</html>`);
  win.document.close();
}

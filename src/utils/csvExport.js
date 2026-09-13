function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function tableToCsvRows(title, rows) {
  if (!rows.length) return [[title], ['No data']];
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    [title],
    headers,
    ...rows.map((row) => headers.map((header) => row[header] ?? '')),
  ];
}

export function downloadCsvTables(tables, filename) {
  const csv = tables
    .flatMap(({ title, rows }) => tableToCsvRows(title, rows))
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n\n');

  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

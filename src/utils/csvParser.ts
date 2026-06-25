/**
 * RFC-4180-compliant CSV parser.
 * Returns an array of rows; each row is an array of field strings.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        // Escaped double-quote inside quoted field
        field += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        row.push(field);
        field = '';
        i++;
      } else if (ch === '\r' && text[i + 1] === '\n') {
        row.push(field);
        field = '';
        if (row.some(f => f.trim() !== '')) rows.push(row);
        row = [];
        i += 2;
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        if (row.some(f => f.trim() !== '')) rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Flush last field/row
  if (field || row.length > 0) {
    row.push(field);
    if (row.some(f => f.trim() !== '')) rows.push(row);
  }

  return rows;
}

/**
 * Given parsed rows, auto-detect header row and return
 * { headers: string[], data: string[][] }
 */
export function withHeaders(rows: string[][]): { headers: string[]; data: string[][] } {
  if (rows.length === 0) return { headers: [], data: [] };
  const first = rows[0].map(h => h.toLowerCase().trim());
  const looksLikeHeader = first.some(h =>
    ['title', 'prompt', 'response', 'category', 'severity', 'outcome'].includes(h)
  );
  if (looksLikeHeader) {
    return { headers: first, data: rows.slice(1) };
  }
  // No header detected — return positional defaults
  return {
    headers: ['title', 'category', 'category_name', 'severity', 'outcome', 'prompt', 'response', 'notes', 'tags'],
    data: rows,
  };
}

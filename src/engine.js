import Papa from 'papaparse';

export function parseCsv(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', dynamicTyping: false });
  if (result.errors.some(e => e.type === 'Quotes')) throw new Error('CSV contains an invalid quoted field.');
  const fields = result.meta.fields || [];
  return { fields, rows: result.data };
}
export function normalizeAccount(value) {
  return value == null ? '' : String(value).trim();
}
export function compareAccounts(masterRows, buyerRows, masterKey, buyerKey) {
  const buyerIds = new Set(buyerRows.map(r => normalizeAccount(r[buyerKey])).filter(Boolean));
  const matches = [], available = [], blankMaster = [];
  for (const row of masterRows) {
    const id = normalizeAccount(row[masterKey]);
    if (!id) blankMaster.push(row);
    else if (buyerIds.has(id)) matches.push(row);
    else available.push(row);
  }
  return { matches, available, blankMaster, buyerUniqueCount: buyerIds.size };
}
export function toCsv(rows, fields) {
  return Papa.unparse({ fields, data: rows.map(r => fields.map(f => r[f] ?? '')) }, { quotes: true, newline: '\r\n' });
}

import Papa from 'papaparse';

export function parseCsv(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', dynamicTyping: false });
  const fatal = result.errors.filter(e => e.type === 'Quotes');
  if (fatal.length) throw new Error('CSV format could not be read safely.');
  const fields = (result.meta.fields || []).map(f => String(f).replace(/^\uFEFF/, '').trim());
  if (!fields.length) throw new Error('No column headers found.');
  if (new Set(fields).size !== fields.length) throw new Error('CSV contains duplicate column names.');
  const rows = result.data.map(row => {
    const clean = {};
    Object.entries(row).forEach(([key, value]) => { clean[String(key).replace(/^\uFEFF/, '').trim()] = value; });
    return clean;
  });
  return { fields, rows, warnings: result.errors };
}
export function normalizeAccount(value) {
  return value == null ? '' : String(value).trim();
}
export function accountStats(rows, key) {
  const counts = new Map(); let blank = 0;
  for (const row of rows) {
    const id = normalizeAccount(row[key]);
    if (!id) { blank++; continue; }
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  let duplicateRows = 0, duplicateIds = 0;
  for (const count of counts.values()) if (count > 1) { duplicateIds++; duplicateRows += count - 1; }
  return { unique: counts.size, blank, duplicateIds, duplicateRows };
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
  return { matches, available, blankMaster, buyerUniqueCount: buyerIds.size,
    masterStats: accountStats(masterRows, masterKey), buyerStats: accountStats(buyerRows, buyerKey) };
}
export function toCsv(rows, fields) {
  return Papa.unparse({ fields, data: rows.map(r => fields.map(f => r[f] ?? '')) },
    { quotes: true, newline: '\r\n' });
}

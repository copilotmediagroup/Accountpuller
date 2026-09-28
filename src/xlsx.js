const formatDate = value => {
  const y=value.getUTCFullYear(), m=value.getUTCMonth()+1, d=value.getUTCDate();
  return `${m}/${d}/${y}`;
};
const text = value => {
  if (value == null) return '';
  if (value instanceof Date) return formatDate(value);
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '');
    if ('result' in value) return String(value.result ?? '');
    if (Array.isArray(value.richText)) return value.richText.map(x => x.text || '').join('');
  }
  return String(value);
};

export async function parseXlsx(file) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Workbook has no worksheets.');
  const headers = [];
  sheet.getRow(1).eachCell({includeEmpty:true}, (cell, col) => { headers[col - 1] = text(cell.value).replace(/^\uFEFF/, '').trim(); });
  if (!headers.filter(Boolean).length) throw new Error('No column headers found.');
  const rows = [];
  sheet.eachRow({includeEmpty:false}, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const item = {};
    headers.forEach((h, i) => { if (h) item[h] = text(row.getCell(i + 1).value); });
    rows.push(item);
  });
  return {fields:headers.filter(Boolean), rows};
}

export async function rowsToXlsx(rows, fields, accountField) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Accounts');
  sheet.columns = fields.map(f => ({header:f,key:f,width:Math.min(40, Math.max(14, f.length + 2))}));
  for (const source of rows) {
    const row = sheet.addRow(fields.map(f => source[f] ?? ''));
    const accountIndex = fields.indexOf(accountField);
    if (accountIndex >= 0) {
      const cell = row.getCell(accountIndex + 1);
      cell.value = String(source[accountField] ?? '');
      cell.numFmt = '@';
    }
  }
  sheet.getRow(1).font = {bold:true};
  return new Blob([await workbook.xlsx.writeBuffer()], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

/* =====================================================
   exporter.js — CSV / XLSX / JSON export
   Depends on: SheetJS (XLSX), PapaParse
   ===================================================== */

// ─── Canonical column order for export ────────────────────────
const EXPORT_COLS = [
  'case_id','source_file_name','source_template_name','source_row_no',
  'txid','dedupe_key','duplicate_status','duplicate_group_id',
  'confidence_score','review_flag','review_reason',
  'tx_datetime','tx_date','tx_time','tx_type','tx_direction',
  'from_bank_code','from_bank_name','from_account_no','from_account_name',
  'to_bank_code','to_bank_name','to_account_no','to_account_name',
  'amount','balance','raw_deposit','raw_withdrawal',
  'channel','transaction_ref','ref1','ref2','ref3',
  'atm_cdm_machine_no','atm_cdm_bank','atm_cdm_location','atm_cdm_sequence_no',
  'card_bank','card_no',
  'branch_code','teller_id',
  'cheque_no','cheque_bank','cheque_branch',
  'phone','email','ip_address','latitude','longitude',
  'raw_description','raw_note','raw_json',
];

// ─── Filter helper ─────────────────────────────────────────────
function filterForExport(transactions, opts = {}) {
  let rows = [...transactions];
  if (opts.excludeDuplicates)  rows = rows.filter(t => t.duplicate_status !== 'DUPLICATE');
  if (opts.excludeMerged)      rows = rows.filter(t => t.duplicate_status !== 'MERGED');
  if (opts.onlyReview)         rows = rows.filter(t => t.review_flag);
  if (opts.caseId)             rows = rows.filter(t => t.case_id === opts.caseId);
  if (opts.dateFrom)           rows = rows.filter(t => t.tx_date >= opts.dateFrom);
  if (opts.dateTo)             rows = rows.filter(t => t.tx_date <= opts.dateTo);
  return rows;
}

// ─── Flatten row for tabular export ───────────────────────────
function flattenRow(tx) {
  const row = {};
  for (const col of EXPORT_COLS) {
    let v = tx[col];
    if (v === undefined || v === null) v = '';
    if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
    row[col] = v;
  }
  return row;
}

// ─── Trigger browser download ──────────────────────────────────
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Export CSV ───────────────────────────────────────────────
function exportCSV(transactions, opts = {}, filename = 'transactions.csv') {
  const rows    = filterForExport(transactions, opts).map(flattenRow);
  const csvStr  = Papa.unparse(rows, { columns: EXPORT_COLS });
  const blob    = new Blob(['\ufeff' + csvStr], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

// ─── Export XLSX ──────────────────────────────────────────────
function exportXLSX(transactions, opts = {}, filename = 'transactions.xlsx') {
  const rows = filterForExport(transactions, opts).map(flattenRow);
  const ws   = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLS });

  // Style header row bold (basic)
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'CCE5FF' } } };
  }

  // Column widths
  ws['!cols'] = EXPORT_COLS.map(col => {
    const widths = { txid:32, dedupe_key:40, raw_json:20, raw_description:30,
                     from_account_name:25, to_account_name:25, source_file_name:30 };
    return { wch: widths[col] || 18 };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, filename);
}

// ─── Export JSON ──────────────────────────────────────────────
function exportJSON(transactions, opts = {}, filename = 'transactions.json') {
  const rows = filterForExport(transactions, opts);
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

// ─── Export mapping template ──────────────────────────────────
function exportTemplate(template, filename) {
  const name = filename || (template.name.replace(/\s+/g,'-').toLowerCase() + '.json');
  const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
  downloadBlob(blob, name);
}

// ─── Export audit log ─────────────────────────────────────────
async function exportAuditLog(filename = 'audit_log.json') {
  const log  = await window.Storage.getAuditLog();
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

// ─── Summary stats ─────────────────────────────────────────────
function buildSummary(transactions) {
  const unique = transactions.filter(t =>
    ['UNIQUE','MASTER'].includes(t.duplicate_status));
  const totalIn  = unique.filter(t => t.tx_direction === 'IN')
                         .reduce((s, t) => s + (Number(t.amount)||0), 0);
  const totalOut = unique.filter(t => t.tx_direction === 'OUT')
                         .reduce((s, t) => s + (Number(t.amount)||0), 0);
  const byType   = {};
  const byFile   = {};
  for (const t of unique) {
    byType[t.tx_type] = (byType[t.tx_type] || 0) + 1;
    byFile[t.source_file_name] = (byFile[t.source_file_name] || 0) + 1;
  }
  return {
    totalRows: transactions.length,
    uniqueRows: unique.length,
    duplicateRows: transactions.filter(t => t.duplicate_status === 'DUPLICATE').length,
    possibleDupes: transactions.filter(t => t.duplicate_status === 'POSSIBLE_DUPLICATE').length,
    totalIn, totalOut, netFlow: totalIn - totalOut,
    byType, byFile,
  };
}

window.Exporter = {
  exportCSV, exportXLSX, exportJSON,
  exportTemplate, exportAuditLog,
  buildSummary, filterForExport, EXPORT_COLS,
};

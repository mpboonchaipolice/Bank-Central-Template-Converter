/* =====================================================
   exporter.js — CSV / XLSX / JSON export
   v2: includes account keys + bank abbreviations
   ===================================================== */

// ─── Canonical column order for export ────────────────────────
const EXPORT_COLS = [
  // Provenance
  'case_id','source_file_name','source_template_name','source_row_no',
  // Identity & dedup
  'txid','dedupe_key','duplicate_status','duplicate_group_id',
  'confidence_score','review_flag','review_reason',
  // Core
  'tx_datetime','tx_date','tx_time','tx_type','tx_direction',
  // From party (with account key)
  'from_bank_code','from_bank_abbr','from_bank_name',
  'from_account_no','from_account_name','from_account_key',
  // To party (with account key)
  'to_bank_code','to_bank_abbr','to_bank_name',
  'to_account_no','to_account_name','to_account_key',
  // Account pair
  'account_pair_key',
  // Amount
  'amount','balance','raw_deposit','raw_withdrawal',
  // Channel / Refs
  'channel','transaction_ref','ref1','ref2','ref3',
  // ATM/CDM
  'atm_cdm_machine_no','atm_cdm_bank','atm_cdm_location','atm_cdm_sequence_no',
  // Card
  'card_bank','card_no',
  // Branch / Staff
  'branch_code','teller_id',
  // Cheque
  'cheque_no','cheque_bank','cheque_branch',
  // Contact
  'phone','email','ip_address','latitude','longitude',
  // Raw
  'raw_description','raw_note','raw_json',
];

// ─── Column width hints ───────────────────────────────────────
const COL_WIDTHS = {
  txid:32, dedupe_key:44, raw_json:20,
  raw_description:30, raw_note:30,
  from_account_name:28, to_account_name:28,
  from_account_key:24, to_account_key:24,
  account_pair_key:48,
  source_file_name:36,
};

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
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ─── Export CSV ───────────────────────────────────────────────
function exportCSV(transactions, opts = {}, filename = 'transactions.csv') {
  const rows   = filterForExport(transactions, opts).map(flattenRow);
  const csvStr = Papa.unparse(rows, { columns: EXPORT_COLS });
  const blob   = new Blob(['\ufeff' + csvStr], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

// ─── Export XLSX ──────────────────────────────────────────────
function exportXLSX(transactions, opts = {}, filename = 'transactions.xlsx') {
  const rows = filterForExport(transactions, opts).map(flattenRow);
  const ws   = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLS });
  ws['!cols'] = EXPORT_COLS.map(col => ({ wch: COL_WIDTHS[col] || 18 }));
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
  const unique   = transactions.filter(t => ['UNIQUE','MASTER'].includes(t.duplicate_status));
  const totalIn  = unique.filter(t => t.tx_direction === 'IN').reduce((s,t) => s+(Number(t.amount)||0), 0);
  const totalOut = unique.filter(t => t.tx_direction === 'OUT').reduce((s,t) => s+(Number(t.amount)||0), 0);
  const byType   = {}, byFile = {};
  for (const t of unique) {
    byType[t.tx_type]            = (byType[t.tx_type]            || 0) + 1;
    byFile[t.source_file_name]   = (byFile[t.source_file_name]   || 0) + 1;
  }
  return {
    totalRows:      transactions.length,
    uniqueRows:     unique.length,
    duplicateRows:  transactions.filter(t => t.duplicate_status === 'DUPLICATE').length,
    possibleDupes:  transactions.filter(t => t.duplicate_status === 'POSSIBLE_DUPLICATE').length,
    totalIn, totalOut, netFlow: totalIn - totalOut,
    byType, byFile,
  };
}

window.Exporter = {
  exportCSV, exportXLSX, exportJSON,
  exportTemplate, exportAuditLog,
  buildSummary, filterForExport, EXPORT_COLS,
};

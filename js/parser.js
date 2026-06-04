/* =====================================================
   parser.js — CSV / XLSX / TSV file parser
   v2: robust owner-account extraction + ownerMeta override
   ===================================================== */

// ─── XLSX parser using SheetJS ────────────────────────────────
async function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb    = XLSX.read(e.target.result, { type:'array', cellText:true, cellDates:false });
        const wsName = wb.SheetNames[0];
        const ws     = wb.Sheets[wsName];
        const raw    = XLSX.utils.sheet_to_json(ws, { header:1, raw:false, defval:'', blankrows:true });
        resolve({ raw, totalRows: raw.length, fileName: file.name, fileType:'xlsx' });
      } catch (err) { reject(new Error('XLSX parse error: ' + err.message)); }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── CSV / TSV parser using PapaParse ─────────────────────────
async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false, skipEmptyLines: false, encoding: 'UTF-8',
      complete: r => resolve({
        raw: r.data, totalRows: r.data.length, fileName: file.name,
        fileType: file.name.toLowerCase().endsWith('.tsv') ? 'tsv' : 'csv',
      }),
      error: err => reject(new Error('CSV parse error: ' + err.message)),
    });
  });
}

// ─── Detect file type and dispatch ────────────────────────────
async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const result = ['xlsx','xls'].includes(ext) ? await parseXLSX(file) : await parseCSV(file);
  return enrichParsed(result);
}

// ─── Extract owner metadata from a text block ─────────────────
function extractOwnerFromText(text) {
  const N = window.Normalizer;
  const result = {};

  // Account number pattern (with or without dashes)
  const accMatch = text.match(/(?:บัญชี(?:เลขที่|หมายเลข|ที่)?)[:\s]*([\d][\d\-]{5,20}[\d])/);
  if (accMatch) {
    result.ownerAccountOriginal   = accMatch[1].trim();
    result.ownerAccountNormalized = N.normalizeAccountNo(accMatch[1]);
  }

  // Account name
  const nameMatch = text.match(/ชื่อบัญชี[:\s]+([^\n\r]+?)(?:\s{2,}|สาขา|$)/);
  if (nameMatch) result.ownerAccountName = nameMatch[1].trim();

  // Branch
  const branchMatch = text.match(/สาขา[:\s]+([^\n\r\s]+)/);
  if (branchMatch) result.ownerBranchName = branchMatch[1].trim();

  return result;
}

// ─── Extract owner metadata from filename ─────────────────────
// KBank filename pattern: "224-3-92441-6  ชื่อบัญชี  น.ส. นิตยา บึงรัตน์ -"
function extractOwnerFromFilename(filename) {
  const N = window.Normalizer;
  const result = {};
  const base = filename.replace(/\.[^.]+$/, ''); // remove extension

  // Pattern: starts with account number (dashes OK) then name
  const m = base.match(/^([\d][\d\-]{4,18}[\d])\s+(?:ชื่อบัญชี\s+)?(.+?)(?:\s+-\s*)?$/);
  if (m) {
    result.ownerAccountOriginal   = m[1].trim();
    result.ownerAccountNormalized = N.normalizeAccountNo(m[1]);
    if (m[2]) result.ownerAccountName = m[2].trim().replace(/\s+-\s*$/, '');
  }

  // Prasan pattern: "template04_GSB_0026(12)2_459-2 -"
  const bankMatch = base.match(/_([A-Z]{2,6})_/);
  if (bankMatch) {
    result.ownerBankAbbr = N.normalizeBankCode(bankMatch[1]);
  }

  return result;
}

// ─── Enrich: detect header row, extract owner metadata ────────
function enrichParsed(parsed) {
  const { raw, fileName } = parsed;
  const N = window.Normalizer;

  // Find first non-empty row with 5+ populated cells → header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(raw.length, 12); i++) {
    const row    = raw[i] || [];
    const filled = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
    if (filled >= 5) { headerRowIdx = i; break; }
  }

  const headers  = (raw[headerRowIdx] || []).map(h => String(h || '').trim());
  const dataRows = raw.slice(headerRowIdx + 1).filter(r =>
    r.some(c => c !== null && c !== undefined && String(c).trim() !== '')
  );
  const metaRows = raw.slice(0, headerRowIdx).map(r => r.map(c => String(c || '').trim()));

  // ── Extract owner metadata ────────────────────────────────
  // 1. From filename
  const fromFilename = extractOwnerFromFilename(fileName);

  // 2. From metadata rows (rows before header)
  const metaText = metaRows.map(r => r.join(' ')).join('\n');
  const fromMeta = extractOwnerFromText(metaText);

  // 3. Merge: meta rows take priority over filename
  const ownerAccountOriginal   = fromMeta.ownerAccountOriginal   || fromFilename.ownerAccountOriginal   || '';
  const ownerAccountNormalized = fromMeta.ownerAccountNormalized || fromFilename.ownerAccountNormalized || '';
  const ownerAccountName       = fromMeta.ownerAccountName       || fromFilename.ownerAccountName       || '';
  const ownerBranchName        = fromMeta.ownerBranchName        || '';
  const ownerBankAbbr          = fromFilename.ownerBankAbbr      || '';

  return {
    ...parsed,
    headers,
    dataRows,
    headerRowIdx,
    metaRows,
    // Legacy fields (used by template detection / old code)
    ownerAccount: ownerAccountNormalized,
    ownerName:    ownerAccountName,
    // Full owner metadata object
    ownerMeta: {
      ownerBankCode:         '',              // filled from template or user input
      ownerBankAbbr,
      ownerAccountOriginal,
      ownerAccountNormalized,
      ownerAccountName,
      ownerBranchName,
      ownerAccountKey:       '',              // computed after bank is known
      confirmed:             false,
    },
    totalDataRows: dataRows.length,
  };
}

// ─── Finalize ownerMeta: compute key from bank + account ──────
function finalizeOwnerMeta(ownerMeta, templateBankCode) {
  const N = window.Normalizer;
  const meta = { ...ownerMeta };

  // Fill bank from template if not already set
  if (!meta.ownerBankCode && templateBankCode) meta.ownerBankCode = templateBankCode;
  if (meta.ownerBankCode && !meta.ownerBankAbbr) {
    meta.ownerBankAbbr = N.normalizeBankCode(meta.ownerBankCode);
  }
  if (meta.ownerBankAbbr && !meta.ownerBankCode) {
    meta.ownerBankCode = N.getBankCode(meta.ownerBankAbbr);
  }

  // Build account key
  if (meta.ownerAccountNormalized) {
    meta.ownerAccountKey = N.buildAccountKey(
      meta.ownerBankAbbr || meta.ownerBankCode || '',
      meta.ownerAccountNormalized
    );
  }
  return meta;
}

// ─── Apply mapping: convert raw rows using template + ownerMeta override ──
function applyMapping(parsed, template, ownerMetaOverride = null) {
  const N = window.Normalizer;
  const { headers, dataRows, fileName } = parsed;
  const mapping = template.column_mapping || {};

  // Resolve owner metadata
  const rawMeta  = ownerMetaOverride || parsed.ownerMeta || {};
  const ownerMeta = finalizeOwnerMeta(rawMeta, template.owner_bank_code || '');

  const ownerAccount = ownerMeta.ownerAccountNormalized || parsed.ownerAccount || '';
  const ownerName    = ownerMeta.ownerAccountName       || parsed.ownerName    || '';
  const ownerBank    = ownerMeta.ownerBankAbbr          || N.normalizeBankCode(template.owner_bank_code || '') || '';

  // Build column index
  const colIndex = {};
  headers.forEach((h, i) => { colIndex[h] = i; });

  const rows = [];
  dataRows.forEach((row, rowIdx) => {
    const obj = { _source_row: rowIdx + (parsed.headerRowIdx || 0) + 2 };

    for (const [srcHeader, canonField] of Object.entries(mapping)) {
      if (canonField === '_ignore') continue;
      const idx = colIndex[srcHeader];
      const val = idx !== undefined ? (row[idx] ?? '') : '';

      if      (canonField === '_owner_account') obj._owner_account = String(val).trim() || ownerAccount;
      else if (canonField === '_owner_name')    obj._owner_name    = String(val).trim() || ownerName;
      else if (canonField === '_owner_bank')    obj._owner_bank    = String(val).trim() || ownerBank;
      else                                      obj[canonField]    = String(val ?? '').trim();
    }

    // Attach file + owner metadata
    obj._file_name            = fileName;
    obj._template_name        = template.name;
    obj._owner_account        = obj._owner_account        || ownerAccount;
    obj._owner_name           = obj._owner_name           || ownerName;
    obj._owner_bank           = obj._owner_bank           || ownerBank;
    obj._owner_account_name   = ownerName;
    obj._owner_branch         = ownerMeta.ownerBranchName || '';
    obj._owner_account_key    = ownerMeta.ownerAccountKey || '';
    obj._raw_row              = row;
    rows.push(obj);
  });

  return rows;
}

// ─── Get sample rows (first N) for preview ────────────────────
function getSampleRows(parsed, n = 10) {
  return parsed.dataRows.slice(0, n).map((row, i) => {
    const obj = { _rowNum: i + 1 };
    parsed.headers.forEach((h, ci) => { obj[h] = String(row[ci] ?? '').trim(); });
    return obj;
  });
}

window.Parser = { parseFile, enrichParsed, applyMapping, getSampleRows, finalizeOwnerMeta };

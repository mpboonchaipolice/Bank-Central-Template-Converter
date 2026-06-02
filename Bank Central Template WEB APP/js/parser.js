/* =====================================================
   parser.js — CSV / XLSX / TSV file parser
   Depends on: SheetJS (XLSX), PapaParse, normalizer.js
   ===================================================== */

// ─── XLSX parser using SheetJS ────────────────────────────────
async function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb    = XLSX.read(e.target.result, { type: 'array', cellText: true, cellDates: false });
        const wsName = wb.SheetNames[0];
        const ws     = wb.Sheets[wsName];
        // Get sheet dimensions
        const ref    = ws['!ref'] || 'A1';
        const range  = XLSX.utils.decode_range(ref);
        const totalRows = range.e.r + 1;
        // Read all rows as raw strings
        const raw = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: false,
          defval: '',
          blankrows: true,
        });
        resolve({ raw, totalRows, fileName: file.name, fileType: 'xlsx' });
      } catch (err) {
        reject(new Error(`XLSX parse error: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── CSV / TSV parser using PapaParse ─────────────────────────
async function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: false,
      encoding: 'UTF-8',
      complete: result => {
        resolve({
          raw: result.data,
          totalRows: result.data.length,
          fileName: file.name,
          fileType: file.name.toLowerCase().endsWith('.tsv') ? 'tsv' : 'csv',
        });
      },
      error: err => reject(new Error(`CSV parse error: ${err.message}`)),
    });
  });
}

// ─── Detect file type and dispatch ────────────────────────────
async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  let result;
  if (['xlsx', 'xls'].includes(ext)) {
    result = await parseXLSX(file);
  } else {
    result = await parseCSV(file);
  }
  return enrichParsed(result);
}

// ─── Enrich: detect header row, extract metadata ──────────────
function enrichParsed(parsed) {
  const { raw, fileName } = parsed;

  // Find first non-empty row with 5+ populated cells → candidate header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row    = raw[i] || [];
    const filled = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
    if (filled >= 5) { headerRowIdx = i; break; }
  }

  const headers  = (raw[headerRowIdx] || []).map(h => String(h || '').trim());
  const dataRows = raw.slice(headerRowIdx + 1).filter(r =>
    r.some(c => c !== null && c !== undefined && String(c).trim() !== '')
  );

  // Extract title/metadata rows (before header row)
  const metaRows = raw.slice(0, headerRowIdx).map(r => r.map(c => String(c || '').trim()));

  // Try to find owner account from meta rows (KBank pattern)
  let ownerAccount = null, ownerName = null;
  for (const row of metaRows) {
    const line = row.join(' ');
    const acm  = line.match(/บัญชี\s+([\d\-]+)/);
    if (acm) ownerAccount = window.Normalizer.normalizeAccountNo(acm[1]);
    const nmm  = line.match(/ชื่อบัญชี\s+(.+?)(?:\s+สาขา|$)/);
    if (nmm) ownerName = nmm[1].trim();
  }

  return {
    ...parsed,
    headers,
    dataRows,
    headerRowIdx,
    metaRows,
    ownerAccount,
    ownerName,
    totalDataRows: dataRows.length,
  };
}

// ─── Build row objects from parsed file + template mapping ────
function applyMapping(parsed, template) {
  const { headers, dataRows, fileName, ownerAccount, ownerName } = parsed;
  const mapping = template.column_mapping || {};

  // Build index: header name → column index
  const colIndex = {};
  headers.forEach((h, i) => { colIndex[h] = i; });

  const rows = [];
  dataRows.forEach((row, rowIdx) => {
    const obj = { _source_row: rowIdx + (parsed.headerRowIdx || 0) + 2 };

    // Apply mapping
    for (const [srcHeader, canonField] of Object.entries(mapping)) {
      if (canonField === '_ignore') continue;
      const idx = colIndex[srcHeader];
      const val = idx !== undefined ? (row[idx] ?? '') : '';

      if (canonField === '_owner_account') {
        obj._owner_account = String(val).trim() || ownerAccount;
      } else if (canonField === '_owner_name') {
        obj._owner_name = String(val).trim() || ownerName;
      } else if (canonField === '_owner_bank') {
        obj._owner_bank = String(val).trim();
      } else {
        obj[canonField] = String(val ?? '').trim();
      }
    }

    // Attach file metadata
    obj._file_name     = fileName;
    obj._template_name = template.name;
    obj._owner_account = obj._owner_account || ownerAccount || '';
    obj._owner_name    = obj._owner_name    || ownerName    || '';
    obj._raw_row       = row;
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

window.Parser = { parseFile, enrichParsed, applyMapping, getSampleRows };

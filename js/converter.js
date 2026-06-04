/* =====================================================
   converter.js — raw mapped rows → canonical transactions
   Now includes from/to account keys + bank abbreviations
   ===================================================== */

const _cn = window.Normalizer;

let _txCounter = 0;
function newTxID() {
  _txCounter++;
  return 'TX-' + Date.now() + '-' + String(_txCounter).padStart(5,'0');
}

function inferDirection(txType, dep, wdl, mapped) {
  if (mapped.tx_direction) {
    const d = String(mapped.tx_direction).toUpperCase().trim();
    if (d === 'IN' || d === 'OUT') return d;
    if (d === 'CREDIT') return 'IN';
    if (d === 'DEBIT')  return 'OUT';
  }
  if (wdl > 0) return 'OUT';
  if (dep > 0) return 'IN';
  const t = txType;
  if (['CASH_WITHDRAWAL','PAYMENT','FEE'].includes(t)) return 'OUT';
  if (['CASH_DEPOSIT','INTEREST'].includes(t))         return 'IN';
  return '';
}

// ─── Resolve from/to parties with full bank + account key ────
function resolveFromTo(mapped, direction, ownerAccount, ownerBankCode) {
  // Raw values from file
  const rawFromCode = String(mapped.from_bank_code  || '').trim();
  const rawToCode   = String(mapped.to_bank_code    || '').trim();
  const rawFromName = String(mapped.from_bank_name  || '').trim();
  const rawToName   = String(mapped.to_bank_name    || '').trim();

  // Normalize account numbers
  let fromAccNo   = _cn.normalizeAccountNo(mapped.from_account_no   || '');
  let fromAccName = _cn.normalizeText     (mapped.from_account_name || '');
  let toAccNo     = _cn.normalizeAccountNo(mapped.to_account_no     || '');
  let toAccName   = _cn.normalizeText     (mapped.to_account_name   || '');

  const ownerAcc  = _cn.normalizeAccountNo(ownerAccount  || '');
  const ownerBank = _cn.normalizeBankCode (ownerBankCode || '');   // → abbr

  // Fill in owner account when source/dest is blank
  if (ownerAcc) {
    if (direction === 'OUT' && !fromAccNo) {
      fromAccNo = ownerAcc;
    }
    if (direction === 'IN' && !toAccNo) {
      toAccNo = ownerAcc;
    }
  }

  // Compute bank abbreviations
  // Priority: explicit code > explicit name > owner bank (for owner-side)
  let fromBankAbbr = _cn.normalizeBankCode(rawFromCode || rawFromName || '');
  let toBankAbbr   = _cn.normalizeBankCode(rawToCode   || rawToName   || '');

  // Fill owner-bank abbreviation when it's the implicit side
  if (ownerBank) {
    if (direction === 'OUT' && (!fromBankAbbr || fromBankAbbr === rawFromCode)) {
      // Only fill if fromAccNo is the owner account
      if (fromAccNo === ownerAcc) fromBankAbbr = ownerBank;
    }
    if (direction === 'IN' && (!toBankAbbr || toBankAbbr === rawToCode)) {
      if (toAccNo === ownerAcc) toBankAbbr = ownerBank;
    }
  }

  // Full bank names
  const fromBankName = rawFromName || _cn.getBankName(fromBankAbbr);
  const toBankName   = rawToName   || _cn.getBankName(toBankAbbr);

  // Account identity keys: "KBANK 2243924416"
  const fromAccKey = _cn.buildAccountKey(fromBankAbbr, fromAccNo);
  const toAccKey   = _cn.buildAccountKey(toBankAbbr,   toAccNo);

  // Pair key: "KBANK 2243924416 → GSB 020088515638"
  const pairKey = (fromAccKey && toAccKey)
    ? `${fromAccKey} → ${toAccKey}`
    : (fromAccKey || toAccKey || '');

  return {
    fromBankCode: rawFromCode,  fromBankAbbr, fromBankName,
    fromAccNo,    fromAccName,  fromAccKey,
    toBankCode:   rawToCode,    toBankAbbr,   toBankName,
    toAccNo,      toAccName,    toAccKey,     pairKey,
  };
}

// ─── Convert a single mapped row → canonical transaction ──────
function convertRow(mapped, caseId) {
  const dep = _cn.normalizeAmount(mapped.raw_deposit    || '');
  const wdl = _cn.normalizeAmount(mapped.raw_withdrawal || '');
  const bal = _cn.normalizeAmount(mapped.balance        || '');

  const txDate     = _cn.normalizeDateThai(mapped.tx_date || '');
  const txTime     = _cn.normalizeTime    (mapped.tx_time || '');
  const txDatetime = _cn.mergeDateTime    (mapped.tx_date || '', mapped.tx_time || '');
  const txTypeRaw  = _cn.normalizeText    (mapped.tx_type || '');
  const txType     = _cn.normalizeTxType  (txTypeRaw);
  const direction  = inferDirection(txType, dep, wdl, mapped);
  const amount     = wdl > 0 ? wdl : dep;

  const ft = resolveFromTo(
    mapped, direction,
    mapped._owner_account,
    mapped._owner_bank
  );

  return {
    // ── Provenance ──────────────────────────────────────────
    case_id:              caseId || '',
    source_file_name:     mapped._file_name     || '',
    source_template_name: mapped._template_name || '',
    source_row_no:        mapped._source_row    || 0,

    // ── Identity ─────────────────────────────────────────────
    txid:                 newTxID(),
    dedupe_key:           '',
    duplicate_status:     'UNIQUE',
    duplicate_group_id:   '',
    confidence_score:     1,
    review_flag:          false,
    review_reason:        '',

    // ── Core ─────────────────────────────────────────────────
    tx_datetime:          txDatetime,
    tx_date:              txDate,
    tx_time:              txTime,
    tx_type:              txType,
    tx_direction:         direction,

    // ── From party ────────────────────────────────────────────
    from_bank_code:       ft.fromBankCode,
    from_bank_abbr:       ft.fromBankAbbr,
    from_bank_name:       ft.fromBankName,
    from_account_no:      ft.fromAccNo,
    from_account_name:    ft.fromAccName,
    from_account_key:     ft.fromAccKey,    // "KBANK 2243924416"

    // ── To party ──────────────────────────────────────────────
    to_bank_code:         ft.toBankCode,
    to_bank_abbr:         ft.toBankAbbr,
    to_bank_name:         ft.toBankName,
    to_account_no:        ft.toAccNo,
    to_account_name:      ft.toAccName,
    to_account_key:       ft.toAccKey,      // "GSB 020088515638"

    // ── Account pair ─────────────────────────────────────────
    account_pair_key:     ft.pairKey,       // "KBANK 2243924416 → GSB 020088515638"

    // ── Amount ───────────────────────────────────────────────
    amount,
    balance:              bal,

    // ── Channel / Refs ────────────────────────────────────────
    channel:              _cn.normalizeText(mapped.channel         || ''),
    transaction_ref:      _cn.normalizeText(mapped.transaction_ref || ''),
    ref1:                 _cn.normalizeText(mapped.ref1            || ''),
    ref2:                 _cn.normalizeText(mapped.ref2            || ''),
    ref3:                 _cn.normalizeText(mapped.ref3            || ''),

    // ── ATM/CDM ───────────────────────────────────────────────
    atm_cdm_machine_no:   _cn.normalizeText(mapped.atm_cdm_machine_no  || ''),
    atm_cdm_bank:         _cn.normalizeText(mapped.atm_cdm_bank         || ''),
    atm_cdm_location:     _cn.normalizeText(mapped.atm_cdm_location     || ''),
    atm_cdm_sequence_no:  _cn.normalizeText(mapped.atm_cdm_sequence_no  || ''),

    // ── Card ─────────────────────────────────────────────────
    card_bank:            _cn.normalizeText(mapped.card_bank  || ''),
    card_no:              _cn.normalizeText(mapped.card_no    || ''),

    // ── Branch / Staff ────────────────────────────────────────
    branch_code:          _cn.normalizeText(mapped.branch_code || ''),
    teller_id:            _cn.normalizeText(mapped.teller_id   || ''),

    // ── Cheque ───────────────────────────────────────────────
    cheque_no:            _cn.normalizeText(mapped.cheque_no     || ''),
    cheque_bank:          _cn.normalizeText(mapped.cheque_bank   || ''),
    cheque_branch:        _cn.normalizeText(mapped.cheque_branch || ''),

    // ── Contact ──────────────────────────────────────────────
    phone:                _cn.normalizeText(mapped.phone      || ''),
    email:                _cn.normalizeText(mapped.email      || ''),
    ip_address:           _cn.normalizeText(mapped.ip_address || ''),
    latitude:             _cn.normalizeText(mapped.latitude   || ''),
    longitude:            _cn.normalizeText(mapped.longitude  || ''),

    // ── Raw ───────────────────────────────────────────────────
    raw_deposit:          dep,
    raw_withdrawal:       wdl,
    raw_description:      _cn.normalizeText(mapped.raw_description || ''),
    raw_note:             _cn.normalizeText(mapped.raw_note        || ''),
    raw_json:             JSON.stringify(mapped._raw_row           || {}),
  };
}

function convertRows(mappedRows, caseId) {
  return mappedRows
    .filter(r => {
      const dep = _cn.normalizeAmount(r.raw_deposit    || '');
      const wdl = _cn.normalizeAmount(r.raw_withdrawal || '');
      return !!(r.tx_date || r.tx_datetime) || dep > 0 || wdl > 0;
    })
    .map(r => convertRow(r, caseId));
}

window.Converter = { convertRow, convertRows, newTxID };

/* =====================================================
   converter.js — raw mapped rows → canonical transactions
   ===================================================== */

/* Use short alias to avoid name collisions with global scope */
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

function resolveFromTo(mapped, direction, ownerAccount, ownerBankCode) {
  let fromAccNo   = _cn.normalizeAccountNo(mapped.from_account_no   || '');
  let fromAccName = _cn.normalizeText     (mapped.from_account_name || '');
  let fromBank    = _cn.normalizeBankCode (mapped.from_bank_code    || '');
  let fromBankN   = _cn.normalizeText     (mapped.from_bank_name    || '');
  let toAccNo     = _cn.normalizeAccountNo(mapped.to_account_no     || '');
  let toAccName   = _cn.normalizeText     (mapped.to_account_name   || '');
  let toBank      = _cn.normalizeBankCode (mapped.to_bank_code      || '');
  let toBankN     = _cn.normalizeText     (mapped.to_bank_name      || '');

  const owner     = _cn.normalizeAccountNo(ownerAccount  || '');
  const ownerBank = _cn.normalizeBankCode (ownerBankCode || '');

  if (owner) {
    if (direction === 'OUT' && !fromAccNo) { fromAccNo = owner; fromBank = ownerBank; }
    if (direction === 'IN'  && !toAccNo)   { toAccNo   = owner; toBank   = ownerBank; }
  }
  if (fromBank && !fromBankN) fromBankN = _cn.getBankName(fromBank);
  if (toBank   && !toBankN)   toBankN   = _cn.getBankName(toBank);

  return { fromAccNo, fromAccName, fromBank, fromBankN, toAccNo, toAccName, toBank, toBankN };
}

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

  const { fromAccNo, fromAccName, fromBank, fromBankN,
          toAccNo,   toAccName,   toBank,   toBankN } =
    resolveFromTo(mapped, direction, mapped._owner_account, mapped._owner_bank);

  return {
    case_id:              caseId || '',
    source_file_name:     mapped._file_name     || '',
    source_template_name: mapped._template_name || '',
    source_row_no:        mapped._source_row    || 0,

    txid:                 newTxID(),
    dedupe_key:           '',
    duplicate_status:     'UNIQUE',
    duplicate_group_id:   '',
    confidence_score:     1,
    review_flag:          false,
    review_reason:        '',

    tx_datetime:          txDatetime,
    tx_date:              txDate,
    tx_time:              txTime,
    tx_type:              txType,
    tx_direction:         direction,

    from_bank_code:       fromBank,
    from_bank_name:       fromBankN,
    from_account_no:      fromAccNo,
    from_account_name:    fromAccName,
    to_bank_code:         toBank,
    to_bank_name:         toBankN,
    to_account_no:        toAccNo,
    to_account_name:      toAccName,

    amount,
    balance:              bal,

    channel:              _cn.normalizeText(mapped.channel         || ''),
    transaction_ref:      _cn.normalizeText(mapped.transaction_ref || ''),
    ref1:                 _cn.normalizeText(mapped.ref1            || ''),
    ref2:                 _cn.normalizeText(mapped.ref2            || ''),
    ref3:                 _cn.normalizeText(mapped.ref3            || ''),

    atm_cdm_machine_no:   _cn.normalizeText(mapped.atm_cdm_machine_no  || ''),
    atm_cdm_bank:         _cn.normalizeText(mapped.atm_cdm_bank         || ''),
    atm_cdm_location:     _cn.normalizeText(mapped.atm_cdm_location     || ''),
    atm_cdm_sequence_no:  _cn.normalizeText(mapped.atm_cdm_sequence_no  || ''),

    card_bank:            _cn.normalizeText(mapped.card_bank  || ''),
    card_no:              _cn.normalizeText(mapped.card_no    || ''),

    branch_code:          _cn.normalizeText(mapped.branch_code || ''),
    teller_id:            _cn.normalizeText(mapped.teller_id   || ''),

    cheque_no:            _cn.normalizeText(mapped.cheque_no     || ''),
    cheque_bank:          _cn.normalizeText(mapped.cheque_bank   || ''),
    cheque_branch:        _cn.normalizeText(mapped.cheque_branch || ''),

    phone:                _cn.normalizeText(mapped.phone      || ''),
    email:                _cn.normalizeText(mapped.email      || ''),
    ip_address:           _cn.normalizeText(mapped.ip_address || ''),
    latitude:             _cn.normalizeText(mapped.latitude   || ''),
    longitude:            _cn.normalizeText(mapped.longitude  || ''),

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

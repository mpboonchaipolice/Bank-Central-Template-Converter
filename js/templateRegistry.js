/* =====================================================
   templateRegistry.js — built-in templates + detection
   ===================================================== */

// ─── Built-in template definitions ────────────────────────────
const BUILTIN_TEMPLATES = [
  {
    name: 'KBank CIB',
    version: '1.0',
    builtin: true,
    description: 'KBank Corporate Internet Banking / Branch statement (38 cols, Thai headers, row 4)',
    header_row: 4,         // 1-based row number of the header row
    title_rows: [1, 2, 3], // rows containing file metadata (account no, date range)
    owner_account_row: 2,  // sharedString in row 2 contains "บัญชี XXX-X-XXXXX-X"
    signature_headers: [
      'วันที่ทำรายการ', 'เวลาที่ทำรายการ',
      'หมายเลขบัญชีต้นทาง', 'หมายเลขบัญชีปลายทาง',
      'ถอนเงิน', 'ฝากเงิน', 'ยอดเงินคงเหลือ'
    ],
    column_mapping: {
      'วันที่ทำรายการ':                              'tx_date',
      'เวลาที่ทำรายการ':                             'tx_time',
      'ประเภทรายการ':                                'tx_type',
      'ช่องทาง':                                     'channel',
      'รหัสธนาคารต้นทาง':                            'from_bank_code',
      'ชื่อธนาคารต้นทาง':                            'from_bank_name',
      'หมายเลขบัญชีต้นทาง':                          'from_account_no',
      'ชื่อบัญชีต้นทาง':                              'from_account_name',
      'รหัสธนาคารปลายทาง':                           'to_bank_code',
      'ชื่อธนาคารปลายทาง':                           'to_bank_name',
      'หมายเลขบัญชีปลายทาง':                         'to_account_no',
      'ชื่อบัญชีปลายทาง':                             'to_account_name',
      'หมายเลขพร้อมเพย์ (ขาโอนออก)':                 'ref3',
      'ชื่อร้านค้า / ชื่อบริษัท':                     'raw_description',
      'Ref Number1':                                  'ref1',
      'Ref Number2':                                  'ref2',
      'Ref Number3':                                  'ref3',
      'หมายเลขธุรกรรม':                               'transaction_ref',
      'ลำดับรายการทำการของตู้':                        'atm_cdm_sequence_no',
      'ธนาคารเจ้าของบัตร':                            'card_bank',
      'หมายเลขบัตร':                                  'card_no',
      'หมายเลขตู้ ATM/CDM':                           'atm_cdm_machine_no',
      'ธนาคารเจ้าของตู้ ATM/CDM':                     'atm_cdm_bank',
      'ATM/CDM Location':                             'atm_cdm_location',
      'ถอนเงิน':                                      'raw_withdrawal',
      'ฝากเงิน':                                      'raw_deposit',
      'ยอดเงินคงเหลือ':                               'balance',
      'Teller ID (ผู้ทำรายการ)':                      'teller_id',
      'รหัสสาขาที่ทำธุรกรรม':                         'branch_code',
      'เลขที่เช็ค':                                   'cheque_no',
      'ธนาคารผู้ออกเช็ค':                             'cheque_bank',
      'สาขาผู้ออกเช็ค':                               'cheque_branch',
      'หมายเลขโทรศัพท์ที่เกี่ยวข้องกับธุรกรรม':       'phone',
      'Email ที่เกี่ยวข้องกับธุรกรรม':                'email',
      'IP Address':                                   'ip_address',
      'Latitude':                                     'latitude',
      'Longitude':                                    'longitude',
    }
  },
  {
    name: 'Prasan Template04',
    version: '1.0',
    builtin: true,
    description: 'Prasan / DSI cross-bank investigation template (English headers)',
    header_row: 1,
    title_rows: [],
    signature_headers: [
      'authorityid', 'setid', 'letterid', 'txno',
      'fromaccountno', 'toaccountno', 'deposit', 'withdrawal'
    ],
    column_mapping: {
      'authorityid':    '_ignore',
      'setid':          '_ignore',
      'letterid':       '_ignore',
      'letterdate':     '_ignore',
      'searchtype':     '_ignore',
      'accountno':      '_owner_account',  // special: file owner account
      'accountname':    '_owner_name',
      'bankcode':       '_owner_bank',
      'txno':           'transaction_ref',
      'txdate':         'tx_date',
      'txtime':         'tx_time',
      'txtype':         'tx_type',
      'fromaccountno':  'from_account_no',
      'fromaccountname':'from_account_name',
      'frombankcode':   'from_bank_code',
      'toaccountno':    'to_account_no',
      'toaccountname':  'to_account_name',
      'tobankcode':     'to_bank_code',
      'txchannel':      'channel',
      'deposit':        'raw_deposit',
      'withdrawal':     'raw_withdrawal',
      'balance':        'balance',
      'branchcode':     'branch_code',
      'empcode':        'teller_id',
      'machinecode':    'atm_cdm_machine_no',
      'machineowner':   'atm_cdm_bank',
      'ipaddress':      'ip_address',
      'telephone':      'phone',
      'email':          'email',
      'note':           'raw_note',
    }
  }
];

// ─── Synonym dictionary for auto-suggest ─────────────────────
const SYNONYM_DICT = {
  // Date
  'วันที่ทำรายการ':'tx_date','วันที่':'tx_date','date':'tx_date','txdate':'tx_date',
  'transaction date':'tx_date','transactiondate':'tx_date',
  // Time
  'เวลาที่ทำรายการ':'tx_time','เวลา':'tx_time','time':'tx_time','txtime':'tx_time',
  // Type
  'ประเภทรายการ':'tx_type','txtype':'tx_type','transaction type':'tx_type','type':'tx_type',
  // Channel
  'ช่องทาง':'channel','txchannel':'channel','channel':'channel',
  // From
  'รหัสธนาคารต้นทาง':'from_bank_code','frombankcode':'from_bank_code',
  'ชื่อธนาคารต้นทาง':'from_bank_name','frombankname':'from_bank_name',
  'หมายเลขบัญชีต้นทาง':'from_account_no','fromaccountno':'from_account_no',
  'ชื่อบัญชีต้นทาง':'from_account_name','fromaccountname':'from_account_name',
  // To
  'รหัสธนาคารปลายทาง':'to_bank_code','tobankcode':'to_bank_code',
  'ชื่อธนาคารปลายทาง':'to_bank_name','tobankname':'to_bank_name',
  'หมายเลขบัญชีปลายทาง':'to_account_no','toaccountno':'to_account_no',
  'ชื่อบัญชีปลายทาง':'to_account_name','toaccountname':'to_account_name',
  // Amount
  'ถอนเงิน':'raw_withdrawal','withdrawal':'raw_withdrawal','debit':'raw_withdrawal',
  'ฝากเงิน':'raw_deposit','deposit':'raw_deposit','credit':'raw_deposit',
  'ยอดเงินคงเหลือ':'balance','balance':'balance','คงเหลือ':'balance',
  // Refs
  'ref number1':'ref1','ref1':'ref1','ref number2':'ref2','ref2':'ref2',
  'ref number3':'ref3','ref3':'ref3',
  'หมายเลขธุรกรรม':'transaction_ref','txno':'transaction_ref',
  'transaction ref':'transaction_ref','reference':'transaction_ref',
  // ATM/CDM
  'หมายเลขตู้ atm/cdm':'atm_cdm_machine_no','machinecode':'atm_cdm_machine_no',
  'atm_cdm_machine_no':'atm_cdm_machine_no',
  'ธนาคารเจ้าของตู้ atm/cdm':'atm_cdm_bank','machineowner':'atm_cdm_bank',
  'atm/cdm location':'atm_cdm_location','ลำดับรายการทำการของตู้':'atm_cdm_sequence_no',
  // Card
  'ธนาคารเจ้าของบัตร':'card_bank','หมายเลขบัตร':'card_no',
  // Staff
  'teller id':'teller_id','teller id (ผู้ทำรายการ)':'teller_id','empcode':'teller_id',
  'รหัสสาขาที่ทำธุรกรรม':'branch_code','branchcode':'branch_code',
  // Cheque
  'เลขที่เช็ค':'cheque_no','chequeno':'cheque_no',
  'ธนาคารผู้ออกเช็ค':'cheque_bank','สาขาผู้ออกเช็ค':'cheque_branch',
  // Contact
  'หมายเลขโทรศัพท์ที่เกี่ยวข้องกับธุรกรรม':'phone','telephone':'phone','phone':'phone',
  'email ที่เกี่ยวข้องกับธุรกรรม':'email','email':'email',
  'ip address':'ip_address','ipaddress':'ip_address',
  'latitude':'latitude','longitude':'longitude',
  // Merchant
  'ชื่อร้านค้า / ชื่อบริษัท':'raw_description','merchant':'raw_description',
  // Note
  'note':'raw_note','หมายเหตุ':'raw_note',
};

// ─── All canonical fields list ─────────────────────────────────
const CANONICAL_FIELDS = [
  { id:'_ignore',             label:'— Ignore —',              cat:'meta' },
  { id:'tx_date',             label:'Transaction Date',         cat:'core' },
  { id:'tx_time',             label:'Transaction Time',         cat:'core' },
  { id:'tx_type',             label:'Transaction Type',         cat:'core' },
  { id:'tx_direction',        label:'Direction (IN/OUT)',        cat:'core' },
  { id:'channel',             label:'Channel',                  cat:'core' },
  { id:'transaction_ref',     label:'Transaction Ref',          cat:'refs' },
  { id:'ref1',                label:'Ref 1',                    cat:'refs' },
  { id:'ref2',                label:'Ref 2',                    cat:'refs' },
  { id:'ref3',                label:'Ref 3',                    cat:'refs' },
  { id:'from_bank_code',      label:'From Bank Code',           cat:'from' },
  { id:'from_bank_name',      label:'From Bank Name',           cat:'from' },
  { id:'from_account_no',     label:'From Account No',          cat:'from' },
  { id:'from_account_name',   label:'From Account Name',        cat:'from' },
  { id:'to_bank_code',        label:'To Bank Code',             cat:'to' },
  { id:'to_bank_name',        label:'To Bank Name',             cat:'to' },
  { id:'to_account_no',       label:'To Account No',            cat:'to' },
  { id:'to_account_name',     label:'To Account Name',          cat:'to' },
  { id:'raw_deposit',         label:'Raw Deposit',              cat:'amount' },
  { id:'raw_withdrawal',      label:'Raw Withdrawal',           cat:'amount' },
  { id:'balance',             label:'Balance',                  cat:'amount' },
  { id:'atm_cdm_machine_no',  label:'ATM/CDM Machine No',       cat:'atm' },
  { id:'atm_cdm_bank',        label:'ATM/CDM Bank',             cat:'atm' },
  { id:'atm_cdm_location',    label:'ATM/CDM Location',         cat:'atm' },
  { id:'atm_cdm_sequence_no', label:'ATM/CDM Sequence',         cat:'atm' },
  { id:'card_bank',           label:'Card Bank',                cat:'card' },
  { id:'card_no',             label:'Card No',                  cat:'card' },
  { id:'branch_code',         label:'Branch Code',              cat:'staff' },
  { id:'teller_id',           label:'Teller ID',                cat:'staff' },
  { id:'cheque_no',           label:'Cheque No',                cat:'cheque' },
  { id:'cheque_bank',         label:'Cheque Bank',              cat:'cheque' },
  { id:'cheque_branch',       label:'Cheque Branch',            cat:'cheque' },
  { id:'phone',               label:'Phone',                    cat:'contact' },
  { id:'email',               label:'Email',                    cat:'contact' },
  { id:'ip_address',          label:'IP Address',               cat:'contact' },
  { id:'latitude',            label:'Latitude',                 cat:'geo' },
  { id:'longitude',           label:'Longitude',                cat:'geo' },
  { id:'raw_description',     label:'Raw Description',          cat:'raw' },
  { id:'raw_note',            label:'Raw Note',                 cat:'raw' },
];

// ─── Detection algorithm ───────────────────────────────────────
function normalizeHeader(h) {
  return String(h || '').toLowerCase().replace(/\s+/g,'').trim();
}

function detectTemplate(fileHeaders, allTemplates) {
  const normFile = fileHeaders.map(normalizeHeader);

  let best = null, bestScore = 0;

  for (const tpl of allTemplates) {
    const sigs = (tpl.signature_headers || []).map(normalizeHeader);
    if (!sigs.length) continue;
    const matched = sigs.filter(s => normFile.includes(s)).length;
    const score   = matched / sigs.length;
    if (score > bestScore) { bestScore = score; best = tpl; }
  }

  if (bestScore >= 0.7) return { template: best, confidence: bestScore };
  return { template: null, confidence: bestScore };
}

// ─── Auto-suggest mapping for one source header ───────────────
function suggestMapping(sourceHeader) {
  const key = normalizeHeader(sourceHeader).replace(/[^a-z0-9ก-๙\/]/g,'');
  const full = normalizeHeader(sourceHeader);
  // Exact match in synonym dict
  if (SYNONYM_DICT[full]) return { field: SYNONYM_DICT[full], confidence: 1.0 };
  if (SYNONYM_DICT[key])  return { field: SYNONYM_DICT[key],  confidence: 1.0 };
  // Partial match
  for (const [syn, field] of Object.entries(SYNONYM_DICT)) {
    const normSyn = normalizeHeader(syn).replace(/[^a-z0-9ก-๙\/]/g,'');
    if (normSyn && (key.includes(normSyn) || normSyn.includes(key)) && key.length > 2) {
      return { field, confidence: 0.7 };
    }
  }
  return { field: '_ignore', confidence: 0 };
}

// ─── Init: load built-ins + user templates ────────────────────
async function loadAllTemplates() {
  const user    = await window.Storage.getAllTemplates();
  const userMap = {};
  user.forEach(t => userMap[t.name] = t);
  // Merge: user templates override built-ins with same name
  const all = BUILTIN_TEMPLATES.map(b => userMap[b.name] ? { ...b, ...userMap[b.name] } : b);
  // Add user-only templates
  user.forEach(t => { if (!BUILTIN_TEMPLATES.find(b => b.name === t.name)) all.push(t); });
  return all;
}

window.TemplateRegistry = {
  BUILTIN_TEMPLATES,
  CANONICAL_FIELDS,
  SYNONYM_DICT,
  detectTemplate,
  suggestMapping,
  normalizeHeader,
  loadAllTemplates,
};

/* =====================================================
   normalizer.js — data normalization helpers
   Bank Registry: code ↔ abbreviation ↔ Thai name
   ===================================================== */

// ─── Bank Registry (single source of truth) ────────────────
const BANK_REGISTRY = {
  '002': { abbr:'BBL',   nameTH:'ธนาคารกรุงเทพ',                                      nameEN:'Bangkok Bank' },
  '004': { abbr:'KBANK', nameTH:'ธนาคารกสิกรไทย',                                     nameEN:'Kasikorn Bank' },
  '006': { abbr:'KTB',   nameTH:'ธนาคารกรุงไทย',                                      nameEN:'Krungthai Bank' },
  '011': { abbr:'TTB',   nameTH:'ธนาคารทหารไทยธนชาต',                                 nameEN:'TMBThanachart Bank' },
  '014': { abbr:'SCB',   nameTH:'ธนาคารไทยพาณิชย์',                                   nameEN:'Siam Commercial Bank' },
  '022': { abbr:'CIMBT', nameTH:'ธนาคารซีไอเอ็มบีไทย',                               nameEN:'CIMB Thai Bank' },
  '024': { abbr:'UOBT',  nameTH:'ธนาคารยูโอบี',                                       nameEN:'UOB Thailand' },
  '025': { abbr:'BAY',   nameTH:'ธนาคารกรุงศรีอยุธยา',                                nameEN:'Bank of Ayudhya' },
  '030': { abbr:'GSB',   nameTH:'ธนาคารออมสิน',                                       nameEN:'Government Savings Bank' },
  '031': { abbr:'HSBC',  nameTH:'ธนาคารฮ่องกงและเซี่ยงไฮ้',                          nameEN:'HSBC' },
  '033': { abbr:'GHB',   nameTH:'ธนาคารอาคารสงเคราะห์',                              nameEN:'Government Housing Bank' },
  '034': { abbr:'BAAC',  nameTH:'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร',              nameEN:'BAAC' },
  '035': { abbr:'EXIM',  nameTH:'ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย',       nameEN:'EXIM Bank' },
  '039': { abbr:'MHCB',  nameTH:'มิซูโฮ',                                             nameEN:'Mizuho Corporate Bank' },
  '045': { abbr:'BNP',   nameTH:'บีเอ็นพี พารีบาส',                                  nameEN:'BNP Paribas' },
  '052': { abbr:'LHB',   nameTH:'ธนาคารแลนด์แอนด์เฮ้าส์',                            nameEN:'Land and Houses Bank' },
  '066': { abbr:'ISBT',  nameTH:'ธนาคารอิสลามแห่งประเทศไทย',                         nameEN:'Islamic Bank of Thailand' },
  '067': { abbr:'TISCO', nameTH:'ธนาคารทิสโก้',                                      nameEN:'TISCO Bank' },
  '069': { abbr:'KKP',   nameTH:'ธนาคารเกียรตินาคินภัทร',                            nameEN:'Kiatnakin Phatra Bank' },
  '070': { abbr:'ICBCT', nameTH:'ธนาคารไอซีบีซี (ไทย)',                              nameEN:'ICBC Thai' },
  '071': { abbr:'TCD',   nameTH:'ธนาคารไทยเครดิตเพื่อรายย่อย',                      nameEN:'Thai Credit Retail Bank' },
  '073': { abbr:'LHFG',  nameTH:'ธนาคารแลนด์ แอนด์ เฮ้าส์',                         nameEN:'LH Financial Group' },
  '098': { abbr:'SME',   nameTH:'ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย', nameEN:'SME Bank' },
};

// Build reverse lookups at load time
const _BY_ABBR   = {}; // upper(abbr) → code
const _BY_NAMETH = {}; // nameTH → code
const _BY_NAMEEN = {}; // upper(nameEN) → code

for (const [code, info] of Object.entries(BANK_REGISTRY)) {
  _BY_ABBR[info.abbr.toUpperCase()]   = code;
  _BY_NAMETH[info.nameTH]             = code;
  _BY_NAMEEN[info.nameEN.toUpperCase()] = code;
}

// Extra common abbreviation aliases used in bank statements
const _ALIASES = {
  'KBANK':'004', 'K-BANK':'004', 'KASIKORN':'004', 'KAS':'004',
  'BBL':'002', 'BANGKOKBANK':'002',
  'KTB':'006', 'KRUNGTHAI':'006',
  'SCB':'014', 'SCBT':'014', 'SIAM COMMERCIAL':'014',
  'GSB':'030', 'OOMSIN':'030', 'GOVERNMENTSAVINGS':'030',
  'GHB':'033', 'AKHAN':'033',
  'BAAC':'034', 'THAKORN':'034', 'THANAKAN':'034',
  'BAY':'025', 'KRUNGSRI':'025',
  'TTB':'011', 'TMB':'011', 'THANACHART':'011', 'ThanachartBank':'011',
  'KKP':'069', 'KIATNAKIN':'069',
  'TISCO':'067',
  'CIMB':'022', 'CIMBT':'022',
  'UOB':'024', 'UOBT':'024',
  'ISBT':'066', 'IBANK':'066', 'ISLAMIC':'066',
  'LHB':'052', 'LHBANK':'052', 'LANDHOUSE':'052',
  'LHFG':'073',
  'ICBC':'070', 'ICBCT':'070',
  'TCD':'071', 'THAICREDIT':'071',
  'SME':'098', 'SMEBANK':'098',
  'EXIM':'035', 'EXIMBANK':'035',
  'MHCB':'039', 'MIZUHO':'039',
  'HSBC':'031',
  'BNP':'045', 'BNPPARIBAS':'045',
};

// ─── Core lookup: any input → 3-digit code or null ──────────
function _findCode(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;

  // Numeric code
  if (/^\d+$/.test(s)) {
    const padded = s.padStart(3, '0');
    return BANK_REGISTRY[padded] ? padded : null;
  }

  const upper = s.toUpperCase().replace(/\s+/g, '');

  // Direct abbreviation
  if (_BY_ABBR[upper])                  return _BY_ABBR[upper];

  // Alias table
  if (_ALIASES[upper])                  return _ALIASES[upper];

  // Full Thai name (exact)
  if (_BY_NAMETH[s])                    return _BY_NAMETH[s];

  // Full English name (exact)
  if (_BY_NAMEEN[upper])                return _BY_NAMEEN[upper];

  // Partial Thai / English match
  for (const [nameTH, code] of Object.entries(_BY_NAMETH)) {
    if (s.includes(nameTH.slice(0, 6)) || nameTH.includes(s.slice(0, 6))) return code;
  }
  for (const [nameEN, code] of Object.entries(_BY_NAMEEN)) {
    if (upper.includes(nameEN.slice(0, 4))) return code;
  }

  return null;
}

// ─── Public normalizer functions ─────────────────────────────

/** Returns bank abbreviation (e.g. "KBANK", "SCB", "GSB").
 *  Accepts numeric code ("004"), abbr ("KBANK"), Thai name, or English name.
 *  Returns original string if not found.
 *  normalizeBankCode("014") => "SCB"
 *  normalizeBankCode("GSB") => "GSB"
 *  normalizeBankCode("ธนาคารออมสิน") => "GSB"
 */
function normalizeBankCode(v) {
  const code = _findCode(v);
  if (code) return BANK_REGISTRY[code].abbr;
  const s = String(v || '').trim();
  return s;
}

/** Alias for normalizeBankCode */
const getBankAbbr = normalizeBankCode;

/** Returns full Thai bank name. Accepts code / abbr / name. */
function getBankName(v) {
  const code = _findCode(v);
  if (code) return BANK_REGISTRY[code].nameTH;
  return String(v || '').trim();
}

/** Returns numeric 3-digit bank code. */
function getBankCode(v) {
  const code = _findCode(v);
  return code || String(v || '').trim();
}

/** Build normalized account identity key: "BANK_ABBR ACCOUNT_NO"
 *  buildAccountKey("004", "2243924416")    => "KBANK 2243924416"
 *  buildAccountKey("KBANK", "2243924416")  => "KBANK 2243924416"
 *  buildAccountKey("030", "020088515638")  => "GSB 020088515638"
 *  buildAccountKey("", "2243924416")       => "UNKNOWN 2243924416"
 */
function buildAccountKey(bankInfo, accountNo) {
  const acc  = normalizeAccountNo(accountNo || '');
  if (!acc) return '';
  const abbr = normalizeBankCode(bankInfo || '');
  return (abbr || 'UNKNOWN') + ' ' + acc;
}

// ─── Text ──────────────────────────────────────────────────────
function normalizeText(v) {
  if (v == null || v === '') return '';
  return String(v).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Account Number ────────────────────────────────────────────
function normalizeAccountNo(v) {
  if (!v) return '';
  // Remove spaces and dashes only; keep leading zeros; keep as string
  return String(v).replace(/[-\s]/g, '').trim();
}

// ─── Amount ───────────────────────────────────────────────────
function normalizeAmount(v) {
  if (v == null || v === '' || v === '-') return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

// ─── Date (Thai BE ↔ CE) ───────────────────────────────────────
function normalizeDateThai(v) {
  if (!v) return '';
  const s = String(v).trim();

  // dd/mm/yyyy or dd-mm-yyyy
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (+y > 2400) y = String(+y - 543);
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // yyyy/mm/dd or yyyy-mm-dd
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    let [, y, mo, d] = m;
    if (+y > 2400) y = String(+y - 543);
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // dd Mon yyyy
  const MON = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
               jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (+y > 2400) y = String(+y - 543);
    return `${y}-${(MON[mo.toLowerCase()]||'01')}-${d.padStart(2,'0')}`;
  }

  return s;
}

// ─── Time ─────────────────────────────────────────────────────
function normalizeTime(v) {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return `${m[1].padStart(2,'0')}:${m[2]}:${m[3]||'00'}`;
  if (/^\d{6}$/.test(s)) return `${s.slice(0,2)}:${s.slice(2,4)}:${s.slice(4,6)}`;
  return s;
}

// ─── DateTime merge ───────────────────────────────────────────
function mergeDateTime(date, time) {
  const d = normalizeDateThai(date);
  const t = normalizeTime(time);
  if (d && t) return `${d}T${t}`;
  return d || '';
}

// ─── DateTime → epoch ms ──────────────────────────────────────
function dateTimeToMs(dtStr) {
  if (!dtStr) return 0;
  try { return new Date(dtStr).getTime() || 0; } catch { return 0; }
}

// ─── TX type normalizer ───────────────────────────────────────
const TX_TYPE_MAP = {
  'โอนเงิน':'TRANSFER',      'transfer':'TRANSFER',     'trf':'TRANSFER',
  'รับโอนเงิน':'TRANSFER',   'โอน':'TRANSFER',
  'ถอนเงิน':'CASH_WITHDRAWAL','ถอนเงินสด':'CASH_WITHDRAWAL',
  'cash withdrawal':'CASH_WITHDRAWAL', 'withdrawal':'CASH_WITHDRAWAL',
  'atm withdrawal':'CASH_WITHDRAWAL',  'ฝาก':'CASH_DEPOSIT',
  'ฝากเงิน':'CASH_DEPOSIT',  'ฝากเงินสด':'CASH_DEPOSIT',
  'cash deposit':'CASH_DEPOSIT', 'deposit':'CASH_DEPOSIT',
  'ชำระเงิน':'PAYMENT',      'payment':'PAYMENT',       'bill payment':'PAYMENT',
  'ค่าธรรมเนียม':'FEE',      'fee':'FEE',               'service charge':'FEE',
  'ดอกเบี้ย':'INTEREST',     'interest':'INTEREST',
  'เปิดบัญชี':'ACCOUNT_OPEN','account open':'ACCOUNT_OPEN',
  'cheque':'CHEQUE',         'เช็ค':'CHEQUE',
};

function normalizeTxType(v) {
  if (!v) return 'TRANSFER';
  const key = String(v).trim().toLowerCase();
  return TX_TYPE_MAP[key] || TX_TYPE_MAP[String(v).trim()] || String(v).trim().toUpperCase();
}

// ─── Extract owner account from KBank title row ──────────────
function extractOwnerAccountFromTitle(titleStr) {
  if (!titleStr) return null;
  const m = titleStr.match(/บัญชี\s+([\d\-]+)/);
  if (m) return normalizeAccountNo(m[1]);
  return null;
}

window.Normalizer = {
  BANK_REGISTRY,
  normalizeText,
  normalizeAccountNo,
  normalizeAmount,
  normalizeDateThai,
  normalizeTime,
  mergeDateTime,
  dateTimeToMs,
  normalizeBankCode,
  getBankAbbr,
  getBankCode,
  getBankName,
  buildAccountKey,
  normalizeTxType,
  extractOwnerAccountFromTitle,
  TX_TYPE_MAP,
};

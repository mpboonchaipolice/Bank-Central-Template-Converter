/* =====================================================
   normalizer.js — data normalization helpers
   ===================================================== */

const BANK_MAP = {
  '002': 'BBL (กรุงเทพ)',     '004': 'KBank (กสิกรไทย)',
  '006': 'KTB (กรุงไทย)',     '011': 'TTB (ทีทีบี)',
  '014': 'SCB (ไทยพาณิชย์)', '017': 'Citibank',
  '020': 'SCSB',              '022': 'CIMB',
  '024': 'UOB',               '025': 'BAY (กรุงศรี)',
  '030': 'GSB (ออมสิน)',      '031': 'HSBC',
  '033': 'GHB (อาคารสงเคราะห์)', '034': 'BAAC (ธกส.)',
  '039': 'Mizuho',            '045': 'BNP Paribas',
  '052': 'LH Bank',           '066': 'IBank (อิสลาม)',
  '067': 'TISCO',             '069': 'KKP',
  '070': 'ICBC',              '071': 'Thai Credit',
  '073': 'LHFin',             '098': 'PromptPay',
};

// ─── Text ──────────────────────────────────────────────────────
function normalizeText(v) {
  if (v == null || v === '') return '';
  return String(v).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ─── Account Number ────────────────────────────────────────────
function normalizeAccountNo(v) {
  if (!v) return '';
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

  // dd/mm/yyyy  or  dd-mm-yyyy
  let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (+y > 2400) y = String(+y - 543);
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // yyyy/mm/dd  or  yyyy-mm-dd
  m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    let [, y, mo, d] = m;
    if (+y > 2400) y = String(+y - 543);
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // dd Mon yyyy  e.g. "22 Jan 2026"
  const MON = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
               jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (+y > 2400) y = String(+y - 543);
    return `${y}-${(MON[mo.toLowerCase()]||'01')}-${d.padStart(2,'0')}`;
  }

  return s; // passthrough
}

// ─── Time ─────────────────────────────────────────────────────
function normalizeTime(v) {
  if (!v) return '';
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return `${m[1].padStart(2,'0')}:${m[2]}:${m[3] || '00'}`;
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

// ─── DateTime → epoch ms (for dedup window) ───────────────────
function dateTimeToMs(dtStr) {
  if (!dtStr) return 0;
  try { return new Date(dtStr).getTime() || 0; } catch { return 0; }
}

// ─── Bank code ────────────────────────────────────────────────
function normalizeBankCode(v) {
  if (!v) return '';
  const s = String(v).trim();
  // If it's already a numeric code, pad to 3
  if (/^\d+$/.test(s)) return s.padStart(3, '0');
  // Reverse-lookup by abbreviation
  const upper = s.toUpperCase();
  for (const [code, name] of Object.entries(BANK_MAP)) {
    if (name.toUpperCase().includes(upper) || upper === name.split(' ')[0]) return code;
  }
  return s;
}

function getBankName(code) {
  if (!code) return '';
  return BANK_MAP[String(code).padStart(3,'0')] || code;
}

// ─── TX type normalizer ────────────────────────────────────────
const TX_TYPE_MAP = {
  'โอนเงิน': 'TRANSFER',      'transfer': 'TRANSFER',     'trf': 'TRANSFER',
  'รับโอนเงิน': 'TRANSFER',   'โอน': 'TRANSFER',
  'ถอนเงิน': 'CASH_WITHDRAWAL','ถอนเงินสด': 'CASH_WITHDRAWAL',
  'cash withdrawal': 'CASH_WITHDRAWAL', 'withdrawal': 'CASH_WITHDRAWAL',
  'atm withdrawal': 'CASH_WITHDRAWAL',
  'ฝากเงิน': 'CASH_DEPOSIT',  'ฝากเงินสด': 'CASH_DEPOSIT',
  'cash deposit': 'CASH_DEPOSIT', 'deposit': 'CASH_DEPOSIT',
  'ชำระเงิน': 'PAYMENT',      'payment': 'PAYMENT',       'bill payment': 'PAYMENT',
  'ค่าธรรมเนียม': 'FEE',      'fee': 'FEE',               'service charge': 'FEE',
  'ดอกเบี้ย': 'INTEREST',     'interest': 'INTEREST',
  'เปิดบัญชี': 'ACCOUNT_OPEN','account open': 'ACCOUNT_OPEN',
  'cheque': 'CHEQUE',         'เช็ค': 'CHEQUE',
};

function normalizeTxType(v) {
  if (!v) return 'TRANSFER';
  const key = String(v).trim().toLowerCase();
  return TX_TYPE_MAP[key] || TX_TYPE_MAP[String(v).trim()] || String(v).trim().toUpperCase();
}

// ─── Extract account number from KBank title row ───────────────
// e.g. "ของหมายเลขบัญชี 224-3-92441-6  ชื่อบัญชี  น.ส. นิตยา"
function extractOwnerAccountFromTitle(titleStr) {
  if (!titleStr) return null;
  const m = titleStr.match(/บัญชี\s+([\d\-]+)/);
  if (m) return normalizeAccountNo(m[1]);
  return null;
}

window.Normalizer = {
  normalizeText,
  normalizeAccountNo,
  normalizeAmount,
  normalizeDateThai,
  normalizeTime,
  mergeDateTime,
  dateTimeToMs,
  normalizeBankCode,
  getBankName,
  normalizeTxType,
  extractOwnerAccountFromTitle,
  BANK_MAP,
  TX_TYPE_MAP,
};

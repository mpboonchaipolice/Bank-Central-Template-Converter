/* =====================================================
   storage.js — IndexedDB wrapper for BankTemplateConverter
   ===================================================== */

const DB_NAME = 'BankTemplateCvt';
const DB_VERSION = 2;

const STORES = {
  TEMPLATES:    'templates',
  TRANSACTIONS: 'transactions',
  AUDIT_LOG:    'auditLog',
  SESSION:      'session'
};

let _db = null;

async function openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORES.TEMPLATES)) {
        db.createObjectStore(STORES.TEMPLATES, { keyPath: 'name' });
      }
      if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
        const s = db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'txid' });
        s.createIndex('dedupe_key',  'dedupe_key',  { unique: false });
        s.createIndex('tx_date',     'tx_date',     { unique: false });
        s.createIndex('case_id',     'case_id',     { unique: false });
        s.createIndex('dup_status',  'duplicate_status', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.AUDIT_LOG)) {
        const a = db.createObjectStore(STORES.AUDIT_LOG, { keyPath: 'id', autoIncrement: true });
        a.createIndex('ts', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.SESSION)) {
        db.createObjectStore(STORES.SESSION, { keyPath: 'key' });
      }
    };

    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

function idbOp(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx    = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req   = fn(store);
    if (req && req.onsuccess !== undefined) {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } else {
      tx.oncomplete = () => resolve(true);
      tx.onerror    = () => reject(tx.error);
    }
  }));
}

// ─── Templates ────────────────────────────────────────────────
async function saveTemplate(tpl) {
  return idbOp(STORES.TEMPLATES, 'readwrite', s => s.put(tpl));
}
async function getAllTemplates() {
  return idbOp(STORES.TEMPLATES, 'readonly', s => s.getAll());
}
async function getTemplate(name) {
  return idbOp(STORES.TEMPLATES, 'readonly', s => s.get(name));
}
async function deleteTemplate(name) {
  return idbOp(STORES.TEMPLATES, 'readwrite', s => s.delete(name));
}

// ─── Transactions ──────────────────────────────────────────────
async function saveTransactions(rows) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORES.TRANSACTIONS, 'readwrite');
    const store = tx.objectStore(STORES.TRANSACTIONS);
    rows.forEach(r => store.put(r));
    tx.oncomplete = () => resolve(rows.length);
    tx.onerror    = () => reject(tx.error);
  });
}
async function getAllTransactions() {
  return idbOp(STORES.TRANSACTIONS, 'readonly', s => s.getAll());
}
async function clearTransactions() {
  return idbOp(STORES.TRANSACTIONS, 'readwrite', s => s.clear());
}
async function updateTransaction(row) {
  return idbOp(STORES.TRANSACTIONS, 'readwrite', s => s.put(row));
}

// ─── Audit Log ─────────────────────────────────────────────────
async function addAudit(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORES.AUDIT_LOG, 'readwrite');
    const store = tx.objectStore(STORES.AUDIT_LOG);
    const req   = store.add({ ...entry, timestamp: new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}
async function getAuditLog() {
  return idbOp(STORES.AUDIT_LOG, 'readonly', s => s.getAll());
}

// ─── Session (lightweight KV) ──────────────────────────────────
async function setSession(key, value) {
  return idbOp(STORES.SESSION, 'readwrite', s => s.put({ key, value }));
}
async function getSession(key) {
  const r = await idbOp(STORES.SESSION, 'readonly', s => s.get(key));
  return r ? r.value : null;
}

window.Storage = {
  saveTemplate, getAllTemplates, getTemplate, deleteTemplate,
  saveTransactions, getAllTransactions, clearTransactions, updateTransaction,
  addAudit, getAuditLog,
  setSession, getSession,
  openDB
};

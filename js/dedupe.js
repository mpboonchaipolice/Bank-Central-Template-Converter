/* =====================================================
   dedupe.js — SHA-256 dedupe key + duplicate detection
   Depends on: normalizer.js
   ===================================================== */

const _dn = window.Normalizer;

// ─── SHA-256 via Web Crypto API ───────────────────────────────
async function sha256(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─── Build canonical dedupe key ───────────────────────────────
async function buildDedupeKey(tx) {
  // Normalize both directions so A→B and B→A produce the same key
  const accA = _dn.normalizeAccountNo(tx.from_account_no || '');
  const accB = _dn.normalizeAccountNo(tx.to_account_no   || '');
  const bnkA = _dn.normalizeBankCode(tx.from_bank_code  || '');
  const bnkB = _dn.normalizeBankCode(tx.to_bank_code    || '');
  const amt  = _dn.normalizeAmount  (tx.amount).toFixed(2);
  const dt   = (tx.tx_datetime || '').slice(0, 16);   // up to minute

  // Sort account pair so direction doesn't matter
  const [pairA, pairB] = [bnkA+'|'+accA, bnkB+'|'+accB].sort();
  const payload = [dt, amt, pairA, pairB].join('||');
  return sha256(payload);
}

// ─── Build dedupe keys for all transactions ───────────────────
async function assignDedupeKeys(transactions) {
  for (const tx of transactions) {
    tx.dedupe_key = await buildDedupeKey(tx);
  }
  return transactions;
}

// ─── Detect exact duplicates (same dedupe_key) ────────────────
function findExactDuplicates(transactions) {
  const groups = {}; // key → [tx, ...]
  for (const tx of transactions) {
    if (!tx.dedupe_key) continue;
    if (!groups[tx.dedupe_key]) groups[tx.dedupe_key] = [];
    groups[tx.dedupe_key].push(tx);
  }

  const dupGroups = Object.entries(groups).filter(([, arr]) => arr.length > 1);
  return dupGroups;
}

// ─── Detect possible duplicates (time window ≤ 60 s, same amount + one party) ──
function findPossibleDuplicates(transactions, windowMs = 60000) {
  const possibles = [];
  const checked   = new Set();

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i], b = transactions[j];
      if (a.dedupe_key === b.dedupe_key) continue; // already exact
      const pairKey = [a.txid, b.txid].sort().join('|');
      if (checked.has(pairKey)) continue;

      const dtA = _dn.dateTimeToMs(a.tx_datetime);
      const dtB = _dn.dateTimeToMs(b.tx_datetime);
      if (!dtA || !dtB) continue;
      const timeDiff = Math.abs(dtA - dtB);
      if (timeDiff > windowMs) continue;

      const amtMatch = Math.abs(_dn.normalizeAmount(a.amount) - _dn.normalizeAmount(b.amount)) < 0.01;
      if (!amtMatch) continue;

      // At least one account number in common
      const accsA = [_dn.normalizeAccountNo(a.from_account_no), _dn.normalizeAccountNo(a.to_account_no)].filter(Boolean);
      const accsB = [_dn.normalizeAccountNo(b.from_account_no), _dn.normalizeAccountNo(b.to_account_no)].filter(Boolean);
      const hasCommon = accsA.some(ac => accsB.includes(ac));
      if (!hasCommon) continue;

      const confidence = Math.max(0.5, 1 - timeDiff / windowMs);
      checked.add(pairKey);
      possibles.push({ txidA: a.txid, txidB: b.txid, timeDiffMs: timeDiff, confidence });
    }
  }
  return possibles;
}

// ─── Apply duplicate flags to transaction list ────────────────
function applyDuplicateFlags(transactions, exactGroups, possibles) {
  const txMap = {};
  transactions.forEach(tx => txMap[tx.txid] = tx);

  let groupCounter = 0;
  // Exact duplicates
  for (const [, group] of exactGroups) {
    groupCounter++;
    const groupId = 'DG-' + String(groupCounter).padStart(4,'0');
    group.forEach((tx, idx) => {
      tx.duplicate_group_id  = groupId;
      tx.duplicate_status    = idx === 0 ? 'MASTER' : 'DUPLICATE';
      tx.confidence_score    = 1;
    });
  }

  // Possible duplicates (only if not already flagged)
  for (const p of possibles) {
    const a = txMap[p.txidA], b = txMap[p.txidB];
    if (!a || !b) continue;
    if (a.duplicate_status !== 'UNIQUE' || b.duplicate_status !== 'UNIQUE') continue;
    groupCounter++;
    const groupId = 'PDG-' + String(groupCounter).padStart(4,'0');
    a.duplicate_group_id = b.duplicate_group_id = groupId;
    a.duplicate_status   = b.duplicate_status   = 'POSSIBLE_DUPLICATE';
    a.confidence_score   = b.confidence_score   = p.confidence;
    a.review_flag        = b.review_flag        = true;
    a.review_reason      = b.review_reason      = `Time diff: ${p.timeDiffMs}ms, same amount`;
  }

  return transactions;
}

// ─── Full pipeline: assign keys + flag duplicates ─────────────
async function runDedupe(transactions) {
  await assignDedupeKeys(transactions);
  const exactGroups = findExactDuplicates(transactions);
  const possibles   = findPossibleDuplicates(transactions);
  applyDuplicateFlags(transactions, exactGroups, possibles);

  const stats = {
    total:    transactions.length,
    unique:   transactions.filter(t => t.duplicate_status === 'UNIQUE').length,
    master:   transactions.filter(t => t.duplicate_status === 'MASTER').length,
    dupes:    transactions.filter(t => t.duplicate_status === 'DUPLICATE').length,
    possible: transactions.filter(t => t.duplicate_status === 'POSSIBLE_DUPLICATE').length,
    exactGroupCount:    exactGroups.length,
    possibleGroupCount: possibles.length,
  };

  return { transactions, stats };
}

// ─── Merge two transactions (user-confirmed) ──────────────────
async function mergeDuplicate(master, dupe, auditNote) {
  // Keep master data, update status
  master.duplicate_status = 'MASTER';
  dupe.duplicate_status   = 'MERGED';
  dupe.review_flag        = false;
  dupe.review_reason      = auditNote || 'User merged';

  await window.Storage.updateTransaction(master);
  await window.Storage.updateTransaction(dupe);
  await window.Storage.addAudit({
    action:    'MERGE_DUPLICATE',
    master_id: master.txid,
    dupe_id:   dupe.txid,
    note:      auditNote || '',
  });
  return { master, dupe };
}

// ─── Keep Separate (user-confirmed) ──────────────────────────
async function keepSeparate(txA, txB) {
  txA.duplicate_status = txB.duplicate_status = 'UNIQUE';
  txA.duplicate_group_id = txB.duplicate_group_id = '';
  txA.review_flag = txB.review_flag = false;
  txA.review_reason = txB.review_reason = 'User confirmed separate';

  await window.Storage.updateTransaction(txA);
  await window.Storage.updateTransaction(txB);
  await window.Storage.addAudit({
    action: 'KEEP_SEPARATE',
    txid_a: txA.txid,
    txid_b: txB.txid,
  });
}

window.Dedupe = {
  buildDedupeKey, assignDedupeKeys,
  findExactDuplicates, findPossibleDuplicates,
  applyDuplicateFlags, runDedupe,
  mergeDuplicate, keepSeparate,
};

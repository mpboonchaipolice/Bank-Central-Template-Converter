/* =====================================================
   dedupe.js — SHA-256 dedup + fuzzy time-window matching
   Uses from_account_key / to_account_key for comparison
   ===================================================== */

const _dn = window.Normalizer;

// ─── Time window constants (ms) ───────────────────────────────
const WIN_EXACT   =         0;   // same second
const WIN_HIGH    =  60_000;   // ≤ 60 s  → confidence ≥ 0.90 → DUPLICATE
const WIN_MEDIUM  = 300_000;   // ≤ 5 min → confidence 0.70–0.89 → POSSIBLE_DUPLICATE
// > 5 min → no match

// ─── SHA-256 via Web Crypto API ───────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ─── Build exact dedupe key (minute-bucketed datetime) ────────
// Sorting the account pair makes A→B and B→A yield the same key,
// which catches cross-file pairs even when direction is recorded differently.
async function buildDedupeKey(tx) {
  const fromKey = tx.from_account_key
    || _dn.buildAccountKey(tx.from_bank_code || tx.from_bank_abbr || tx.from_bank_name || '', tx.from_account_no || '');
  const toKey   = tx.to_account_key
    || _dn.buildAccountKey(tx.to_bank_code   || tx.to_bank_abbr   || tx.to_bank_name   || '', tx.to_account_no   || '');

  const amt = _dn.normalizeAmount(tx.amount).toFixed(2);
  const dt  = (tx.tx_datetime || '').slice(0, 16); // "2026-01-22T12:14" — minute bucket

  // Sort pair so direction doesn't matter
  const [pA, pB] = [fromKey, toKey].sort();
  const payload  = [dt, amt, pA, pB].join('||');
  return sha256(payload);
}

// ─── Assign dedupe keys to all transactions ───────────────────
async function assignDedupeKeys(transactions) {
  for (const tx of transactions) {
    tx.dedupe_key = await buildDedupeKey(tx);
  }
  return transactions;
}

// ─── Exact duplicate groups (same dedupe_key) ─────────────────
function findExactDuplicates(transactions) {
  const groups = {};
  for (const tx of transactions) {
    if (!tx.dedupe_key) continue;
    if (!groups[tx.dedupe_key]) groups[tx.dedupe_key] = [];
    groups[tx.dedupe_key].push(tx);
  }
  return Object.values(groups).filter(g => g.length > 1);
}

// ─── Fuzzy duplicate pairs (same amount + account keys, nearby time) ──
function findPossibleDuplicates(transactions) {
  const possibles = [];
  const checked   = new Set();

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i], b = transactions[j];

      // Already caught by exact dedup
      if (a.dedupe_key && a.dedupe_key === b.dedupe_key) continue;

      const pairKey = [a.txid, b.txid].sort().join('|');
      if (checked.has(pairKey)) continue;

      // Time check
      const dtA = _dn.dateTimeToMs(a.tx_datetime);
      const dtB = _dn.dateTimeToMs(b.tx_datetime);
      if (!dtA || !dtB) continue;
      const timeDiff = Math.abs(dtA - dtB);
      if (timeDiff > WIN_MEDIUM) continue;   // > 5 min → skip

      // Amount must match within 0.01
      const amtDiff = Math.abs(_dn.normalizeAmount(a.amount) - _dn.normalizeAmount(b.amount));
      if (amtDiff > 0.01) continue;

      // Account key comparison — also handles reversed direction (IN vs OUT)
      const aFrom = a.from_account_key || '';
      const aTo   = a.to_account_key   || '';
      const bFrom = b.from_account_key || '';
      const bTo   = b.to_account_key   || '';

      if (!aFrom || !bFrom) continue;

      const forwardMatch = aFrom === bFrom && aTo === bTo;
      const reverseMatch = aFrom === bTo   && aTo === bFrom;
      if (!forwardMatch && !reverseMatch) continue;

      // Compute confidence
      let confidence;
      if (timeDiff === 0) {
        confidence = 1.00;
      } else if (timeDiff <= WIN_HIGH) {
        // 0–60 s → 0.90 to 0.99
        confidence = +(0.90 + 0.09 * (1 - timeDiff / WIN_HIGH)).toFixed(3);
      } else {
        // 60 s–5 min → 0.70 to 0.89
        confidence = +(0.70 + 0.19 * (1 - (timeDiff - WIN_HIGH) / (WIN_MEDIUM - WIN_HIGH))).toFixed(3);
      }

      checked.add(pairKey);
      possibles.push({ txidA: a.txid, txidB: b.txid, timeDiffMs: timeDiff, confidence, reverseMatch });
    }
  }
  return possibles;
}

// ─── Apply flags to all transactions ─────────────────────────
function applyDuplicateFlags(transactions, exactGroups, possibles) {
  const txMap = {};
  transactions.forEach(tx => txMap[tx.txid] = tx);

  let groupCounter = 0;

  // ── Exact duplicates ──────────────────────────────────────
  for (const group of exactGroups) {
    groupCounter++;
    const groupId = 'DG-' + String(groupCounter).padStart(4,'0');
    group.forEach((tx, idx) => {
      tx.duplicate_group_id = groupId;
      tx.duplicate_status   = idx === 0 ? 'MASTER' : 'DUPLICATE';
      tx.confidence_score   = 1;
      // Exact dups don't need manual review (auto-suppressed in display)
      tx.review_flag        = false;
    });
  }

  // ── Fuzzy / possible duplicates ───────────────────────────
  for (const p of possibles) {
    const a = txMap[p.txidA], b = txMap[p.txidB];
    if (!a || !b) continue;
    if (a.duplicate_status !== 'UNIQUE' || b.duplicate_status !== 'UNIQUE') continue;

    groupCounter++;
    // ≥ 0.90 confidence → treat as DUPLICATE; < 0.90 → POSSIBLE_DUPLICATE
    const isHighConf = p.confidence >= 0.90;
    const groupId    = (isHighConf ? 'DG-' : 'PDG-') + String(groupCounter).padStart(4,'0');

    const reason = [
      `Fuzzy match`,
      `Time diff: ${p.timeDiffMs < 1000 ? p.timeDiffMs+'ms' : Math.round(p.timeDiffMs/1000)+'s'}`,
      `Confidence: ${Math.round(p.confidence*100)}%`,
      p.reverseMatch ? `(direction reversed)` : '',
    ].filter(Boolean).join(' · ');

    a.duplicate_group_id = b.duplicate_group_id = groupId;
    a.duplicate_status   = b.duplicate_status   = isHighConf ? 'DUPLICATE' : 'POSSIBLE_DUPLICATE';
    a.confidence_score   = b.confidence_score   = p.confidence;
    a.review_flag        = b.review_flag        = true;   // all fuzzy matches need review
    a.review_reason      = b.review_reason      = reason;
  }

  return transactions;
}

// ─── Full pipeline ────────────────────────────────────────────
async function runDedupe(transactions) {
  await assignDedupeKeys(transactions);
  const exactGroups = findExactDuplicates(transactions);
  const possibles   = findPossibleDuplicates(transactions);
  applyDuplicateFlags(transactions, exactGroups, possibles);

  const stats = {
    total:              transactions.length,
    unique:             transactions.filter(t => t.duplicate_status === 'UNIQUE').length,
    master:             transactions.filter(t => t.duplicate_status === 'MASTER').length,
    dupes:              transactions.filter(t => t.duplicate_status === 'DUPLICATE').length,
    possible:           transactions.filter(t => t.duplicate_status === 'POSSIBLE_DUPLICATE').length,
    duplicateRows:      transactions.filter(t => ['DUPLICATE','POSSIBLE_DUPLICATE'].includes(t.duplicate_status)).length,
    exactGroupCount:    exactGroups.length,
    possibleGroupCount: possibles.length,
  };

  return { transactions, stats };
}

// ─── Merge duplicate (user confirmed) ────────────────────────
async function mergeDuplicate(master, dupe, auditNote) {
  master.duplicate_status = 'MASTER';
  dupe.duplicate_status   = 'MERGED';
  dupe.review_flag        = false;
  dupe.review_reason      = auditNote || 'User merged';

  await window.Storage.updateTransaction(master);
  await window.Storage.updateTransaction(dupe);
  await window.Storage.addAudit({
    action: 'MERGE_DUPLICATE', master_id: master.txid,
    dupe_id: dupe.txid, note: auditNote || '',
  });
  return { master, dupe };
}

// ─── Keep Separate (user confirmed) ──────────────────────────
async function keepSeparate(txA, txB) {
  txA.duplicate_status = txB.duplicate_status = 'UNIQUE';
  txA.duplicate_group_id = txB.duplicate_group_id = '';
  txA.review_flag = txB.review_flag = false;
  txA.review_reason = txB.review_reason = 'User confirmed separate';

  await window.Storage.updateTransaction(txA);
  await window.Storage.updateTransaction(txB);
  await window.Storage.addAudit({ action: 'KEEP_SEPARATE', txid_a: txA.txid, txid_b: txB.txid });
}

window.Dedupe = {
  buildDedupeKey, assignDedupeKeys,
  findExactDuplicates, findPossibleDuplicates,
  applyDuplicateFlags, runDedupe,
  mergeDuplicate, keepSeparate,
};

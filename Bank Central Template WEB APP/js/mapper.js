/* =====================================================
   mapper.js — column auto-suggest + mapping helpers
   ===================================================== */

// ─── Jaccard trigram similarity ───────────────────────────────
function trigramSim(a, b) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9ก-๙]/g, '');
  a = norm(a); b = norm(b);
  if (a === b) return 1;
  if (a.length < 3 || b.length < 3) return a === b ? 1 : 0;
  const grams = s => { const g = new Set(); for (let i=0; i<s.length-2; i++) g.add(s.slice(i,i+3)); return g; };
  const ga = grams(a), gb = grams(b);
  let shared = 0;
  for (const g of ga) if (gb.has(g)) shared++;
  return shared / (ga.size + gb.size - shared);
}

// ─── Auto-suggest mapping for a list of source headers ────────
function autoSuggestAll(sourceHeaders) {
  const { suggestMapping, CANONICAL_FIELDS } = window.TemplateRegistry;

  return sourceHeaders.map(header => {
    // 1. Try exact synonym dict
    const exact = suggestMapping(header);
    if (exact.confidence >= 0.9) return { header, ...exact };

    // 2. Try trigram similarity against canonical field labels + ids
    let bestField = '_ignore', bestScore = 0;
    for (const cf of CANONICAL_FIELDS) {
      const scoreLabel = trigramSim(header, cf.label);
      const scoreId    = trigramSim(header, cf.id.replace(/_/g,' '));
      const score      = Math.max(scoreLabel, scoreId);
      if (score > bestScore) { bestScore = score; bestField = cf.id; }
    }

    if (bestScore >= 0.55) return { header, field: bestField, confidence: bestScore };

    // 3. Fallback to synonym partial
    if (exact.field !== '_ignore') return { header, ...exact };

    return { header, field: '_ignore', confidence: 0 };
  });
}

// ─── Build a mapping object from user selections ──────────────
function buildMapping(suggestions) {
  // suggestions: [{ header, field }]
  const mapping = {};
  for (const s of suggestions) {
    if (s.field && s.field !== '_ignore') mapping[s.header] = s.field;
  }
  return mapping;
}

// ─── Validate a mapping: check required fields are covered ────
const REQUIRED_CANONICAL = ['tx_date', 'raw_deposit', 'raw_withdrawal'];
const RECOMMENDED_CANONICAL = ['tx_time', 'balance', 'transaction_ref'];

function validateMapping(mapping) {
  const covered = new Set(Object.values(mapping));
  const missing  = REQUIRED_CANONICAL.filter(f => !covered.has(f));
  const warnings = RECOMMENDED_CANONICAL.filter(f => !covered.has(f));
  return {
    valid: missing.length === 0,
    missing,
    warnings,
    coveredCount: covered.size,
  };
}

// ─── Export mapping template JSON ────────────────────────────
function exportMappingTemplate(template) {
  return JSON.stringify(template, null, 2);
}

// ─── Import mapping template from JSON string ─────────────────
function importMappingTemplate(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr);
    if (!obj.name || !obj.column_mapping)
      throw new Error('Invalid template: missing name or column_mapping');
    return { ok: true, template: obj };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

window.Mapper = {
  autoSuggestAll,
  buildMapping,
  validateMapping,
  exportMappingTemplate,
  importMappingTemplate,
  trigramSim,
};

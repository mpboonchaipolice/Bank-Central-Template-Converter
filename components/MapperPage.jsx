/* components/MapperPage.jsx — Template Mapper UI */
/* Exposes: MapperPage */

const { useState, useEffect, useRef } = React;

const MapperPage = ({ pendingFile, onMappingSaved, onSkip }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [templateName, setTemplateName] = useState('');
  const [headerRow, setHeaderRow]       = useState(1);
  const [sampleRows, setSampleRows]     = useState([]);
  const [saving, setSaving]             = useState(false);
  const [importJson, setImportJson]     = useState('');
  const [showImport, setShowImport]     = useState(false);
  const [previewRows, setPreviewRows]   = useState([]);
  const toast = useToast();

  const { CANONICAL_FIELDS } = window.TemplateRegistry;

  useEffect(() => {
    if (!pendingFile) return;
    init();
  }, [pendingFile]);

  async function init() {
    const parsed = pendingFile;
    const suggested = window.Mapper.autoSuggestAll(parsed.headers);
    setSuggestions(suggested);
    setSampleRows(window.Parser.getSampleRows(parsed, 5));
    setTemplateName('');
    setHeaderRow((parsed.headerRowIdx || 0) + 1);
  }

  function updateField(header, field) {
    setSuggestions(s => s.map(x => x.header === header ? { ...x, field } : x));
  }

  function getConfClass(conf) {
    if (conf >= 0.9) return 'conf-high';
    if (conf >= 0.5) return 'conf-medium';
    return 'conf-low';
  }

  async function handleSave() {
    if (!templateName.trim()) { toast('กรุณาตั้งชื่อ Template', 'error'); return; }
    const validation = window.Mapper.validateMapping(
      window.Mapper.buildMapping(suggestions)
    );
    if (!validation.valid) {
      toast(`ยังขาด field สำคัญ: ${validation.missing.join(', ')}`, 'error');
      return;
    }
    setSaving(true);
    const tpl = {
      name: templateName.trim(),
      version: '1.0',
      builtin: false,
      created_at: new Date().toISOString(),
      header_row: headerRow,
      title_rows: [],
      signature_headers: suggestions.filter(s => s.confidence >= 0.9).map(s => s.header).slice(0, 8),
      column_mapping: window.Mapper.buildMapping(suggestions),
    };
    await window.Storage.saveTemplate(tpl);
    await window.Storage.addAudit({ action: 'SAVE_TEMPLATE', template: tpl.name });
    toast(`บันทึก Template "${tpl.name}" แล้ว`, 'success');
    setSaving(false);
    onMappingSaved(tpl);
  }

  function handleAutoAll() {
    const re = window.Mapper.autoSuggestAll(suggestions.map(s => s.header));
    setSuggestions(re);
    toast('Auto-suggest ทุกคอลัมน์แล้ว', 'info');
  }

  function buildPreview() {
    if (!sampleRows.length) return;
    const mapping = window.Mapper.buildMapping(suggestions);
    const tpl = { name: templateName||'Preview', column_mapping: mapping, header_row: headerRow, title_rows: [] };
    const mapped = window.Parser.applyMapping(pendingFile, tpl);
    const converted = window.Converter.convertRows(mapped.slice(0,5), 'PREVIEW');
    setPreviewRows(converted);
    toast('Preview แล้ว', 'info');
  }

  function handleImport() {
    const result = window.Mapper.importMappingTemplate(importJson);
    if (!result.ok) { toast('JSON ไม่ถูกต้อง: ' + result.error, 'error'); return; }
    const tpl = result.template;
    setTemplateName(tpl.name);
    const mapped = (pendingFile?.headers || []).map(h => {
      const field = tpl.column_mapping[h] || '_ignore';
      return { header: h, field, confidence: tpl.column_mapping[h] ? 1 : 0 };
    });
    setSuggestions(mapped);
    setShowImport(false);
    toast(`Import Template "${tpl.name}" สำเร็จ`, 'success');
  }

  if (!pendingFile) {
    return (
      <div>
        <Topbar title="🗺️ Template Mapper"/>
        <div className="page-content">
          <EmptyState icon="🗺️" title="ไม่มีไฟล์รอ Mapping"
            sub="ไปที่ Detection แล้วกด Open Mapper สำหรับไฟล์ที่ยังไม่รู้จัก"/>
        </div>
      </div>
    );
  }

  const validation = window.Mapper.validateMapping(window.Mapper.buildMapping(suggestions));

  return (
    <div>
      <Topbar title="🗺️ Template Mapper">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>
          <Icon name="dl" size={12}/> Import JSON
        </button>
        <button className="btn btn-ghost btn-sm" onClick={handleAutoAll}>
          <Icon name="refresh" size={12}/> Auto-Suggest All
        </button>
        <button className="btn btn-ghost btn-sm" onClick={buildPreview}>
          <Icon name="eye" size={12}/> Preview
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : <><Icon name="check" size={12}/> Save Template</>}
        </button>
        {onSkip && (
          <button className="btn btn-ghost btn-sm" onClick={onSkip}>Skip</button>
        )}
      </Topbar>

      <div className="page-content">
        {/* File info + template name */}
        <div className="grid-2 mb-16" style={{gap:12}}>
          <div className="card">
            <div className="card-title">Source File</div>
            <div className="text-sm fw-700">{pendingFile.fileName}</div>
            <div className="text-xs text-muted mt-4">
              {pendingFile.totalDataRows} data rows · {pendingFile.headers.length} columns ·
              Header row: {headerRow}
            </div>
            {pendingFile.ownerAccount && (
              <div className="text-xs mt-4" style={{color:'var(--cyan)'}}>
                Owner Account: <span className="mono">{pendingFile.ownerAccount}</span>
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-title">Template Settings</div>
            <div className="flex" style={{flexDirection:'column',gap:8}}>
              <input className="form-input" placeholder="Template name (e.g. MyBank CIB)"
                value={templateName} onChange={e => setTemplateName(e.target.value)}/>
              <div className="flex items-center gap-8">
                <span className="text-xs text-muted">Header Row:</span>
                <input className="form-input" type="number" min={1} max={20}
                  value={headerRow} onChange={e=>setHeaderRow(+e.target.value)}
                  style={{width:70}}/>
                {!validation.valid
                  ? <span className="badge badge-warn ml-auto">ขาด: {validation.missing.join(', ')}</span>
                  : <span className="badge badge-ok ml-auto">✓ Ready</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Mapping table */}
        <div className="card">
          <div className="card-title">Column Mapping
            <span className="text-xs text-muted fw-700 ml-auto" style={{fontWeight:400,textTransform:'none'}}>
              {' '}· {suggestions.filter(s=>s.field!=='_ignore').length}/{suggestions.length} mapped
            </span>
          </div>

          {/* Header */}
          <div className="mapper-row" style={{borderBottom:'2px solid var(--border2)',paddingBottom:8,marginBottom:4}}>
            <span className="text-xs fw-700 text-muted" style={{textTransform:'uppercase',letterSpacing:.5}}>Source Column</span>
            <span/>
            <span className="text-xs fw-700 text-muted" style={{textTransform:'uppercase',letterSpacing:.5}}>Canonical Field</span>
            <span className="text-xs fw-700 text-muted" style={{textTransform:'uppercase',letterSpacing:.5}}>Confidence</span>
          </div>

          <div style={{maxHeight:480, overflowY:'auto'}}>
            {suggestions.map((s, i) => {
              const sample = sampleRows.map(r => r[s.header]).filter(Boolean).slice(0,2).join(' / ');
              return (
                <div key={s.header} className="mapper-row">
                  <div>
                    <div className="source-col">{s.header}</div>
                    {sample && <div className="source-sample">{sample}</div>}
                  </div>
                  <span className="arrow">→</span>
                  <select className="form-select w-full"
                    value={s.field}
                    onChange={e => updateField(s.header, e.target.value)}>
                    {CANONICAL_FIELDS.map(cf => (
                      <option key={cf.id} value={cf.id}>[{cf.cat}] {cf.label}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-4 text-xs">
                    {s.confidence > 0 && (
                      <>
                        <span className={`confidence-dot ${getConfClass(s.confidence)}`}/>
                        {Math.round(s.confidence*100)}%
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview */}
        {previewRows.length > 0 && (
          <div className="card mt-16">
            <div className="card-title">Preview (first 5 rows converted)</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {['tx_date','tx_time','tx_type','tx_direction','amount','balance',
                      'from_account_no','to_account_no','transaction_ref'].map(c => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r,i) => (
                    <tr key={i}>
                      <td>{r.tx_date}</td>
                      <td>{r.tx_time}</td>
                      <td>{r.tx_type}</td>
                      <td><DirBadge dir={r.tx_direction}/></td>
                      <td className="mono text-green">{Number(r.amount).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
                      <td className="mono">{Number(r.balance).toLocaleString('th-TH',{minimumFractionDigits:2})}</td>
                      <td className="mono text-xs">{r.from_account_no||'—'}</td>
                      <td className="mono text-xs">{r.to_account_no||'—'}</td>
                      <td className="mono text-xs truncate" style={{maxWidth:180}}>{r.transaction_ref||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Import JSON modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Template JSON">
        <div className="form-group">
          <label className="form-label">Paste Template JSON</label>
          <textarea className="form-input" rows={10} style={{fontFamily:'var(--mono)',fontSize:11,resize:'vertical'}}
            value={importJson} onChange={e => setImportJson(e.target.value)}
            placeholder={'{\n  "name": "...",\n  "column_mapping": {...}\n}'}/>
        </div>
        <div className="flex gap-8 mt-16">
          <button className="btn btn-primary" onClick={handleImport}>Import</button>
          <button className="btn btn-ghost" onClick={() => setShowImport(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
};

Object.assign(window, { MapperPage });

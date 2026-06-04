/* components/Pages.jsx — UploadPage, DetectionPage, ExportPage, OwnerAccountModal */
const { useState, useRef, useEffect } = React;

// ═══════════════════════════════════════════════════════
//  OWNER ACCOUNT MODAL
// ═══════════════════════════════════════════════════════
const OwnerAccountModal = ({ open, onClose, fileName, initial = {}, onSave }) => {
  const N = window.Normalizer;
  const [form, setForm] = useState({
    ownerBankCode:         initial.ownerBankCode         || '',
    ownerBankAbbr:         initial.ownerBankAbbr         || '',
    ownerAccountOriginal:  initial.ownerAccountOriginal  || '',
    ownerAccountNormalized:initial.ownerAccountNormalized|| '',
    ownerAccountName:      initial.ownerAccountName      || '',
    ownerBranchName:       initial.ownerBranchName       || '',
  });

  useEffect(() => {
    if (open) setForm({
      ownerBankCode:         initial.ownerBankCode         || '',
      ownerBankAbbr:         initial.ownerBankAbbr         || '',
      ownerAccountOriginal:  initial.ownerAccountOriginal  || '',
      ownerAccountNormalized:initial.ownerAccountNormalized|| '',
      ownerAccountName:      initial.ownerAccountName      || '',
      ownerBranchName:       initial.ownerBranchName       || '',
    });
  }, [open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Auto-fill: when bank code changes, compute abbr; when acc original changes, normalize
  const onBankCodeChange = v => {
    const abbr = N.normalizeBankCode(v);
    set('ownerBankCode', v);
    if (abbr && abbr !== v) set('ownerBankAbbr', abbr);
  };
  const onAccOriginalChange = v => {
    set('ownerAccountOriginal', v);
    set('ownerAccountNormalized', N.normalizeAccountNo(v));
  };

  const preview = N.buildAccountKey(
    form.ownerBankAbbr || form.ownerBankCode || '',
    form.ownerAccountNormalized || form.ownerAccountOriginal || ''
  );

  const handleSave = () => {
    const meta = {
      ...form,
      ownerAccountNormalized: N.normalizeAccountNo(form.ownerAccountOriginal || form.ownerAccountNormalized),
      ownerBankAbbr: N.normalizeBankCode(form.ownerBankCode || form.ownerBankAbbr),
      ownerAccountKey: preview,
      confirmed: true,
    };
    onSave(meta);
    onClose();
  };

  const BANKS = Object.entries(N.BANK_REGISTRY || {})
    .map(([code, info]) => ({ code, abbr: info.abbr, name: info.nameTH }))
    .sort((a,b) => a.abbr.localeCompare(b.abbr));

  return (
    <Modal open={open} onClose={onClose} title="📋 กำหนดบัญชีเจ้าของไฟล์" width={520}>
      <div className="text-xs text-muted mb-16" style={{wordBreak:'break-all'}}>
        ไฟล์: <strong>{fileName}</strong>
      </div>

      {preview && (
        <div className="mb-16" style={{background:'var(--accent-bg)',borderRadius:6,padding:'10px 14px',
          border:'1px solid rgba(59,130,246,.2)',display:'flex',alignItems:'center',gap:10}}>
          <span className="text-xs text-muted">Account Key:</span>
          <span className="mono fw-700 text-accent">{preview}</span>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="form-group">
          <label className="form-label">ธนาคาร</label>
          <select className="form-select w-full"
            value={form.ownerBankCode}
            onChange={e => onBankCodeChange(e.target.value)}>
            <option value="">— เลือกธนาคาร —</option>
            {BANKS.map(b => (
              <option key={b.code} value={b.code}>{b.abbr} — {b.name} ({b.code})</option>
            ))}
          </select>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">หมายเลขบัญชี (ต้นฉบับ)</label>
            <input className="form-input mono" placeholder="224-3-92441-6"
              value={form.ownerAccountOriginal}
              onChange={e => onAccOriginalChange(e.target.value)}/>
          </div>
          <div className="form-group">
            <label className="form-label">หมายเลขบัญชี (Normalized)</label>
            <input className="form-input mono" readOnly
              value={form.ownerAccountNormalized}
              style={{opacity:.7}}/>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">ชื่อบัญชี</label>
          <input className="form-input" placeholder="น.ส. นิตยา บึงรัตน์"
            value={form.ownerAccountName}
            onChange={e => set('ownerAccountName', e.target.value)}/>
        </div>

        <div className="form-group">
          <label className="form-label">สาขา (ถ้ามี)</label>
          <input className="form-input" placeholder="หนองบัวลำภู"
            value={form.ownerBranchName}
            onChange={e => set('ownerBranchName', e.target.value)}/>
        </div>
      </div>

      <div className="flex gap-8 mt-16">
        <button className="btn btn-primary" onClick={handleSave}
          disabled={!form.ownerBankCode || !form.ownerAccountOriginal}>
          <Icon name="check" size={13}/> บันทึก
        </button>
        <button className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
      </div>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════
//  UPLOAD PAGE
// ═══════════════════════════════════════════════════════
const UploadPage = ({ onFilesReady, existingFiles = [] }) => {
  const [files, setFiles]       = useState(existingFiles);
  const [dragOver, setDragOver] = useState(false);
  const [caseId, setCaseId]     = useState('');
  const inputRef                = useRef();
  const toast                   = useToast();
  const ACCEPT = '.xlsx,.xls,.csv,.tsv,.txt';

  const addFiles = raw => {
    const arr = Array.from(raw).filter(f =>
      ['xlsx','xls','csv','tsv','txt'].includes(f.name.split('.').pop().toLowerCase())
    );
    if (!arr.length) { toast('ไม่รองรับไฟล์ประเภทนี้ ใช้ .xlsx .csv .tsv', 'error'); return; }
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
  };

  const onDrop = e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); };
  const removeFile = name => setFiles(f => f.filter(x => x.name !== name));
  const ext2icon = name => ['xlsx','xls'].includes(name.split('.').pop().toLowerCase()) ? '📗' : '📄';
  const fmt = b => b > 1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';

  const handleProcess = () => {
    if (!files.length) { toast('กรุณาเลือกไฟล์ก่อน', 'error'); return; }
    onFilesReady(files, caseId.trim() || ('CASE-'+Date.now().toString(36).toUpperCase()));
  };

  return (
    <div>
      <Topbar title="📁 Upload Files">
        <button className="btn btn-primary" onClick={handleProcess} disabled={!files.length}>
          <Icon name="scan" size={14}/> Process {files.length > 0 ? `(${files.length})` : ''} Files
        </button>
      </Topbar>
      <div className="page-content">
        <div className="card mb-16">
          <div className="card-title">Case Setup</div>
          <div className="form-group" style={{maxWidth:360}}>
            <label className="form-label">Case ID (optional)</label>
            <input className="form-input" placeholder="e.g. CASE-2026-001"
              value={caseId} onChange={e => setCaseId(e.target.value)}/>
            <span className="text-xs text-muted">ถ้าไม่ระบุ ระบบจะสร้างให้อัตโนมัติ</span>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Drop Bank Statement Files</div>
          <div className={`dropzone${dragOver?' drag-over':''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
            <div className="dropzone-icon">🏦</div>
            <h3>Drag & Drop files here</h3>
            <p>รองรับ .xlsx, .xls, .csv, .tsv · เลือกหลายไฟล์พร้อมกันได้</p>
            <p className="mt-8 text-xs text-muted">KBank CIB · Prasan Template04 · และ Template อื่นๆ</p>
            <input ref={inputRef} type="file" multiple accept={ACCEPT}
              style={{display:'none'}} onChange={e => addFiles(e.target.files)}/>
          </div>

          {files.length > 0 && (
            <div className="file-list">
              {files.map(f => (
                <div key={f.name} className="file-item">
                  <span className="file-icon">{ext2icon(f.name)}</span>
                  <div className="file-info">
                    <div className="file-name">{f.name}</div>
                    <div className="file-meta">{fmt(f.size)} · {f.name.split('.').pop().toUpperCase()}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeFile(f.name)}>
                    <Icon name="x" size={12}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card mt-16" style={{borderColor:'rgba(59,130,246,.2)',background:'var(--accent-bg)'}}>
          <div className="card-title" style={{color:'var(--accent-h)'}}>💡 Tips</div>
          <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:6}}>
            {[
              'สามารถอัปโหลดไฟล์จากหลายบัญชีพร้อมกัน ระบบจะตรวจ Duplicate ให้อัตโนมัติ',
              'หลัง detect แล้ว กำหนด "บัญชีเจ้าของไฟล์" ให้ถูกต้อง เพื่อให้ระบบจับ duplicate แม่นขึ้น',
              'ถ้า Template ไม่รู้จัก จะเปิดหน้า Mapper ให้กำหนด mapping เอง',
              'ข้อมูลต้นฉบับจะถูกเก็บไว้ใน raw_json เสมอ ไม่มีการแก้ไขไฟล์ต้นฉบับ',
            ].map((t,i) => (
              <li key={i} className="text-sm" style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{color:'var(--accent)',marginTop:2}}>›</span> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
//  DETECTION PAGE
// ═══════════════════════════════════════════════════════
const DetectionPage = ({ detectionResults = [], onOpenMapper, onProcessAll,
                         isProcessing, progress, onUpdateOwnerMeta }) => {
  const [editingIdx, setEditingIdx] = useState(null);
  const known   = detectionResults.filter(r => r.template);
  const unknown = detectionResults.filter(r => !r.template);

  const editingResult = editingIdx !== null ? detectionResults[editingIdx] : null;

  return (
    <div>
      <Topbar title="🔍 Template Detection">
        {detectionResults.length > 0 && (
          <button className="btn btn-primary" onClick={onProcessAll} disabled={isProcessing}>
            {isProcessing
              ? <><Icon name="refresh" size={14}/> Processing…</>
              : <><Icon name="table" size={14}/> Convert All ({known.length} files)</>}
          </button>
        )}
      </Topbar>
      <div className="page-content">
        {isProcessing && (
          <div className="card mb-16">
            <div className="flex items-center gap-12 mb-16">
              <span className="text-sm fw-700">กำลังแปลงข้อมูล…</span>
              <span className="text-sm text-muted ml-auto">{progress}%</span>
            </div>
            <div className="progress-wrap"><div className="progress-bar" style={{width:progress+'%'}}/></div>
          </div>
        )}

        {detectionResults.length === 0 ? (
          <EmptyState icon="🔍" title="ยังไม่มีไฟล์" sub="กลับไปที่ Upload เพื่ออัปโหลดไฟล์ก่อน"/>
        ) : (
          <>
            <div className="stats-grid mb-16">
              <StatCard value={detectionResults.length} label="Total Files"/>
              <StatCard value={known.length}            label="Auto Detected" color="var(--green)"/>
              <StatCard value={unknown.length}          label="Need Mapping"  color={unknown.length>0?'var(--amber)':'var(--green)'}/>
              <StatCard value={detectionResults.filter(r=>r.ownerMeta?.confirmed).length} label="Owner Confirmed" color="var(--cyan)"/>
            </div>

            {/* Owner account reminder */}
            {detectionResults.some(r => r.template && !r.ownerMeta?.confirmed) && (
              <div className="card mb-16" style={{borderColor:'rgba(246,173,85,.3)',background:'var(--amber-bg)'}}>
                <div className="flex items-center gap-8">
                  <span>⚠️</span>
                  <span className="text-sm fw-700 text-amber">กรุณากำหนด "บัญชีเจ้าของไฟล์" ก่อน Convert</span>
                </div>
                <p className="text-xs text-muted mt-8">
                  ระบบต้องรู้ว่าไฟล์แต่ละไฟล์เป็นของบัญชีใด เพื่อสร้าง from/to account key ที่ถูกต้อง
                  และทำให้ตรวจรายการซ้ำแม่นยำขึ้น กดปุ่ม <strong>✏️ แก้ไข</strong> ในแต่ละแถว
                </p>
              </div>
            )}

            <div className="card">
              <div className="card-title">Detection Results</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>File</th><th>Rows</th><th>Template</th><th>Confidence</th>
                      <th>Owner Account Key</th><th>Owner Name</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectionResults.map((r, i) => {
                      const meta = r.ownerMeta || {};
                      const key  = meta.ownerAccountKey || '';
                      return (
                        <tr key={i}>
                          <td>
                            <span style={{marginRight:6}}>{r.fileType==='xlsx'?'📗':'📄'}</span>
                            <span className="truncate" style={{maxWidth:200,display:'inline-block'}}>{r.fileName}</span>
                          </td>
                          <td className="mono">{r.totalDataRows || 0}</td>
                          <td>
                            {r.template
                              ? <span className="badge badge-ok">{r.template.name}</span>
                              : <span className="badge badge-warn">Need Mapping</span>}
                          </td>
                          <td>
                            {r.template
                              ? <span style={{color:r.confidence>=0.9?'var(--green)':'var(--amber)'}}>
                                  {Math.round((r.confidence||0)*100)}%
                                </span>
                              : '—'}
                          </td>
                          <td>
                            {key
                              ? <span className={`mono text-xs fw-700 ${meta.confirmed?'text-green':'text-amber'}`}>
                                  {key} {meta.confirmed && '✓'}
                                </span>
                              : <span className="text-xs text-muted">ยังไม่ได้กำหนด</span>}
                          </td>
                          <td className="text-xs">{meta.ownerAccountName || '—'}</td>
                          <td>
                            <div className="flex gap-8">
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditingIdx(i)}>
                                <Icon name="map" size={12}/> ✏️ แก้ไข
                              </button>
                              {!r.template && (
                                <button className="btn btn-ghost btn-sm" onClick={() => onOpenMapper(r)}>
                                  Mapper
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Owner Account Modal */}
      <OwnerAccountModal
        open={editingIdx !== null}
        onClose={() => setEditingIdx(null)}
        fileName={editingResult?.fileName || ''}
        initial={editingResult?.ownerMeta || {}}
        onSave={meta => {
          onUpdateOwnerMeta(editingIdx, meta);
          setEditingIdx(null);
        }}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════
//  EXPORT PAGE
// ═══════════════════════════════════════════════════════
const ExportPage = ({ transactions = [], templates = [] }) => {
  const toast = useToast();
  const [opts, setOpts]         = useState({ excludeDuplicates: false, excludeMerged: true });
  const [caseFilter, setCaseFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [exporting, setExporting] = useState('');

  const summary = window.Exporter.buildSummary(transactions);
  const fmt = n => Number(n).toLocaleString('th-TH', {minimumFractionDigits:2});

  const exportOpts = { ...opts,
    caseId:   caseFilter || undefined,
    dateFrom: dateFrom   || undefined,
    dateTo:   dateTo     || undefined,
  };

  const doExport = async type => {
    if (!transactions.length) { toast('ไม่มีข้อมูลให้ Export', 'error'); return; }
    setExporting(type);
    try {
      if (type==='csv')   window.Exporter.exportCSV  (transactions, exportOpts);
      if (type==='xlsx')  window.Exporter.exportXLSX (transactions, exportOpts);
      if (type==='json')  window.Exporter.exportJSON (transactions, exportOpts);
      if (type==='audit') await window.Exporter.exportAuditLog();
      toast('Export สำเร็จ!', 'success');
    } catch(e) { toast('Export Error: '+e.message, 'error'); }
    setExporting('');
  };

  return (
    <div>
      <Topbar title="⬇️ Export"/>
      <div className="page-content">
        <div className="stats-grid mb-16">
          <StatCard value={summary.totalRows}     label="Total Rows"/>
          <StatCard value={summary.uniqueRows}    label="Unique Tx" color="var(--green)"/>
          <StatCard value={summary.duplicateRows} label="Duplicates" color="var(--red)"/>
          <StatCard value={fmt(summary.totalIn)}  label="Total IN"  color="var(--green)"/>
          <StatCard value={fmt(summary.totalOut)} label="Total OUT" color="var(--red)"/>
          <StatCard value={fmt(summary.netFlow)}  label="Net Flow"
            color={summary.netFlow>=0?'var(--green)':'var(--red)'}/>
        </div>

        <div className="grid-2 gap-16">
          <div className="card">
            <div className="card-title">Export Filters</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="form-group">
                <label className="form-label">Case ID</label>
                <input className="form-input" placeholder="ทุก Case"
                  value={caseFilter} onChange={e=>setCaseFilter(e.target.value)}/>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date From</label>
                  <input className="form-input" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Date To</label>
                  <input className="form-input" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
                </div>
              </div>
              <label className="flex items-center gap-8 text-sm" style={{cursor:'pointer'}}>
                <input type="checkbox" checked={opts.excludeDuplicates}
                  onChange={e=>setOpts(o=>({...o,excludeDuplicates:e.target.checked}))}/>
                ซ่อน Duplicate (เก็บแต่ Master)
              </label>
              <label className="flex items-center gap-8 text-sm" style={{cursor:'pointer'}}>
                <input type="checkbox" checked={opts.excludeMerged}
                  onChange={e=>setOpts(o=>({...o,excludeMerged:e.target.checked}))}/>
                ซ่อน Merged rows
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Export Format</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[
                {type:'csv',  label:'Export CSV',       icon:'📄', desc:'UTF-8 BOM + from/to account key'},
                {type:'xlsx', label:'Export XLSX',      icon:'📗', desc:'Excel พร้อม account key columns'},
                {type:'json', label:'Export JSON',      icon:'📋', desc:'Full canonical JSON'},
                {type:'audit',label:'Export Audit Log', icon:'📜', desc:'ประวัติ Merge/Separate'},
              ].map(e => (
                <button key={e.type} className="btn btn-ghost w-full"
                  style={{justifyContent:'flex-start'}}
                  onClick={() => doExport(e.type)}
                  disabled={exporting===e.type||!transactions.length}>
                  <span style={{fontSize:16,marginRight:4}}>{e.icon}</span>
                  <div style={{textAlign:'left'}}>
                    <div>{e.label}</div>
                    <div className="text-xs text-muted">{e.desc}</div>
                  </div>
                  {exporting===e.type && <span className="ml-auto text-muted text-xs">…</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="card mt-16">
          <div className="card-title">Export Mapping Templates</div>
          {templates.length === 0
            ? <p className="text-muted text-sm">ยังไม่มี Template ที่บันทึกไว้</p>
            : (
              <div className="flex" style={{flexWrap:'wrap',gap:8}}>
                {templates.map(t => (
                  <button key={t.name} className="btn btn-ghost btn-sm"
                    onClick={() => { window.Exporter.exportTemplate(t); toast(`Export "${t.name}" แล้ว`,'success'); }}>
                    <Icon name="dl" size={12}/> {t.name}
                  </button>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { UploadPage, DetectionPage, ExportPage, OwnerAccountModal });

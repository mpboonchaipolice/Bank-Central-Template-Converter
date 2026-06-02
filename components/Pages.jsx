/* components/Pages.jsx — UploadPage, DetectionPage, ExportPage */
/* Exposes: UploadPage, DetectionPage, ExportPage */

const { useState, useRef, useEffect } = React;

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
    const arr = Array.from(raw).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase();
      return ['xlsx','xls','csv','tsv','txt'].includes(ext);
    });
    if (!arr.length) { toast('ไม่รองรับไฟล์ประเภทนี้ ใช้ .xlsx .csv .tsv', 'error'); return; }
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
  };

  const onDrop = e => {
    e.preventDefault(); setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = name => setFiles(f => f.filter(x => x.name !== name));

  const ext2icon = name => {
    const e = name.split('.').pop().toLowerCase();
    return e==='xlsx'||e==='xls' ? '📗' : e==='csv' ? '📄' : '📃';
  };

  const fmt = bytes => bytes > 1048576
    ? (bytes/1048576).toFixed(1)+' MB'
    : (bytes/1024).toFixed(0)+' KB';

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

        {/* Case ID */}
        <div className="card mb-16">
          <div className="card-title">Case Setup</div>
          <div className="form-group" style={{maxWidth:360}}>
            <label className="form-label">Case ID (optional)</label>
            <input className="form-input" placeholder="e.g. CASE-2026-001"
              value={caseId} onChange={e => setCaseId(e.target.value)}/>
            <span className="text-xs text-muted">ถ้าไม่ระบุ ระบบจะสร้างให้อัตโนมัติ</span>
          </div>
        </div>

        {/* Drop zone */}
        <div className="card">
          <div className="card-title">Drop Bank Statement Files</div>
          <div
            className={`dropzone${dragOver?' drag-over':''}`}
            onClick={() => inputRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="dropzone-icon">🏦</div>
            <h3>Drag & Drop files here</h3>
            <p>รองรับ .xlsx, .xls, .csv, .tsv, .txt · เลือกหลายไฟล์พร้อมกันได้</p>
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

        {/* Tips */}
        <div className="card mt-16" style={{borderColor:'rgba(59,130,246,.2)',background:'var(--accent-bg)'}}>
          <div className="card-title" style={{color:'var(--accent-h)'}}>💡 Tips</div>
          <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:6}}>
            {[
              'สามารถอัปโหลดไฟล์จากหลายบัญชีพร้อมกัน ระบบจะตรวจ Duplicate ให้อัตโนมัติ',
              'ไฟล์ KBank CIB จะถูกตรวจจับอัตโนมัติจาก header ภาษาไทย',
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
const DetectionPage = ({ detectionResults = [], onOpenMapper, onProcessAll, isProcessing, progress }) => {
  const known   = detectionResults.filter(r => r.template);
  const unknown = detectionResults.filter(r => !r.template);

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
            </div>

            <div className="card">
              <div className="card-title">Detection Results</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>File</th><th>Rows</th><th>Template</th>
                      <th>Confidence</th><th>Owner Account</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detectionResults.map((r,i) => (
                      <tr key={i}>
                        <td><span style={{marginRight:6}}>{r.fileType==='xlsx'?'📗':'📄'}</span>{r.fileName}</td>
                        <td className="mono">{r.totalDataRows}</td>
                        <td>
                          {r.template
                            ? <span className="badge badge-ok">{r.template.name}</span>
                            : <span className="badge badge-warn">Need Mapping</span>}
                        </td>
                        <td>
                          {r.template ? (
                            <span className="text-sm" style={{color: r.confidence>=0.9?'var(--green)':'var(--amber)'}}>
                              {Math.round(r.confidence*100)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="mono text-xs">{r.ownerAccount || <span className="text-muted">—</span>}</td>
                        <td>
                          {!r.template && (
                            <button className="btn btn-ghost btn-sm" onClick={() => onOpenMapper(r)}>
                              <Icon name="map" size={12}/> Open Mapper
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
//  EXPORT PAGE
// ═══════════════════════════════════════════════════════
const ExportPage = ({ transactions = [], templates = [] }) => {
  const toast = useToast();
  const [opts, setOpts] = useState({ excludeDuplicates: false, excludeMerged: true });
  const [caseFilter, setCaseFilter] = useState('');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [exporting, setExporting]   = useState('');

  const summary = window.Exporter.buildSummary(transactions);
  const fmt = n => Number(n).toLocaleString('th-TH', {minimumFractionDigits:2});

  const exportOpts = { ...opts,
    caseId:   caseFilter || undefined,
    dateFrom: dateFrom   || undefined,
    dateTo:   dateTo     || undefined,
  };

  const doExport = async (type) => {
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

        {/* Summary */}
        <div className="stats-grid mb-16">
          <StatCard value={summary.totalRows}     label="Total Rows"/>
          <StatCard value={summary.uniqueRows}    label="Unique Tx" color="var(--green)"/>
          <StatCard value={summary.duplicateRows} label="Duplicates" color="var(--red)"/>
          <StatCard value={fmt(summary.totalIn)}  label="Total IN"  color="var(--green)"/>
          <StatCard value={fmt(summary.totalOut)} label="Total OUT" color="var(--red)"/>
          <StatCard value={fmt(summary.netFlow)}  label="Net Flow"  color={summary.netFlow>=0?'var(--green)':'var(--red)'}/>
        </div>

        <div className="grid-2 gap-16">
          {/* Filter */}
          <div className="card">
            <div className="card-title">Export Filters</div>
            <div className="flex" style={{flexDirection:'column',gap:12}}>
              <div className="form-group">
                <label className="form-label">Case ID</label>
                <input className="form-input" placeholder="ทุก Case" value={caseFilter} onChange={e=>setCaseFilter(e.target.value)}/>
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

          {/* Export buttons */}
          <div className="card">
            <div className="card-title">Export Format</div>
            <div className="flex" style={{flexDirection:'column',gap:10}}>
              {[
                {type:'csv',  label:'Export CSV',        icon:'📄', desc:'UTF-8 BOM, รองรับ Excel'},
                {type:'xlsx', label:'Export XLSX',       icon:'📗', desc:'Excel Workbook พร้อม style'},
                {type:'json', label:'Export JSON',       icon:'📋', desc:'สำหรับ import ระบบอื่น'},
                {type:'audit',label:'Export Audit Log',  icon:'📜', desc:'ประวัติ Merge/Separate'},
              ].map(e => (
                <button key={e.type} className="btn btn-ghost w-full" style={{justifyContent:'flex-start'}}
                  onClick={() => doExport(e.type)} disabled={exporting===e.type||!transactions.length}>
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

        {/* Template export */}
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

Object.assign(window, { UploadPage, DetectionPage, ExportPage });

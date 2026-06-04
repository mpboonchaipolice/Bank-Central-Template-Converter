/* app.js — Main React App, full pipeline with ownerMeta per file */

const { useState, useEffect, useCallback } = React;

const App = () => {
  const [page, setPage]                   = useState('upload');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [detectionResults, setDetection]  = useState([]);
  const [pendingMapper, setPendingMapper] = useState(null);
  const [transactions, setTransactions]   = useState([]);
  const [templates, setTemplates]         = useState([]);
  const [isProcessing, setProcessing]     = useState(false);
  const [progress, setProgress]           = useState(0);
  const [caseId, setCaseId]               = useState('');
  const toast = useToast();

  // ── Init: load templates + persisted transactions ─────────
  useEffect(() => {
    (async () => {
      try {
        const tpls = await TemplateRegistry.loadAllTemplates();
        setTemplates(tpls);
        const saved = await window.Storage.getAllTransactions();
        if (saved.length) setTransactions(saved);
      } catch (e) { console.error('Init error', e); }
    })();
  }, []);

  // ── Step 1: Files ready from Upload page ──────────────────
  const handleFilesReady = useCallback(async (files, cid) => {
    setCaseId(cid);
    setUploadedFiles(files);
    const tpls = await TemplateRegistry.loadAllTemplates();
    setTemplates(tpls);

    const results = [];
    for (const file of files) {
      try {
        const parsed = await window.Parser.parseFile(file);
        const { template, confidence } = TemplateRegistry.detectTemplate(parsed.headers, tpls);

        // Finalize ownerMeta with template bank code
        const ownerMeta = window.Parser.finalizeOwnerMeta(
          parsed.ownerMeta || {},
          template?.owner_bank_code || ''
        );

        results.push({ ...parsed, template, confidence, ownerMeta });
      } catch (e) {
        toast(`Error parsing ${file.name}: ${e.message}`, 'error');
        results.push({
          fileName: file.name, error: e.message,
          template: null, confidence: 0,
          headers: [], dataRows: [], totalDataRows: 0,
          ownerMeta: { confirmed: false },
        });
      }
    }
    setDetection(results);
    setPage('detection');

    const autoDetected = results.filter(r => r.template).length;
    const needOwner    = results.filter(r => r.template && !results[0].ownerMeta?.ownerAccountNormalized).length;
    toast(`Detected ${autoDetected}/${results.length} templates — กำหนด Owner Account ก่อน Convert`, 'info');
  }, []);

  // ── Update ownerMeta for a specific file ──────────────────
  const handleUpdateOwnerMeta = useCallback((idx, newMeta) => {
    setDetection(prev => {
      const next = [...prev];
      // Re-finalize with template bank code
      const tplBankCode = next[idx]?.template?.owner_bank_code || '';
      const finalized   = window.Parser.finalizeOwnerMeta({ ...newMeta }, tplBankCode);
      next[idx] = { ...next[idx], ownerMeta: { ...finalized, confirmed: true } };
      return next;
    });
    toast('บันทึก Owner Account แล้ว', 'success');
  }, []);

  // ── Step 2: Open mapper for unknown file ──────────────────
  const handleOpenMapper = useCallback((detResult) => {
    setPendingMapper(detResult);
    setPage('mapper');
  }, []);

  // ── Step 3: Mapping saved → re-detect ────────────────────
  const handleMappingSaved = useCallback(async (newTpl) => {
    const tpls = await TemplateRegistry.loadAllTemplates();
    setTemplates(tpls);
    setDetection(prev => prev.map(r => {
      if (r.fileName !== pendingMapper?.fileName) return r;
      const { template, confidence } = TemplateRegistry.detectTemplate(r.headers, tpls);
      const ownerMeta = window.Parser.finalizeOwnerMeta(r.ownerMeta || {}, template?.owner_bank_code || '');
      return { ...r, template, confidence, ownerMeta };
    }));
    setPendingMapper(null);
    setPage('detection');
  }, [pendingMapper]);

  // ── Step 4: Convert all detected files ────────────────────
  const handleProcessAll = useCallback(async () => {
    const known = detectionResults.filter(r => r.template && !r.error);
    if (!known.length) { toast('ไม่มีไฟล์ที่ detect ได้', 'error'); return; }

    // Warn if any file missing owner account
    const noOwner = known.filter(r => !r.ownerMeta?.ownerAccountNormalized);
    if (noOwner.length) {
      toast(`⚠️ ${noOwner.length} ไฟล์ยังไม่ได้กำหนด Owner Account — ระบบจะพยายามอนุมานเอง`, 'info');
    }

    setProcessing(true);
    setProgress(0);
    const allTx = [];

    try {
      for (let i = 0; i < known.length; i++) {
        const result = known[i];
        setProgress(Math.round((i / known.length) * 70));

        // Pass ownerMeta override to applyMapping
        const mapped    = window.Parser.applyMapping(result, result.template, result.ownerMeta);
        const converted = window.Converter.convertRows(mapped, caseId);
        allTx.push(...converted);
      }

      setProgress(75);
      const { transactions: deduped, stats } = await window.Dedupe.runDedupe(allTx);
      setProgress(90);

      await window.Storage.clearTransactions();
      await window.Storage.saveTransactions(deduped);
      setProgress(100);

      setTransactions(deduped);
      await window.Storage.addAudit({
        action: 'PROCESS_FILES', case_id: caseId,
        file_count: known.length, tx_count: deduped.length, stats,
      });

      toast(
        `✓ ${deduped.length} transactions · ${stats.dupes || 0} exact dups · ${stats.possible || 0} possible`,
        'success'
      );
      setPage('transactions');
    } catch (e) {
      toast('Processing error: ' + e.message, 'error');
      console.error(e);
    }
    setProcessing(false);
  }, [detectionResults, caseId]);

  // ── Reload from DB ─────────────────────────────────────────
  const reloadTransactions = useCallback(async () => {
    const saved = await window.Storage.getAllTransactions();
    setTransactions(saved);
  }, []);

  // ── Nav badges ─────────────────────────────────────────────
  const badges = {};
  const needMap = detectionResults.filter(r => !r.template).length;
  if (needMap) badges.mapper = needMap;
  const needOwner = detectionResults.filter(r => r.template && !r.ownerMeta?.confirmed).length;
  if (needOwner) badges.detection = needOwner;
  const needRev = transactions.filter(t => t.review_flag).length;
  if (needRev)  badges.duplicates = needRev;

  // ── Page router ────────────────────────────────────────────
  const renderPage = () => {
    switch (page) {
      case 'upload':
        return <UploadPage onFilesReady={handleFilesReady} existingFiles={uploadedFiles}/>;
      case 'detection':
        return <DetectionPage
          detectionResults={detectionResults}
          onOpenMapper={handleOpenMapper}
          onProcessAll={handleProcessAll}
          isProcessing={isProcessing}
          progress={progress}
          onUpdateOwnerMeta={handleUpdateOwnerMeta}/>;
      case 'mapper':
        return <MapperPage
          pendingFile={pendingMapper}
          onMappingSaved={handleMappingSaved}
          onSkip={() => setPage('detection')}/>;
      case 'transactions':
        return <TransactionsPage transactions={transactions}/>;
      case 'duplicates':
        return <DuplicatePage
          transactions={transactions}
          onTransactionsUpdated={reloadTransactions}/>;
      case 'export':
        return <ExportPage transactions={transactions} templates={templates}/>;
      default:
        return <UploadPage onFilesReady={handleFilesReady}/>;
    }
  };

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} badges={badges}/>
      <main className="main">{renderPage()}</main>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<ToastProvider><App/></ToastProvider>);

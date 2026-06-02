/* app.js — Main React App, orchestrates the full pipeline */

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
  const toast                             = useToast();

  // Load templates + persisted transactions on mount
  useEffect(() => {
    (async () => {
      try {
        const tpls = await TemplateRegistry.loadAllTemplates();
        setTemplates(tpls);
        const saved = await window.Storage.getAllTransactions();
        if (saved.length) setTransactions(saved);
      } catch (e) {
        console.error('Init error', e);
      }
    })();
  }, []);

  // ── Step 1: Files ready from Upload page ──────────────────
  const handleFilesReady = useCallback(async (files, cid) => {
    setCaseId(cid);
    setUploadedFiles(files);
    const tpls = await TemplateRegistry.loadAllTemplates();
    setTemplates(tpls);

    // Parse + detect each file
    const results = [];
    for (const file of files) {
      try {
        const parsed = await window.Parser.parseFile(file);
        const { template, confidence } = TemplateRegistry.detectTemplate(parsed.headers, tpls);
        results.push({ ...parsed, template, confidence });
      } catch (e) {
        toast(`Error parsing ${file.name}: ${e.message}`, 'error');
        results.push({ fileName: file.name, error: e.message, template: null, confidence: 0,
                       headers: [], dataRows: [], totalDataRows: 0 });
      }
    }
    setDetection(results);
    setPage('detection');
    toast(`Detected ${results.filter(r=>r.template).length}/${results.length} templates`, 'info');
  }, []);

  // ── Step 2: Open mapper for unknown file ──────────────────
  const handleOpenMapper = useCallback((detResult) => {
    setPendingMapper(detResult);
    setPage('mapper');
  }, []);

  // ── Step 3: Mapping saved → re-detect that file ───────────
  const handleMappingSaved = useCallback(async (newTpl) => {
    const tpls = await TemplateRegistry.loadAllTemplates();
    setTemplates(tpls);
    // Re-detect all files with updated templates
    setDetection(prev => prev.map(r => {
      if (r.fileName !== pendingMapper?.fileName) return r;
      const { template, confidence } = TemplateRegistry.detectTemplate(r.headers, tpls);
      return { ...r, template, confidence };
    }));
    setPendingMapper(null);
    setPage('detection');
  }, [pendingMapper]);

  // ── Step 4: Process all detected files ────────────────────
  const handleProcessAll = useCallback(async () => {
    const known = detectionResults.filter(r => r.template && !r.error);
    if (!known.length) { toast('ไม่มีไฟล์ที่ detect ได้', 'error'); return; }

    setProcessing(true);
    setProgress(0);
    const allTx = [];

    try {
      for (let i = 0; i < known.length; i++) {
        const result = known[i];
        setProgress(Math.round(((i) / known.length) * 70));
        const mapped    = window.Parser.applyMapping(result, result.template);
        const converted = window.Converter.convertRows(mapped, caseId);
        allTx.push(...converted);
      }

      setProgress(75);
      // Dedupe
      const { transactions: deduped, stats } = await window.Dedupe.runDedupe(allTx);
      setProgress(90);

      // Persist
      await window.Storage.clearTransactions();
      await window.Storage.saveTransactions(deduped);
      setProgress(100);

      setTransactions(deduped);
      await window.Storage.addAudit({
        action: 'PROCESS_FILES',
        case_id: caseId,
        file_count: known.length,
        tx_count: deduped.length,
        stats,
      });

      toast(
        `✓ ${deduped.length} transactions · ${stats.duplicateRows} exact dups · ${stats.possible} possible`,
        'success'
      );
      setPage('transactions');
    } catch (e) {
      toast('Processing error: ' + e.message, 'error');
      console.error(e);
    }
    setProcessing(false);
  }, [detectionResults, caseId]);

  // ── Reload transactions from DB ───────────────────────────
  const reloadTransactions = useCallback(async () => {
    const saved = await window.Storage.getAllTransactions();
    setTransactions(saved);
  }, []);

  // ── Nav badges ────────────────────────────────────────────
  const badges = {};
  const needMap = detectionResults.filter(r => !r.template).length;
  if (needMap)   badges.mapper      = needMap;
  const needRev  = transactions.filter(t => t.review_flag).length;
  if (needRev)   badges.duplicates  = needRev;

  // ── Page router ───────────────────────────────────────────
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
          progress={progress}/>;
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
      <main className="main">
        {renderPage()}
      </main>
    </div>
  );
};

// Mount
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ToastProvider>
    <App/>
  </ToastProvider>
);

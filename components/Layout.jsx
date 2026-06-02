/* components/Layout.jsx — Sidebar, Topbar, Toast */
/* Exposes: Sidebar, Topbar, Toast, useToast, Modal, EmptyState, StatCard */

const { useState, useEffect, useCallback, useRef } = React;

// ─── Icons (inline SVG) ───────────────────────────────────────
const Icon = ({ name, size = 16 }) => {
  const icons = {
    upload:   <path d="M4 16v-4H2L8 4l6 8h-2v4H4zm0 2h8v2H4v-2z" fill="currentColor"/>,
    scan:     <><rect x="3" y="3" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="12" y="3" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="12" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M12 12h5m0 5h-5v-5" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    map:      <><path d="M2 4l5 2 6-3 5 2v13l-5-2-6 3-5-2V4z" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M7 6v13M13 3v13" stroke="currentColor" strokeWidth="1.2"/></>,
    table:    <><rect x="2" y="3" width="20" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M2 9h20M8 9v12M14 9v12" stroke="currentColor" strokeWidth="1.2"/></>,
    dupe:     <><rect x="3" y="7" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M7 7V5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M7 12h8M7 16h5" stroke="currentColor" strokeWidth="1.2"/></>,
    export:   <><path d="M12 3v10m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    db:       <><ellipse cx="12" cy="5" rx="9" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    check:    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>,
    x:        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>,
    info:     <><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></>,
    trash:    <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" fill="none" stroke="currentColor" strokeWidth="1.5"/></>,
    refresh:  <path d="M4 12a8 8 0 018-8 8 8 0 016.9 4M20 12a8 8 0 01-8 8 8 8 0 01-6.9-4M4 12H1m3 0l2-2m-2 2l2 2M20 12h3m-3 0l-2-2m2 2l-2 2" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>,
    eye:      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/></>,
    dl:       <><path d="M12 3v9m0 0l-4-3m4 3l4-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    merge:    <><path d="M8 4v4l-4 4 4 4v4M16 4v4l4 4-4 4v4M8 12h8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/></>,
    plus:     <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>,
    chevron:  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>,
    filter:   <path d="M3 4h18l-7 8.5V20l-4-2v-5.5L3 4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
      {icons[name] || null}
    </svg>
  );
};

// ─── Sidebar ─────────────────────────────────────────────────
const NAV = [
  { id:'upload',      label:'Upload Files',       icon:'upload' },
  { id:'detection',   label:'Template Detection', icon:'scan'   },
  { id:'mapper',      label:'Template Mapper',    icon:'map'    },
  { id:'transactions',label:'Transactions',       icon:'table'  },
  { id:'duplicates',  label:'Duplicate Review',   icon:'dupe'   },
  { id:'export',      label:'Export',             icon:'export' },
];

const Sidebar = ({ page, setPage, badges = {} }) => (
  <aside className="sidebar">
    <div className="sidebar-logo">
      <Icon name="db" size={20}/>
      <span>BankTemplate<br/>Converter</span>
    </div>
    <nav className="sidebar-nav">
      {NAV.map(n => (
        <button key={n.id} className={`nav-item${page===n.id?' active':''}`} onClick={() => setPage(n.id)}>
          <Icon name={n.icon} size={16}/>
          {n.label}
          {badges[n.id] ? <span className="badge">{badges[n.id]}</span> : null}
        </button>
      ))}
    </nav>
    <div className="sidebar-footer" style={{fontSize:10,color:'var(--text-dim)',lineHeight:1.5}}>
      Static Web App · IndexedDB<br/>No server · Free · Thai UTF-8
    </div>
  </aside>
);

// ─── Topbar ───────────────────────────────────────────────────
const Topbar = ({ title, children }) => (
  <div className="topbar">
    <h1>{title}</h1>
    {children}
  </div>
);

// ─── Toast ────────────────────────────────────────────────────
const ToastContext = React.createContext(null);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={add}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon name={t.type==='success'?'check':t.type==='error'?'x':'info'} size={14}/>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const useToast = () => React.useContext(ToastContext);

// ─── Modal ────────────────────────────────────────────────────
const Modal = ({ open, onClose, title, children, width = 560 }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth:width}}>
        <div className="flex items-center gap-12 mb-16">
          <span className="modal-title" style={{margin:0}}>{title}</span>
          <button className="btn btn-ghost btn-sm ml-auto" onClick={onClose}><Icon name="x" size={12}/></button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────
const EmptyState = ({ icon = '📭', title, sub, action }) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <p className="fw-700" style={{fontSize:15,color:'var(--text)'}}>{title}</p>
    {sub && <p className="mt-4">{sub}</p>}
    {action && <div className="mt-16">{action}</div>}
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────
const StatCard = ({ value, label, color = 'var(--text)', sub }) => (
  <div className="stat-card">
    <div className="stat-value" style={{color}}>{value}</div>
    <div className="stat-label">{label}</div>
    {sub && <div className="text-xs text-muted mt-4">{sub}</div>}
  </div>
);

// ─── Dupliicate status badge ──────────────────────────────────
const DupBadge = ({ status }) => {
  const map = {
    UNIQUE:'badge-unique', MASTER:'badge-master',
    DUPLICATE:'badge-duplicate', POSSIBLE_DUPLICATE:'badge-possible',
    MERGED:'badge-merged',
  };
  const labels = {
    UNIQUE:'Unique', MASTER:'Master',
    DUPLICATE:'Duplicate', POSSIBLE_DUPLICATE:'Possible Dup.',
    MERGED:'Merged',
  };
  return <span className={`badge ${map[status]||'badge-unique'}`}>{labels[status]||status}</span>;
};

const DirBadge = ({ dir }) => {
  if (!dir) return <span className="text-muted">—</span>;
  return <span className={`badge badge-${dir.toLowerCase()==='in'?'in':'out'}`}>{dir}</span>;
};

Object.assign(window, {
  Icon, Sidebar, Topbar, ToastProvider, useToast,
  Modal, EmptyState, StatCard, DupBadge, DirBadge,
});

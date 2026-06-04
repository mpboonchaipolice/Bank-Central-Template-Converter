/* components/Transactions.jsx — TransactionsPage + DuplicatePage */
/* v2: displays from_account_key / to_account_key */

const { useState, useMemo } = React;

const fmtAmt = n => n != null && n !== '' ? Number(n).toLocaleString('th-TH', {minimumFractionDigits:2}) : '—';

// ─── Account Key display chip ─────────────────────────────────
const AccKey = ({ accountKey, accountNo, bankAbbr, accountName, dir }) => {
  const key = accountKey || (bankAbbr && accountNo ? `${bankAbbr} ${accountNo}` : accountNo || '');
  if (!key) return <span className="text-muted">—</span>;
  const color = dir === 'from' ? 'var(--red)' : 'var(--green)';
  return (
    <div>
      <span className="mono fw-700 text-xs" style={{color}}>{key}</span>
      {accountName && (
        <div className="text-xs text-muted truncate" style={{maxWidth:180}}>{accountName}</div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
//  TRANSACTIONS PAGE
// ═══════════════════════════════════════════════════════
const TransactionsPage = ({ transactions = [] }) => {
  const [q, setQ]             = useState('');
  const [txType, setTxType]   = useState('');
  const [direction, setDir]   = useState('');
  const [dupStatus, setDup]   = useState('');
  const [dateFrom, setDF]     = useState('');
  const [dateTo, setDT]       = useState('');
  const [expandId, setExpand] = useState(null);
  const [page, setPage]       = useState(1);
  const PAGE_SIZE             = 50;

  const types = useMemo(
    () => [...new Set(transactions.map(t => t.tx_type).filter(Boolean))].sort(),
    [transactions]
  );

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return transactions.filter(t => {
      if (q && ![
        t.from_account_key, t.to_account_key, t.account_pair_key,
        t.from_account_no, t.to_account_no, t.transaction_ref,
        t.from_account_name, t.to_account_name, t.raw_description,
        t.tx_type, t.channel,
      ].some(v => v && String(v).toLowerCase().includes(ql))) return false;
      if (txType    && t.tx_type            !== txType)    return false;
      if (direction && t.tx_direction       !== direction) return false;
      if (dupStatus && t.duplicate_status   !== dupStatus) return false;
      if (dateFrom  && t.tx_date < dateFrom)               return false;
      if (dateTo    && t.tx_date > dateTo)                 return false;
      return true;
    });
  }, [transactions, q, txType, direction, dupStatus, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged      = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const totalIn  = filtered
    .filter(t => t.tx_direction==='IN'  && ['UNIQUE','MASTER'].includes(t.duplicate_status))
    .reduce((s,t) => s+(Number(t.amount)||0), 0);
  const totalOut = filtered
    .filter(t => t.tx_direction==='OUT' && ['UNIQUE','MASTER'].includes(t.duplicate_status))
    .reduce((s,t) => s+(Number(t.amount)||0), 0);

  const reset = () => { setQ(''); setTxType(''); setDir(''); setDup(''); setDF(''); setDT(''); setPage(1); };

  return (
    <div>
      <Topbar title="📊 Transactions">
        <span className="text-sm text-muted">{filtered.length.toLocaleString()} rows</span>
        <span className="text-sm text-green ml-auto">IN: {fmtAmt(totalIn)}</span>
        <span className="text-sm text-red">OUT: {fmtAmt(totalOut)}</span>
      </Topbar>
      <div className="page-content">

        {transactions.length === 0 ? (
          <EmptyState icon="📊" title="ยังไม่มีข้อมูล Transaction"
            sub="กลับไปที่ Detection และกด Convert All ก่อน"/>
        ) : (
          <>
            {/* Filter bar */}
            <div className="filter-bar">
              <Icon name="filter" size={14}/>
              <input className="form-input" placeholder="Search account key / ref / name…"
                value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} style={{minWidth:240}}/>
              <select className="form-select" value={txType}
                onChange={e=>{setTxType(e.target.value);setPage(1);}}>
                <option value="">All Types</option>
                {types.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <select className="form-select" value={direction}
                onChange={e=>{setDir(e.target.value);setPage(1);}}>
                <option value="">All Dir</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
              <select className="form-select" value={dupStatus}
                onChange={e=>{setDup(e.target.value);setPage(1);}}>
                <option value="">All Status</option>
                <option value="UNIQUE">Unique</option>
                <option value="MASTER">Master</option>
                <option value="DUPLICATE">Duplicate</option>
                <option value="POSSIBLE_DUPLICATE">Possible Dup</option>
              </select>
              <input className="form-input" type="date" value={dateFrom}
                onChange={e=>{setDF(e.target.value);setPage(1);}} title="Date from"/>
              <input className="form-input" type="date" value={dateTo}
                onChange={e=>{setDT(e.target.value);setPage(1);}} title="Date to"/>
              <button className="btn btn-ghost btn-sm" onClick={reset}>
                <Icon name="x" size={12}/> Reset
              </button>
            </div>

            {/* Table */}
            <div className="card">
              <div className="table-wrap" style={{maxHeight:'calc(100vh - 340px)'}}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Time</th><th>Type</th><th>Dir</th>
                      <th>Amount</th><th>Balance</th>
                      <th>From Account</th><th>To Account</th>
                      <th>Ref</th><th>Channel</th>
                      <th>Status</th><th>Conf</th><th>File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(tx => [
                      <tr key={tx.txid}
                        onClick={() => setExpand(expandId===tx.txid ? null : tx.txid)}
                        style={{cursor:'pointer', opacity: tx.duplicate_status==='DUPLICATE'?0.5:1}}>
                        <td>{tx.tx_date||'—'}</td>
                        <td className="mono text-xs">{tx.tx_time||'—'}</td>
                        <td><span className="text-xs">{tx.tx_type||'—'}</span></td>
                        <td><DirBadge dir={tx.tx_direction}/></td>
                        <td className={`mono fw-700 ${tx.tx_direction==='IN'?'text-green':tx.tx_direction==='OUT'?'text-red':''}`}>
                          {fmtAmt(tx.amount)}
                        </td>
                        <td className="mono text-xs">{fmtAmt(tx.balance)}</td>
                        <td>
                          <AccKey accountKey={tx.from_account_key}
                            accountNo={tx.from_account_no} bankAbbr={tx.from_bank_abbr}
                            accountName={tx.from_account_name} dir="from"/>
                        </td>
                        <td>
                          <AccKey accountKey={tx.to_account_key}
                            accountNo={tx.to_account_no} bankAbbr={tx.to_bank_abbr}
                            accountName={tx.to_account_name} dir="to"/>
                        </td>
                        <td className="mono text-xs truncate" style={{maxWidth:160}}>{tx.transaction_ref||'—'}</td>
                        <td className="text-xs text-muted">{tx.channel||'—'}</td>
                        <td><DupBadge status={tx.duplicate_status}/></td>
                        <td className="text-xs">
                          {tx.confidence_score < 1
                            ? <span style={{color:'var(--amber)'}}>{Math.round(tx.confidence_score*100)}%</span>
                            : null}
                        </td>
                        <td className="text-xs text-muted truncate" style={{maxWidth:120}}>{tx.source_file_name}</td>
                      </tr>,
                      expandId === tx.txid && (
                        <tr key={tx.txid+'-detail'} className="row-detail">
                          <td colSpan={13}><TxDetail tx={tx}/></td>
                        </tr>
                      )
                    ])}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-8 mt-16" style={{justifyContent:'center'}}>
                  <button className="btn btn-ghost btn-sm"
                    onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>‹</button>
                  <span className="text-sm text-muted">Page {page} / {totalPages}</span>
                  <button className="btn btn-ghost btn-sm"
                    onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}>›</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Transaction detail panel ─────────────────────────────────
const TxDetail = ({ tx }) => {
  const groups = [
    { label:'Core', fields:['txid','dedupe_key','tx_datetime','tx_type','tx_direction','channel'] },
    { label:'From', fields:['from_bank_abbr','from_bank_name','from_account_no','from_account_name','from_account_key'] },
    { label:'To',   fields:['to_bank_abbr','to_bank_name','to_account_no','to_account_name','to_account_key'] },
    { label:'Pair', fields:['account_pair_key'] },
    { label:'Amount', fields:['amount','balance','raw_deposit','raw_withdrawal'] },
    { label:'Refs', fields:['transaction_ref','ref1','ref2','ref3'] },
    { label:'ATM/CDM', fields:['atm_cdm_machine_no','atm_cdm_bank','atm_cdm_location','atm_cdm_sequence_no'] },
    { label:'Staff', fields:['branch_code','teller_id','cheque_no','cheque_bank','cheque_branch'] },
    { label:'Contact', fields:['phone','email','ip_address','latitude','longitude'] },
    { label:'Duplicate', fields:['duplicate_status','duplicate_group_id','confidence_score','review_flag','review_reason'] },
    { label:'Source', fields:['source_file_name','source_template_name','source_row_no','case_id'] },
  ];
  return (
    <div style={{padding:'12px 0',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16}}>
      {groups.map(g => {
        const vals = g.fields.filter(f => tx[f] !== undefined && tx[f] !== '' && tx[f] !== null && tx[f] !== false);
        if (!vals.length) return null;
        return (
          <div key={g.label} style={{background:'var(--surface3)',borderRadius:6,padding:'10px 14px'}}>
            <div style={{fontSize:10,fontWeight:700,color:'var(--text-muted)',textTransform:'uppercase',
                         letterSpacing:.5,marginBottom:8}}>{g.label}</div>
            {vals.map(f => (
              <div key={f} style={{display:'flex',gap:8,marginBottom:4,fontSize:11,alignItems:'flex-start'}}>
                <span style={{color:'var(--text-muted)',minWidth:140,flexShrink:0}}>{f}</span>
                <span className="mono" style={{wordBreak:'break-all',color:
                  f==='from_account_key'?'var(--red)':f==='to_account_key'?'var(--green)':
                  f==='account_pair_key'?'var(--cyan)':'var(--text)'}}>
                  {String(tx[f]).length > 80 ? String(tx[f]).slice(0,80)+'…' : String(tx[f])}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════
//  DUPLICATE REVIEW PAGE
// ═══════════════════════════════════════════════════════
const DuplicatePage = ({ transactions = [], onTransactionsUpdated }) => {
  const toast = useToast();
  const [filter, setFilter] = useState('all');

  const dupGroups = useMemo(() => {
    const groups = {};
    for (const tx of transactions) {
      if (tx.duplicate_status === 'UNIQUE' || tx.duplicate_status === 'MERGED') continue;
      if (!tx.duplicate_group_id) continue;
      if (!groups[tx.duplicate_group_id]) groups[tx.duplicate_group_id] = [];
      groups[tx.duplicate_group_id].push(tx);
    }
    return Object.values(groups);
  }, [transactions]);

  const filtered = useMemo(() => {
    if (filter === 'exact')    return dupGroups.filter(g => g.some(t => t.duplicate_status==='DUPLICATE'));
    if (filter === 'possible') return dupGroups.filter(g => g.every(t => t.duplicate_status==='POSSIBLE_DUPLICATE'));
    if (filter === 'review')   return dupGroups.filter(g => g.some(t => t.review_flag));
    return dupGroups;
  }, [dupGroups, filter]);

  const stats = useMemo(() => ({
    exact:    dupGroups.filter(g => g.some(t => t.duplicate_status==='DUPLICATE')).length,
    possible: dupGroups.filter(g => g.every(t => t.duplicate_status==='POSSIBLE_DUPLICATE')).length,
    review:   transactions.filter(t => t.review_flag).length,
  }), [dupGroups, transactions]);

  const handleMerge = async (master, dupe) => {
    await window.Dedupe.mergeDuplicate(master, dupe, 'User merged from UI');
    toast('Merge สำเร็จ', 'success');
    onTransactionsUpdated();
  };
  const handleSeparate = async (txA, txB) => {
    await window.Dedupe.keepSeparate(txA, txB);
    toast('Keep Separate สำเร็จ', 'success');
    onTransactionsUpdated();
  };

  return (
    <div>
      <Topbar title="🔁 Duplicate Review">
        <span className="text-sm text-muted">{dupGroups.length} groups</span>
      </Topbar>
      <div className="page-content">
        {dupGroups.length === 0 ? (
          <EmptyState icon="✅" title="ไม่พบ Duplicate" sub="ไม่มีรายการซ้ำหรือรายการที่ต้องตรวจสอบ"/>
        ) : (
          <>
            <div className="stats-grid mb-16">
              <StatCard value={dupGroups.length}  label="Total Groups"/>
              <StatCard value={stats.exact}       label="Exact Duplicates" color="var(--red)"/>
              <StatCard value={stats.possible}    label="Possible Dups"    color="var(--amber)"/>
              <StatCard value={stats.review}      label="Need Review"      color="var(--purple)"/>
            </div>
            <div className="flex items-center gap-8 mb-16">
              {[['all','All'],['exact','Exact'],['possible','Possible'],['review','Review']].map(([v,l]) => (
                <button key={v} className={`btn btn-sm ${filter===v?'btn-primary':'btn-ghost'}`}
                  onClick={() => setFilter(v)}>{l}</button>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {filtered.map((group, gi) => (
                <DupGroup key={gi} group={group}
                  onMerge={handleMerge} onSeparate={handleSeparate}/>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Duplicate group card ─────────────────────────────────────
const DupGroup = ({ group, onMerge, onSeparate }) => {
  const [open, setOpen] = useState(true);
  const master    = group.find(t => t.duplicate_status === 'MASTER') || group[0];
  const others    = group.filter(t => t !== master);
  const isPossible = group.every(t => t.duplicate_status === 'POSSIBLE_DUPLICATE');

  return (
    <div className="card" style={{borderColor: isPossible?'rgba(246,173,85,.3)':'rgba(245,101,101,.25)'}}>
      <div className="flex items-center gap-12" style={{cursor:'pointer'}} onClick={() => setOpen(o=>!o)}>
        <span className={`badge ${isPossible?'badge-possible':'badge-duplicate'}`}>
          {isPossible ? '⚠️ Possible' : '🔴 Duplicate'}
        </span>
        <span className="mono text-xs text-muted">{group[0].duplicate_group_id}</span>
        <span className="text-sm">{group.length} transactions</span>
        {group[0].confidence_score < 1 && (
          <span className="text-xs text-amber">
            Confidence: {Math.round(group[0].confidence_score*100)}%
          </span>
        )}
        <span className="text-xs text-muted ml-auto">{group[0].review_reason || ''}</span>
        <Icon name="chevron" size={14}/>
      </div>

      {open && (
        <div className="mt-12">
          {/* Account pair summary */}
          {group[0].account_pair_key && (
            <div className="mb-12" style={{padding:'8px 12px',background:'var(--surface2)',
              borderRadius:6,border:'1px solid var(--border)'}}>
              <span className="text-xs text-muted">Account Pair: </span>
              <span className="mono text-xs fw-700 text-cyan">{group[0].account_pair_key}</span>
            </div>
          )}

          <div className="dup-compare">
            {group.map((tx, i) => (
              <div key={tx.txid} className={`dup-side ${i===0?'master':'dupe'}`}>
                <div className="flex items-center gap-8 mb-8">
                  <DupBadge status={tx.duplicate_status}/>
                  <span className="text-xs text-muted truncate">{tx.source_file_name}</span>
                </div>
                {[
                  ['Date/Time',  tx.tx_datetime],
                  ['Type',       tx.tx_type],
                  ['Direction',  tx.tx_direction],
                  ['Amount',     tx.amount != null ? fmtAmt(tx.amount) : null],
                  ['Balance',    tx.balance > 0 ? fmtAmt(tx.balance) : null],
                  ['From Key',   tx.from_account_key],
                  ['From Name',  tx.from_account_name],
                  ['To Key',     tx.to_account_key],
                  ['To Name',    tx.to_account_name],
                  ['Ref',        tx.transaction_ref],
                  ['TxID',       tx.txid],
                ].map(([l,v]) => v ? (
                  <div key={l} style={{display:'flex',gap:8,marginBottom:4,fontSize:11}}>
                    <span style={{color:'var(--text-muted)',minWidth:80,flexShrink:0}}>{l}</span>
                    <span className="mono" style={{
                      wordBreak:'break-all',
                      color: l==='From Key'?'var(--red)': l==='To Key'?'var(--green)':'var(--text)',
                    }}>{String(v).length > 60 ? String(v).slice(0,60)+'…' : v}</span>
                  </div>
                ) : null)}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-8 mt-12">
            {isPossible ? (
              <>
                <button className="btn btn-success btn-sm"
                  onClick={() => onMerge(master, others[0])}>
                  <Icon name="merge" size={12}/> Confirm Merge
                </button>
                <button className="btn btn-danger btn-sm"
                  onClick={() => onSeparate(group[0], group[1])}>
                  <Icon name="x" size={12}/> Keep Separate
                </button>
              </>
            ) : (
              <span className="text-xs text-muted">
                Exact duplicate — auto-suppressed ·
                <button className="btn btn-ghost btn-sm ml-8"
                  onClick={() => onSeparate(master, others[0])}>
                  Undo / Keep Separate
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { TransactionsPage, DuplicatePage });

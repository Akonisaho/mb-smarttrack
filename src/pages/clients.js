import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchClients, saveClient, deleteClient, fetchFicaRecord, saveFicaRecord, fetchAllFicaRecords, createPortalAccess } from '../lib/supabase';
import NavBar from '../components/NavBar';

function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});}catch{return d||'';} }
function fmtR(n){ return 'R '+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,','); }

const FICA_STATUS = {
  compliant: { label:'Compliant', color:'#8DC63F', bg:'rgba(141,198,63,0.1)' },
  partial:   { label:'Partial',   color:'#EAB308', bg:'rgba(234,179,8,0.1)' },
  pending:   { label:'Pending',   color:'#E07B30', bg:'rgba(224,123,48,0.1)' },
  expired:   { label:'Expired',   color:'#E05252', bg:'rgba(220,80,80,0.1)' },
};

const BLANK_CLIENT = { full_name:'', id_number:'', company_reg:'', email:'', phone:'', address:'', city:'', province:'', postal_code:'', client_type:'individual', notes:'', branch_id:'' };
const BLANK_FICA = { id_verified:false, proof_of_address:false, source_of_funds:false, pep_check:false, id_expiry_date:'', address_doc_date:'', notes:'' };

export default function ClientsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('list');
  const [clients, setClients] = useState([]);
  const [ficaRecords, setFicaRecords] = useState([]);
  const [matters, setMatters] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [trustBalances, setTrustBalances] = useState({});
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [filterFica, setFilterFica] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [form, setForm] = useState(BLANK_CLIENT);
  const [ficaForm, setFicaForm] = useState(BLANK_FICA);
  const [ficaEditId, setFicaEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ msg:'', type:'' });
  const [selClient, setSelClient] = useState(null);
  const [selFica, setSelFica] = useState(null);
  const [showFicaEdit, setShowFicaEdit] = useState(false);
  const [portalMsg, setPortalMsg] = useState('');

  const isMgr = profile?.role==='manager'||profile?.role==='national_manager'||profile?.role==='branch_manager'||profile?.role==='bookkeeper';

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      if (!p) { router.replace('/login'); return; }
      setProfile(p);
      setLoading(false);
    });
  }, []);

  const load = useCallback(async () => {
    if (!profile) return;
    const [cRes, ficaRes, matRes, invRes, brRes, trustRes] = await Promise.all([
      fetchClients({ branchId: (!isMgr && profile.branch_id) ? profile.branch_id : undefined }),
      fetchAllFicaRecords(),
      supabase.from('matters').select('id,name,client,client_id,status,branch_id,user_id').order('created_at', { ascending:false }),
      supabase.from('invoices').select('id,client,client_id,total_units,rate,created_at,user_id').order('created_at', { ascending:false }),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
      supabase.from('trust_transactions').select('matter_id,type,amount,status'),
    ]);
    setClients(cRes.clients || []);
    setFicaRecords(ficaRes.records || []);
    setMatters(matRes.data || []);
    setInvoices(invRes.data || []);
    setBranches(brRes.data || []);
    const bals = {};
    (trustRes.data || []).filter(t => t.status === 'posted').forEach(t => {
      if (!bals[t.matter_id]) bals[t.matter_id] = 0;
      bals[t.matter_id] += t.type === 'receipt' ? Number(t.amount) : -Number(t.amount);
    });
    setTrustBalances(bals);
  }, [profile, isMgr]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  function showMsg(msg, type='success') { setAlert({ msg, type }); setTimeout(() => setAlert({ msg:'', type:'' }), 6000); }

  function openAdd() { setEditClient(null); setForm(BLANK_CLIENT); setShowForm(true); }
  function openEdit(c) { setEditClient(c); setForm({ full_name:c.full_name||'', id_number:c.id_number||'', company_reg:c.company_reg||'', email:c.email||'', phone:c.phone||'', address:c.address||'', city:c.city||'', province:c.province||'', postal_code:c.postal_code||'', client_type:c.client_type||'individual', notes:c.notes||'', branch_id:c.branch_id||'' }); setShowForm(true); }

  async function handleSave() {
    if (!form.full_name) { showMsg('Full name is required.', 'error'); return; }
    setSaving(true);
    const payload = { ...form, branch_id: form.branch_id || profile.branch_id || null };
    if (editClient) payload.id = editClient.id;
    const { error } = await saveClient(payload, profile.id);
    setSaving(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg(editClient ? '✓ Client updated.' : '✓ Client added.');
    setShowForm(false);
    load();
  }

  async function handleDelete(id, name) {
    if (!confirm(`Archive ${name}? They won't be deleted but marked inactive.`)) return;
    const { error } = await deleteClient(id);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg('Client archived.');
    if (selClient?.id === id) setSelClient(null);
    load();
  }

  async function openClientDetail(c) {
    setSelClient(c);
    const { record } = await fetchFicaRecord(c.id);
    setSelFica(record || null);
  }

  async function openFicaEdit(c) {
    const { record } = await fetchFicaRecord(c.id);
    setFicaEditId(record?.id || null);
    setFicaForm(record ? { id_verified:record.id_verified||false, proof_of_address:record.proof_of_address||false, source_of_funds:record.source_of_funds||false, pep_check:record.pep_check||false, id_expiry_date:record.id_expiry_date||'', address_doc_date:record.address_doc_date||'', notes:record.notes||'' } : { ...BLANK_FICA });
    setSelClient(c);
    setShowFicaEdit(true);
  }

  async function saveFica() {
    setSaving(true);
    const allDone = ficaForm.id_verified && ficaForm.proof_of_address;
    const status = allDone ? 'compliant' : (ficaForm.id_verified || ficaForm.proof_of_address) ? 'partial' : 'pending';
    const payload = { ...ficaForm, client_id: selClient.id, fica_status: status };
    if (ficaEditId) payload.id = ficaEditId;
    const { error } = await saveFicaRecord(payload, profile.id);
    setSaving(false);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg('✓ FICA record updated.');
    setShowFicaEdit(false);
    load();
    if (selClient) openClientDetail(selClient);
  }

  async function generatePortalLink(c) {
    setPortalMsg('');
    const { token, error } = await createPortalAccess(c.id, c.email, profile.id);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    const link = `${window.location.origin}/portal?token=${token}`;
    navigator.clipboard?.writeText(link);
    setPortalMsg(link);
    showMsg('✓ Portal link copied to clipboard!');
  }

  const ficaMap = Object.fromEntries(ficaRecords.map(r => [r.client_id, r]));

  function ficaStatus(clientId) {
    const r = ficaMap[clientId];
    if (!r) return 'pending';
    return r.fica_status || 'pending';
  }

  function clientTrust(clientId) {
    const cm = matters.filter(m => m.client_id === clientId);
    return cm.reduce((s, m) => s + (trustBalances[m.id] || 0), 0);
  }

  function clientOutstanding(clientId) {
    const cInv = invoices.filter(i => i.client_id === clientId);
    return cInv.reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150) * 1.15, 0);
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.full_name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.id_number?.includes(q) || c.client_no?.toLowerCase().includes(q);
    const matchFica = filterFica === 'all' || ficaStatus(c.id) === filterFica;
    const matchType = filterType === 'all' || c.client_type === filterType;
    return matchSearch && matchFica && matchType;
  });

  const ficaPending = clients.filter(c => ficaStatus(c.id) === 'pending').length;
  const ficaExpired = clients.filter(c => ficaStatus(c.id) === 'expired').length;

  const C = {
    page:  { background:'#0A0A0A', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#F0F0F0' },
    main:  { maxWidth:1300, margin:'0 auto', padding:'20px 24px' },
    card:  { background:'#111', border:'1px solid #1A1A1A', borderRadius:8, padding:16, marginBottom:14 },
    stat:  (a,w) => ({ background: a?'rgba(141,198,63,0.05)':w?'rgba(234,179,8,0.05)':'#111', border:`1px solid ${a?'rgba(141,198,63,0.25)':w?'rgba(234,179,8,0.25)':'#1A1A1A'}`, borderRadius:8, padding:14 }),
    btn:   (v='s') => ({ background:v==='p'?'#8DC63F':v==='r'?'rgba(220,80,80,0.15)':'transparent', border:v==='p'?'none':v==='r'?'1px solid rgba(220,80,80,0.4)':'1px solid #252525', color:v==='p'?'#0A0A0A':v==='r'?'#E05252':'#888', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:v==='p'?700:500 }),
    sel:   { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'5px 10px', borderRadius:6, fontSize:12, fontFamily:'inherit' },
    th:    { fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em', color:'#444', padding:'9px 10px', borderBottom:'1px solid #181818', textAlign:'left', fontWeight:600 },
    td:    { padding:'9px 10px', fontSize:11, borderBottom:'1px solid #161616', verticalAlign:'middle' },
    ntab:  (on) => ({ background:'transparent', border:`1px solid ${on?'#2A2A2A':'transparent'}`, color:on?'#F0F0F0':'#555', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:on?600:400 }),
  };
  const inp = { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'9px 12px', borderRadius:6, fontSize:12, fontFamily:"'DM Sans',system-ui,sans-serif", width:'100%', boxSizing:'border-box' };
  const lbl = { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4, display:'block' };

  if (loading) return <div style={{...C.page, display:'flex', alignItems:'center', justifyContent:'center', color:'#444', fontSize:13}}>Loading...</div>;

  return (<>
    <Head><title>MB SmartTrack — Clients</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}select option{background:#1A1A1A;color:#F0F0F0}input[type=date]{color-scheme:dark}button:hover{opacity:.85}textarea{resize:vertical}`}</style>
    <div style={C.page}>

      <NavBar
        role={isMgr?'manager':'attorney'}
        tab={null}
        setTab={()=>{}}
        profile={profile}
        onSignOut={async()=>{await signOut();router.replace('/login');}}
        rightSlot={<>
          {[['list','Clients'],['fica','FICA Compliance']].map(([v,l])=>(
            <button key={v} style={C.ntab(tab===v)} onClick={()=>{setTab(v);setSelClient(null);}}>{l}{v==='fica'&&(ficaPending+ficaExpired)>0&&<span style={{marginLeft:6,background:'rgba(234,179,8,0.2)',color:'#EAB308',borderRadius:20,padding:'1px 7px',fontSize:9,fontWeight:700}}>{ficaPending+ficaExpired}</span>}</button>
          ))}
          <button style={C.btn()} onClick={()=>router.back()}>← Back</button>
          <button style={C.btn('p')} onClick={openAdd}>+ New Client</button>
        </>}
      />

      {alert.msg&&<div style={{background:alert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${alert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'12px 24px',fontSize:12,color:alert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between'}}><span>{alert.msg}</span><button style={{background:'none',border:'none',color:'inherit',cursor:'pointer'}} onClick={()=>setAlert({msg:'',type:''})}>✕</button></div>}

      <div style={C.main}>

        {/* STATS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
          {[{l:'Total Clients',v:clients.length,s:'active clients'},{l:'FICA Compliant',v:clients.filter(c=>ficaStatus(c.id)==='compliant').length,s:'fully verified',a:true},{l:'FICA Pending',v:ficaPending,s:'need attention',w:ficaPending>0},{l:'FICA Expired',v:ficaExpired,s:'require renewal',w:ficaExpired>0}].map(({l,v,s,a,w})=>(<div key={l} style={C.stat(a,w)}><div style={{fontSize:9,color:'#555',textTransform:'uppercase',letterSpacing:'.09em',marginBottom:8}}>{l}</div><div style={{fontSize:22,fontWeight:800,marginBottom:4,color:a?'#8DC63F':w?'#EAB308':'#F0F0F0'}}>{v}</div><div style={{fontSize:10,color:'#444'}}>{s}</div></div>))}
        </div>

        {tab==='list'&&!selClient&&(<>
          {/* FILTERS */}
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <input type="text" placeholder="Search name, email, ID, ref..." value={search} onChange={e=>setSearch(e.target.value)} style={{...C.sel,padding:'7px 12px',flex:'1',minWidth:200}}/>
            <select style={C.sel} value={filterFica} onChange={e=>setFilterFica(e.target.value)}><option value="all">All FICA</option>{Object.entries(FICA_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
            <select style={C.sel} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">All types</option><option value="individual">Individual</option><option value="company">Company</option><option value="trust">Trust</option></select>
          </div>

          {/* CLIENT TABLE */}
          <div style={C.card}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Ref','Client','Type','Email / Phone','Matters','Trust','Outstanding','FICA','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {!filtered.length&&<tr><td colSpan={9} style={{...C.td,textAlign:'center',color:'#333',padding:30}}>{search?'No clients match your search.':'No clients yet. Click + New Client to add the first.'}</td></tr>}
                {filtered.map(c=>{
                  const fs=ficaStatus(c.id);const fst=FICA_STATUS[fs];
                  const cMatters=matters.filter(m=>m.client_id===c.id);
                  const trust=clientTrust(c.id);
                  const outstanding=clientOutstanding(c.id);
                  return(<tr key={c.id} style={{cursor:'pointer'}} onClick={()=>openClientDetail(c)}>
                    <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{c.client_no||'—'}</td>
                    <td style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>{c.full_name}<div style={{fontSize:9,color:'#444'}}>{c.id_number||c.company_reg||''}</div></td>
                    <td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:'rgba(74,144,217,0.1)',color:'#4A90D9',textTransform:'capitalize'}}>{c.client_type||'individual'}</span></td>
                    <td style={{...C.td,fontSize:10,color:'#555'}}>{c.email||'—'}<div style={{color:'#444'}}>{c.phone||''}</div></td>
                    <td style={{...C.td,fontFamily:'monospace',textAlign:'center',color:'#777'}}>{cMatters.length}</td>
                    <td style={{...C.td,fontFamily:'monospace',color:trust>0?'#4A90D9':'#333'}}>{trust>0?fmtR(trust):'—'}</td>
                    <td style={{...C.td,fontFamily:'monospace',color:outstanding>0?'#EAB308':'#333'}}>{outstanding>0?fmtR(outstanding):'—'}</td>
                    <td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:fst.bg,color:fst.color,border:`1px solid ${fst.color}44`,fontWeight:600}}>{fst.label}</span></td>
                    <td style={C.td} onClick={e=>e.stopPropagation()}>
                      <div style={{display:'flex',gap:4}}>
                        <button style={{...C.btn(),fontSize:10,padding:'3px 8px'}} onClick={()=>openEdit(c)}>Edit</button>
                        <button style={{...C.btn(),fontSize:10,padding:'3px 8px'}} onClick={()=>openFicaEdit(c)}>FICA</button>
                        <button style={{...C.btn('r'),fontSize:10,padding:'3px 8px'}} onClick={()=>handleDelete(c.id,c.full_name)}>Archive</button>
                      </div>
                    </td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </>)}

        {/* CLIENT DETAIL */}
        {tab==='list'&&selClient&&(<div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
            <button style={C.btn()} onClick={()=>setSelClient(null)}>← All Clients</button>
            <div style={{fontSize:16,fontWeight:700}}>{selClient.full_name}</div>
            {selClient.client_no&&<span style={{fontSize:11,fontFamily:'monospace',color:'#A78BFA'}}>{selClient.client_no}</span>}
            <span style={{fontSize:9,padding:'2px 10px',borderRadius:20,background:FICA_STATUS[ficaStatus(selClient.id)].bg,color:FICA_STATUS[ficaStatus(selClient.id)].color,border:`1px solid ${FICA_STATUS[ficaStatus(selClient.id)].color}44`,fontWeight:600}}>{FICA_STATUS[ficaStatus(selClient.id)].label} FICA</span>
            <div style={{marginLeft:'auto',display:'flex',gap:6}}>
              <button style={C.btn()} onClick={()=>openEdit(selClient)}>Edit</button>
              <button style={C.btn()} onClick={()=>openFicaEdit(selClient)}>Update FICA</button>
              <button style={{...C.btn(),fontSize:11}} onClick={()=>generatePortalLink(selClient)}>🔗 Portal Link</button>
            </div>
          </div>
          {portalMsg&&<div style={{background:'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.3)',borderRadius:6,padding:'10px 14px',fontSize:11,color:'#8DC63F',marginBottom:12,wordBreak:'break-all'}}>{portalMsg}</div>}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Contact Details</div>
              {[['Name',selClient.full_name],['Type',selClient.client_type||'Individual'],['ID / Reg',selClient.id_number||selClient.company_reg||'—'],['Email',selClient.email||'—'],['Phone',selClient.phone||'—'],['Address',selClient.address||'—'],['City',selClient.city||'—'],['Province',selClient.province||'—']].map(([k,v])=>(<div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #161616'}}><span style={{fontSize:10,color:'#555'}}>{k}</span><span style={{fontSize:11,color:'#C8C8C8',textAlign:'right',maxWidth:'60%'}}>{v}</span></div>))}
            </div>
            <div style={C.card}>
              <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>FICA Status</div>
              {selFica ? (<>
                {[['ID Document',selFica.id_verified],['Proof of Address',selFica.proof_of_address],['Source of Funds',selFica.source_of_funds],['PEP Check',selFica.pep_check]].map(([k,v])=>(<div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:'1px solid #161616'}}><span style={{fontSize:11,color:'#888'}}>{k}</span><span style={{fontSize:12,fontWeight:700,color:v?'#8DC63F':'#E05252'}}>{v?'✓ Done':'✗ Pending'}</span></div>))}
                {selFica.id_expiry_date&&<div style={{marginTop:8,fontSize:10,color:'#555'}}>ID expires: <span style={{color:'#EAB308'}}>{fdate(selFica.id_expiry_date)}</span></div>}
                {selFica.notes&&<div style={{marginTop:8,fontSize:11,color:'#666'}}>{selFica.notes}</div>}
              </>):(<div style={{textAlign:'center',padding:20,color:'#555',fontSize:12}}><div style={{fontSize:24,marginBottom:8}}>⚠️</div>No FICA record yet<br/><button style={{...C.btn('p'),marginTop:10,fontSize:11}} onClick={()=>openFicaEdit(selClient)}>Add FICA Record</button></div>)}
            </div>
          </div>

          <div style={C.card}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Matters</div>
            {matters.filter(m=>m.client_id===selClient.id).length===0?<div style={{textAlign:'center',padding:20,color:'#555',fontSize:12}}>No matters linked to this client</div>:
            <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr>{['Matter ID','Name','Status','Trust Balance'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead><tbody>
              {matters.filter(m=>m.client_id===selClient.id).map(m=>(<tr key={m.id}><td style={{...C.td,fontFamily:'monospace',color:'#A78BFA',fontSize:10}}>{m.id}</td><td style={C.td}>{m.name}</td><td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:m.status==='open'?'rgba(141,198,63,0.1)':'rgba(74,144,217,0.1)',color:m.status==='open'?'#8DC63F':'#4A90D9'}}>{m.status||'open'}</span></td><td style={{...C.td,fontFamily:'monospace',color:trustBalances[m.id]>0?'#4A90D9':'#444'}}>{trustBalances[m.id]>0?fmtR(trustBalances[m.id]):'—'}</td></tr>))}
            </tbody></table>}
          </div>
        </div>)}

        {/* FICA TAB */}
        {tab==='fica'&&(<>
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
            <input type="text" placeholder="Search client..." value={search} onChange={e=>setSearch(e.target.value)} style={{...C.sel,padding:'7px 12px',flex:'1',minWidth:200}}/>
            <select style={C.sel} value={filterFica} onChange={e=>setFilterFica(e.target.value)}><option value="all">All statuses</option>{Object.entries(FICA_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
          </div>
          <div style={C.card}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Client','Ref','Type','ID Doc','Proof of Addr','Source of Funds','PEP','FICA Status','Action'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map(c=>{
                  const r=ficaMap[c.id];const fs=ficaStatus(c.id);const fst=FICA_STATUS[fs];
                  const tick=(v)=>v?<span style={{color:'#8DC63F',fontWeight:700}}>✓</span>:<span style={{color:'#E05252'}}>✗</span>;
                  return(<tr key={c.id}>
                    <td style={{...C.td,fontWeight:600,color:'#D0D0D0'}}>{c.full_name}</td>
                    <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{c.client_no||'—'}</td>
                    <td style={{...C.td,fontSize:10,textTransform:'capitalize',color:'#777'}}>{c.client_type||'individual'}</td>
                    <td style={{...C.td,textAlign:'center'}}>{tick(r?.id_verified)}</td>
                    <td style={{...C.td,textAlign:'center'}}>{tick(r?.proof_of_address)}</td>
                    <td style={{...C.td,textAlign:'center'}}>{tick(r?.source_of_funds)}</td>
                    <td style={{...C.td,textAlign:'center'}}>{tick(r?.pep_check)}</td>
                    <td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:fst.bg,color:fst.color,border:`1px solid ${fst.color}44`,fontWeight:600}}>{fst.label}</span></td>
                    <td style={C.td}><button style={{...C.btn(),fontSize:10,padding:'3px 8px'}} onClick={()=>openFicaEdit(c)}>Update</button></td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </>)}
      </div>

      {/* ADD/EDIT CLIENT MODAL */}
      {showForm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowForm(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:560,maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:18}}>{editClient?'Edit Client':'New Client'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div style={{gridColumn:'1/-1'}}><label style={lbl}>Full Name / Company Name *</label><input style={inp} type="text" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))}/></div>
              <div><label style={lbl}>Client Type</label><select style={inp} value={form.client_type} onChange={e=>setForm(f=>({...f,client_type:e.target.value}))}><option value="individual">Individual</option><option value="company">Company</option><option value="trust">Trust</option></select></div>
              <div><label style={lbl}>Branch</label><select style={inp} value={form.branch_id} onChange={e=>setForm(f=>({...f,branch_id:e.target.value}))}><option value="">— Select —</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
              <div><label style={lbl}>SA ID / Passport No.</label><input style={inp} type="text" value={form.id_number} onChange={e=>setForm(f=>({...f,id_number:e.target.value}))}/></div>
              <div><label style={lbl}>Company Reg No.</label><input style={inp} type="text" value={form.company_reg} onChange={e=>setForm(f=>({...f,company_reg:e.target.value}))}/></div>
              <div><label style={lbl}>Email</label><input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
              <div><label style={lbl}>Phone</label><input style={inp} type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/></div>
              <div style={{gridColumn:'1/-1'}}><label style={lbl}>Address</label><input style={inp} type="text" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}/></div>
              <div><label style={lbl}>City</label><input style={inp} type="text" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/></div>
              <div><label style={lbl}>Postal Code</label><input style={inp} type="text" value={form.postal_code} onChange={e=>setForm(f=>({...f,postal_code:e.target.value}))}/></div>
              <div style={{gridColumn:'1/-1'}}><label style={lbl}>Notes</label><textarea style={{...inp,minHeight:60}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:18}}>
            <button style={C.btn()} onClick={()=>setShowForm(false)}>Cancel</button>
            <button style={{...C.btn('p'),opacity:saving?.6:1}} disabled={saving} onClick={handleSave}>{saving?'Saving…':(editClient?'Update':'Add Client')}</button>
          </div>
        </div>
      </div>)}

      {/* FICA EDIT MODAL */}
      {showFicaEdit&&selClient&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowFicaEdit(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:440}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>FICA Compliance — {selClient.full_name}</div>
          <div style={{fontSize:11,color:'#555',marginBottom:18}}>Legal Practice Act — FIC Act compliance</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {[['id_verified','Identity Document (ID / Passport)'],['proof_of_address','Proof of Address (≤ 3 months)'],['source_of_funds','Source of Funds Declaration'],['pep_check','PEP / Sanctions Screen']].map(([k,label])=>(
              <label key={k} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#0D0D0D',borderRadius:6,cursor:'pointer',border:`1px solid ${ficaForm[k]?'rgba(141,198,63,0.3)':'#1A1A1A'}`}}>
                <input type="checkbox" checked={ficaForm[k]} onChange={e=>setFicaForm(f=>({...f,[k]:e.target.checked}))}/>
                <span style={{fontSize:12,color:ficaForm[k]?'#8DC63F':'#888'}}>{label}</span>
                {ficaForm[k]&&<span style={{marginLeft:'auto',fontSize:12,color:'#8DC63F'}}>✓</span>}
              </label>
            ))}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>ID / Passport Expiry</label><input style={inp} type="date" value={ficaForm.id_expiry_date} onChange={e=>setFicaForm(f=>({...f,id_expiry_date:e.target.value}))}/></div>
              <div><label style={lbl}>Address Doc Date</label><input style={inp} type="date" value={ficaForm.address_doc_date} onChange={e=>setFicaForm(f=>({...f,address_doc_date:e.target.value}))}/></div>
            </div>
            <div><label style={lbl}>Notes</label><textarea style={{...inp,minHeight:60}} value={ficaForm.notes} onChange={e=>setFicaForm(f=>({...f,notes:e.target.value}))}/></div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:18}}>
            <button style={C.btn()} onClick={()=>setShowFicaEdit(false)}>Cancel</button>
            <button style={{...C.btn('p'),opacity:saving?.6:1}} disabled={saving} onClick={saveFica}>{saving?'Saving…':'Save FICA Record'}</button>
          </div>
        </div>
      </div>)}

    </div>
  </>);
}

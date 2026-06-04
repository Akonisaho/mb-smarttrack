import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchDocuments, uploadDocument, deleteDocument } from '../lib/supabase';

function fdate(d){ try{return new Date(d).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'});}catch{return d||'';} }
function fsize(b){ if(!b)return'—'; if(b<1024)return b+'B'; if(b<1048576)return(b/1024).toFixed(1)+'KB'; return(b/1048576).toFixed(1)+'MB'; }

const DOC_TYPES = ['pleading','contract','correspondence','fica','invoice','affidavit','order','notice','other'];
const DOC_ICONS = { pleading:'📋', contract:'📄', correspondence:'✉️', fica:'🪪', invoice:'🧾', affidavit:'⚖️', order:'🔨', notice:'📢', other:'📎' };

export default function DocumentsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [matters, setMatters] = useState([]);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMatter, setFilterMatter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [alert, setAlert] = useState({ msg:'', type:'' });
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ matterId:'', clientId:'', documentType:'other', description:'' });
  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef(null);

  const isMgr = ['manager','national_manager','branch_manager','bookkeeper'].includes(profile?.role);

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
    const [docsRes, matRes, cliRes] = await Promise.all([
      fetchDocuments(isMgr ? {} : { userId: profile.id }),
      supabase.from('matters').select('id,name,client').order('created_at', { ascending:false }),
      supabase.from('clients').select('id,full_name,client_no').eq('is_active', true).order('full_name'),
    ]);
    setDocuments(docsRes.documents || []);
    setMatters(matRes.data || []);
    setClients(cliRes.data || []);
  }, [profile, isMgr]);

  useEffect(() => { if (!loading) load(); }, [loading, load]);

  function showMsg(msg, type='success') { setAlert({ msg, type }); setTimeout(() => setAlert({ msg:'', type:'' }), 6000); }

  async function handleUpload() {
    if (!selectedFile) { showMsg('Please select a file.', 'error'); return; }
    if (!uploadForm.matterId && !uploadForm.clientId) { showMsg('Link to a matter or client.', 'error'); return; }
    setUploading(true);
    const { error } = await uploadDocument(selectedFile, {
      matterId: uploadForm.matterId || null,
      clientId: uploadForm.clientId || null,
      documentType: uploadForm.documentType,
      description: uploadForm.description,
      userId: profile.id,
      branchId: profile.branch_id,
    });
    setUploading(false);
    if (error) { showMsg('Upload failed: ' + error.message, 'error'); return; }
    showMsg('✓ Document uploaded.');
    setShowUpload(false);
    setSelectedFile(null);
    setUploadForm({ matterId:'', clientId:'', documentType:'other', description:'' });
    load();
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    const { error } = await deleteDocument(doc.id, doc.file_path);
    if (error) { showMsg('Error: ' + error.message, 'error'); return; }
    showMsg('Document deleted.');
    load();
  }

  const filtered = documents.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.file_name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q);
    const matchType = filterType === 'all' || d.document_type === filterType;
    const matchMatter = !filterMatter || d.matter_id === filterMatter;
    return matchSearch && matchType && matchMatter;
  });

  const C = {
    page:  { background:'#0A0A0A', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#F0F0F0' },
    hdr:   { background:'#0F0F0F', borderBottom:'1px solid #1A1A1A', padding:'0 24px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 },
    main:  { maxWidth:1200, margin:'0 auto', padding:'20px 24px' },
    card:  { background:'#111', border:'1px solid #1A1A1A', borderRadius:8, padding:16, marginBottom:14 },
    btn:   (v='s') => ({ background:v==='p'?'#8DC63F':v==='r'?'rgba(220,80,80,0.15)':'transparent', border:v==='p'?'none':v==='r'?'1px solid rgba(220,80,80,0.4)':'1px solid #252525', color:v==='p'?'#0A0A0A':v==='r'?'#E05252':'#888', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:v==='p'?700:500 }),
    sel:   { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'5px 10px', borderRadius:6, fontSize:12, fontFamily:'inherit' },
    th:    { fontSize:9, textTransform:'uppercase', letterSpacing:'0.08em', color:'#444', padding:'9px 10px', borderBottom:'1px solid #181818', textAlign:'left', fontWeight:600 },
    td:    { padding:'9px 10px', fontSize:11, borderBottom:'1px solid #161616', verticalAlign:'middle' },
  };
  const inp = { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'9px 12px', borderRadius:6, fontSize:12, fontFamily:"'DM Sans',system-ui,sans-serif", width:'100%', boxSizing:'border-box' };
  const lbl = { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:4, display:'block' };

  if (loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',color:'#444',fontSize:13}}>Loading...</div>;

  return (<>
    <Head><title>MB SmartTrack — Documents</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}select option{background:#1A1A1A;color:#F0F0F0}button:hover{opacity:.85}`}</style>
    <div style={C.page}>

      <div style={C.hdr}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/logo.png" alt="MB" style={{width:34,height:34,objectFit:'contain',borderRadius:6}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
          <div style={{display:'none',background:'#8DC63F',borderRadius:6,width:34,height:34,alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:'#0A0A0A'}}>MB</div>
          <div><div style={{fontSize:13,fontWeight:700,letterSpacing:'-0.02em'}}>SmartTrack — Documents</div><div style={{fontSize:9,color:'#3A3A3A',textTransform:'uppercase',letterSpacing:'0.1em'}}>Motsoeneng Bill · {profile?.full_name}</div></div>
        </div>
        <div style={{display:'flex',gap:6}}>
          <button style={C.btn()} onClick={()=>router.back()}>← Back</button>
          <button style={C.btn('p')} onClick={()=>setShowUpload(true)}>↑ Upload Document</button>
          <button style={C.btn('r')} onClick={async()=>{await signOut();router.replace('/login');}}>Sign out</button>
        </div>
      </div>

      {alert.msg&&<div style={{background:alert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${alert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'12px 24px',fontSize:12,color:alert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between'}}><span>{alert.msg}</span><button style={{background:'none',border:'none',color:'inherit',cursor:'pointer'}} onClick={()=>setAlert({msg:'',type:''})}>✕</button></div>}

      <div style={C.main}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:10}}>
          <div><div style={{fontSize:16,fontWeight:700}}>Document Management</div><div style={{fontSize:11,color:'#444'}}>{documents.length} documents · {fsize(documents.reduce((s,d)=>s+(d.file_size||0),0))} total</div></div>
        </div>

        <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
          <input type="text" placeholder="Search filename or description..." value={search} onChange={e=>setSearch(e.target.value)} style={{...C.sel,padding:'7px 12px',flex:'1',minWidth:200}}/>
          <select style={C.sel} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">All types</option>{DOC_TYPES.map(t=><option key={t} value={t} style={{textTransform:'capitalize'}}>{t}</option>)}</select>
          <select style={C.sel} value={filterMatter} onChange={e=>setFilterMatter(e.target.value)}><option value="">All matters</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select>
        </div>

        {/* DOCUMENT TYPE SUMMARY */}
        <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
          {DOC_TYPES.filter(t=>documents.some(d=>d.document_type===t)).map(t=>(
            <div key={t} style={{background:'#111',border:'1px solid #1A1A1A',borderRadius:6,padding:'6px 12px',fontSize:11,color:'#666',cursor:'pointer',display:'flex',alignItems:'center',gap:6,borderColor:filterType===t?'rgba(141,198,63,0.4)':'#1A1A1A'}} onClick={()=>setFilterType(filterType===t?'all':t)}>
              <span>{DOC_ICONS[t]||'📎'}</span>
              <span style={{textTransform:'capitalize'}}>{t}</span>
              <span style={{background:'#1A1A1A',borderRadius:20,padding:'1px 6px',fontSize:10,color:'#555'}}>{documents.filter(d=>d.document_type===t).length}</span>
            </div>
          ))}
        </div>

        <div style={C.card}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['','File Name','Type','Matter','Description','Size','Uploaded','Actions'].map(h=><th key={h} style={C.th}>{h}</th>)}</tr></thead>
            <tbody>
              {!filtered.length&&<tr><td colSpan={8} style={{...C.td,textAlign:'center',color:'#333',padding:40}}><div style={{fontSize:28,marginBottom:10}}>📂</div>{search?'No documents match your search.':'No documents yet. Upload your first document.'}</td></tr>}
              {filtered.map(doc=>{
                const matter=matters.find(m=>m.id===doc.matter_id);
                return(<tr key={doc.id}>
                  <td style={{...C.td,width:28,textAlign:'center'}}>{DOC_ICONS[doc.document_type]||'📎'}</td>
                  <td style={{...C.td,fontWeight:500,color:'#D0D0D0',maxWidth:200}}>
                    {doc.public_url?<a href={doc.public_url} target="_blank" rel="noreferrer" style={{color:'#D0D0D0',textDecoration:'none'}}>{doc.file_name}</a>:doc.file_name}
                  </td>
                  <td style={C.td}><span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:'rgba(74,144,217,0.1)',color:'#4A90D9',textTransform:'capitalize'}}>{doc.document_type}</span></td>
                  <td style={{...C.td,fontFamily:'monospace',fontSize:10,color:'#A78BFA'}}>{matter?`${matter.id} · ${matter.client}`:'—'}</td>
                  <td style={{...C.td,color:'#666',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.description||'—'}</td>
                  <td style={{...C.td,fontFamily:'monospace',color:'#555'}}>{fsize(doc.file_size)}</td>
                  <td style={{...C.td,color:'#555'}}>{fdate(doc.uploaded_at)}</td>
                  <td style={C.td}>
                    <div style={{display:'flex',gap:4}}>
                      {doc.public_url&&<a href={doc.public_url} target="_blank" rel="noreferrer" style={{...C.btn(),textDecoration:'none',fontSize:10,padding:'3px 8px'}}>View</a>}
                      <button style={{...C.btn('r'),fontSize:10,padding:'3px 8px'}} onClick={()=>handleDelete(doc)}>Delete</button>
                    </div>
                  </td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUpload&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowUpload(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:480}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:18}}>Upload Document</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <label style={lbl}>File *</label>
              <div style={{border:'2px dashed #252525',borderRadius:8,padding:'20px',textAlign:'center',cursor:'pointer',background:'#0D0D0D'}} onClick={()=>fileRef.current?.click()}>
                {selectedFile?(<div style={{fontSize:13,color:'#8DC63F'}}>✓ {selectedFile.name} ({fsize(selectedFile.size)})</div>):(<div style={{fontSize:12,color:'#555'}}>Click to select file<br/><span style={{fontSize:10,color:'#333'}}>PDF, DOCX, XLSX, JPG, PNG — max 10MB</span></div>)}
                <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt" style={{display:'none'}} onChange={e=>setSelectedFile(e.target.files[0]||null)}/>
              </div>
            </div>
            <div><label style={lbl}>Document Type</label><select style={inp} value={uploadForm.documentType} onChange={e=>setUploadForm(f=>({...f,documentType:e.target.value}))}>{DOC_TYPES.map(t=><option key={t} value={t} style={{textTransform:'capitalize'}}>{t}</option>)}</select></div>
            <div><label style={lbl}>Link to Matter</label><select style={inp} value={uploadForm.matterId} onChange={e=>setUploadForm(f=>({...f,matterId:e.target.value}))}><option value="">— Select matter —</option>{matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}</select></div>
            <div><label style={lbl}>Link to Client</label><select style={inp} value={uploadForm.clientId} onChange={e=>setUploadForm(f=>({...f,clientId:e.target.value}))}><option value="">— Select client —</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></div>
            <div><label style={lbl}>Description</label><input style={inp} type="text" placeholder="Brief description..." value={uploadForm.description} onChange={e=>setUploadForm(f=>({...f,description:e.target.value}))}/></div>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:18}}>
            <button style={C.btn()} onClick={()=>setShowUpload(false)}>Cancel</button>
            <button style={{...C.btn('p'),opacity:uploading?.6:1}} disabled={uploading} onClick={handleUpload}>{uploading?'Uploading…':'Upload'}</button>
          </div>
        </div>
      </div>)}

    </div>
  </>);
}

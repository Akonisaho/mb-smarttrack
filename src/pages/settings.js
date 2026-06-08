import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut } from '../lib/supabase';
import NavBar from '../components/NavBar';

function showMsg(set, msg, type='success') { set({ msg, type }); setTimeout(() => set({ msg:'', type:'' }), 5000); }

export default function Settings() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState({ msg:'', type:'' });
  const [settingsId, setSettingsId] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoRef = useRef(null);
  const [form, setForm] = useState({
    firm_name:'', logo_url:'', vat_number:'', lpc_number:'',
    invoice_prefix:'INV', bank_name:'', bank_account:'',
    bank_branch:'', address:'', phone:'',
    email:'', website:'', default_rate:150, invoice_footer:''
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      if (!p || !['manager','national_manager'].includes(p.role)) { router.replace('/'); return; }
      setProfile(p);
      const { data: s } = await supabase.from('firm_settings').select('*').limit(1).single();
      if (s) {
        setSettingsId(s.id);
        setForm({
          firm_name: s.firm_name||'', logo_url: s.logo_url||'',
          vat_number: s.vat_number||'', lpc_number: s.lpc_number||'',
          invoice_prefix: s.invoice_prefix||'INV', bank_name: s.bank_name||'',
          bank_account: s.bank_account||'', bank_branch: s.bank_branch||'',
          address: s.address||'', phone: s.phone||'', email: s.email||'',
          website: s.website||'', default_rate: s.default_rate||150,
          invoice_footer: s.invoice_footer||''
        });
      }
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    if (!form.firm_name) { showMsg(setAlert, 'Firm name is required.', 'error'); return; }
    setSaving(true);
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error } = settingsId
      ? await supabase.from('firm_settings').update(payload).eq('id', settingsId)
      : await supabase.from('firm_settings').insert([payload]);
    setSaving(false);
    if (error) { showMsg(setAlert, 'Error: ' + error.message, 'error'); return; }
    showMsg(setAlert, 'âœ“ Settings saved successfully.');
  }

  async function handleLogoUpload(file) {
    if (!file) return;
    setLogoUploading(true);
    const ext = file.name.split('.').pop();
    const path = `logos/firm-logo.${ext}`;
    const { error: upErr } = await supabase.storage.from('matter-documents').upload(path, file, { upsert: true });
    if (upErr) { showMsg(setAlert, 'Logo upload failed: ' + upErr.message, 'error'); setLogoUploading(false); return; }
    const { data } = supabase.storage.from('matter-documents').getPublicUrl(path);
    setForm(f => ({ ...f, logo_url: data.publicUrl }));
    setLogoUploading(false);
    showMsg(setAlert, 'âœ“ Logo uploaded.');
  }

  const C = {
    page: { background:'#0A0A0A', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#F0F0F0' },
    main: { maxWidth:900, margin:'0 auto', padding:'28px 24px' },
    card: { background:'#111', border:'1px solid #1A1A1A', borderRadius:8, padding:24, marginBottom:16 },
    btn:  (v='s') => ({ background:v==='p'?'#8DC63F':v==='r'?'rgba(220,80,80,0.15)':'transparent', border:v==='p'?'none':v==='r'?'1px solid rgba(220,80,80,0.4)':'1px solid #252525', color:v==='p'?'#0A0A0A':v==='r'?'#E05252':'#888', padding:'8px 18px', borderRadius:6, cursor:'pointer', fontSize:12, fontFamily:'inherit', fontWeight:v==='p'?700:500 }),
  };
  const inp = { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'10px 14px', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',system-ui,sans-serif", width:'100%', boxSizing:'border-box' };
  const lbl = { fontSize:11, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5, display:'block', fontWeight:600 };
  const sec = { fontSize:13, fontWeight:700, color:'#D0D0D0', marginBottom:16, paddingBottom:10, borderBottom:'1px solid #1A1A1A' };

  if (loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',color:'#444',fontSize:13}}>Loading...</div>;

  return (<>
    <Head><title>Firm Settings â€” SmartTrack</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}button:hover{opacity:.85}textarea{resize:vertical}`}</style>
    <div style={C.page}>
      <NavBar
        role="manager"
        tab={null}
        setTab={()=>{}}
        profile={profile}
        onSignOut={async()=>{await signOut();router.replace('/login');}}
        rightSlot={<button style={C.btn()} onClick={()=>router.back()}>â† Back</button>}
      />

      {alert.msg&&<div style={{background:alert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${alert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'12px 24px',fontSize:12,color:alert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between'}}><span>{alert.msg}</span><button style={{background:'none',border:'none',color:'inherit',cursor:'pointer'}} onClick={()=>setAlert({msg:'',type:''})}>âœ•</button></div>}

      <div style={C.main}>
        <div style={{fontSize:20,fontWeight:700,marginBottom:4}}>Firm Settings</div>
        <div style={{fontSize:12,color:'#555',marginBottom:24}}>These details appear on invoices, statements and emails sent to clients.</div>

        {/* FIRM IDENTITY */}
        <div style={C.card}>
          <div style={sec}>Firm Identity</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={lbl}>Firm Name *</label>
              <input style={inp} type="text" value={form.firm_name} onChange={e=>setForm(f=>({...f,firm_name:e.target.value}))} placeholder="e.g. Motsoeneng Bill"/>
            </div>
            <div>
              <label style={lbl}>VAT Registration Number</label>
              <input style={inp} type="text" value={form.vat_number} onChange={e=>setForm(f=>({...f,vat_number:e.target.value}))} placeholder="e.g. 4100000000"/>
            </div>
            <div>
              <label style={lbl}>LPC Practice Number</label>
              <input style={inp} type="text" value={form.lpc_number} onChange={e=>setForm(f=>({...f,lpc_number:e.target.value}))} placeholder="e.g. LPC123456"/>
            </div>
            <div>
              <label style={lbl}>Invoice Number Prefix</label>
              <input style={inp} type="text" value={form.invoice_prefix} onChange={e=>setForm(f=>({...f,invoice_prefix:e.target.value}))} placeholder="e.g. INV or MB-INV"/>
            </div>
            <div>
              <label style={lbl}>Default Billing Rate (R per unit)</label>
              <input style={inp} type="number" value={form.default_rate} onChange={e=>setForm(f=>({...f,default_rate:parseFloat(e.target.value)||150}))} placeholder="150"/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={lbl}>Firm Logo</label>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                {form.logo_url&&<img src={form.logo_url} alt="Logo" style={{width:60,height:60,objectFit:'contain',border:'1px solid #252525',borderRadius:6,background:'#1A1A1A',padding:4}}/>}
                <div>
                  <button style={C.btn()} onClick={()=>logoRef.current?.click()}>{logoUploading?'Uploadingâ€¦':'Upload Logo'}</button>
                  <input ref={logoRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleLogoUpload(e.target.files[0])}/>
                  <div style={{fontSize:10,color:'#444',marginTop:4}}>PNG or JPG recommended. Max 2MB.</div>
                </div>
                {form.logo_url&&<button style={{...C.btn('r'),fontSize:11}} onClick={()=>setForm(f=>({...f,logo_url:''}))}>Remove</button>}
              </div>
            </div>
          </div>
        </div>

        {/* CONTACT DETAILS */}
        <div style={C.card}>
          <div style={sec}>Contact Details</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={lbl}>Physical Address</label>
              <input style={inp} type="text" value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="123 Legal Street, Pretoria, 0001"/>
            </div>
            <div>
              <label style={lbl}>Phone</label>
              <input style={inp} type="tel" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="012 000 0000"/>
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="accounts@firm.co.za"/>
            </div>
            <div>
              <label style={lbl}>Website</label>
              <input style={inp} type="text" value={form.website} onChange={e=>setForm(f=>({...f,website:e.target.value}))} placeholder="www.firm.co.za"/>
            </div>
          </div>
        </div>

        {/* BANKING */}
        <div style={C.card}>
          <div style={sec}>Banking Details (shown on invoices)</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div>
              <label style={lbl}>Bank Name</label>
              <input style={inp} type="text" value={form.bank_name} onChange={e=>setForm(f=>({...f,bank_name:e.target.value}))} placeholder="e.g. FNB"/>
            </div>
            <div>
              <label style={lbl}>Account Number</label>
              <input style={inp} type="text" value={form.bank_account} onChange={e=>setForm(f=>({...f,bank_account:e.target.value}))} placeholder="e.g. 62000000000"/>
            </div>
            <div>
              <label style={lbl}>Branch Code</label>
              <input style={inp} type="text" value={form.bank_branch} onChange={e=>setForm(f=>({...f,bank_branch:e.target.value}))} placeholder="e.g. 250655"/>
            </div>
          </div>
        </div>

        {/* INVOICE FOOTER */}
        <div style={C.card}>
          <div style={sec}>Invoice & Statement Footer</div>
          <textarea style={{...inp,minHeight:80}} value={form.invoice_footer} onChange={e=>setForm(f=>({...f,invoice_footer:e.target.value}))} placeholder="e.g. Payment due within 30 days. This invoice is computer generated and valid without a signature."/>
          <div style={{fontSize:10,color:'#444',marginTop:8}}>This text appears at the bottom of all invoices and statements.</div>
        </div>

        <div style={{display:'flex',justifyContent:'flex-end',gap:10}}>
          <button style={C.btn()} onClick={()=>router.back()}>Cancel</button>
          <button style={{...C.btn('p'),opacity:saving?.6:1,padding:'10px 28px',fontSize:13}} disabled={saving} onClick={handleSave}>{saving?'Savingâ€¦':'Save Settings'}</button>
        </div>
      </div>
    </div>
  </>);
}


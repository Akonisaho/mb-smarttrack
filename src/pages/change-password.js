import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile } from '../lib/supabase';
import { useFirmSettings } from '../lib/useFirmSettings';

export default function ChangePassword() {
  const router = useRouter();
  const firm = useFirmSettings();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ newPwd:'', confirm:'' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isForced, setIsForced] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      setProfile(p);
      setIsForced(p?.password_changed === false);
      setLoading(false);
    });
  }, []);

  async function handleChange() {
    setError('');
    if (!form.newPwd || form.newPwd.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.newPwd !== form.confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    const { error: pwdErr } = await supabase.auth.updateUser({ password: form.newPwd });
    if (pwdErr) { setError('Error: ' + pwdErr.message); setSaving(false); return; }
    await supabase.from('profiles').update({ password_changed: true }).eq('id', profile.id);
    setSaving(false);
    const role = profile?.role;
    if (role === 'manager' || role === 'national_manager' || role === 'branch_manager') router.replace('/manager');
    else if (role === 'bookkeeper') router.replace('/bookkeeper');
    else if (role === 'receptionist') router.replace('/receptionist');
    else router.replace('/');
  }

  const C = {
    page: { background:'#0A0A0A', minHeight:'100vh', fontFamily:"'DM Sans',system-ui,sans-serif", color:'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center' },
  };
  const inp = { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'12px 16px', borderRadius:8, fontSize:14, fontFamily:"'DM Sans',system-ui,sans-serif", width:'100%', boxSizing:'border-box', outline:'none' };

  if (loading) return <div style={{...C.page}}>Loading...</div>;

  return (<>
    <Head><title>Change Password — {firm.firm_name}</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif;background:#0A0A0A}input:focus{border-color:rgba(141,198,63,0.5)!important;outline:1px solid rgba(141,198,63,0.3)}`}</style>
    <div style={C.page}>
      <div style={{width:'100%',maxWidth:420,padding:20}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:1,marginBottom:10}}>
            <img src="/logo.png" alt="MB" style={{height:48,width:'auto',objectFit:'contain',mixBlendMode:'screen'}} onError={e=>{e.target.style.display='none';e.target.insertAdjacentHTML('afterend','<div style="height:28px;padding:0 6px;background:#8DC63F;border-radius:5px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#0A0A0A">MB</div>');}}/>
            <span style={{fontSize:28,fontWeight:700,letterSpacing:'-0.02em'}}><span style={{color:'#F0F0F0'}}>Smart</span><span style={{color:'#8DC63F'}}>Track</span></span>
          </div>
          <div style={{fontSize:22,fontWeight:700,marginBottom:8}}>{isForced ? 'Set Your Password' : 'Change Password'}</div>
          <div style={{fontSize:13,color:'#555',lineHeight:1.5}}>
            {isForced
              ? `Welcome to ${firm.firm_name}. Please set a new password to continue. Your temporary password will no longer work after this.`
              : 'Enter your new password below.'
            }
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6,display:'block'}}>New Password</label>
            <input style={inp} type="password" placeholder="At least 8 characters" value={form.newPwd} onChange={e=>setForm(f=>({...f,newPwd:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&handleChange()}/>
          </div>
          <div>
            <label style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6,display:'block'}}>Confirm Password</label>
            <input style={inp} type="password" placeholder="Repeat your new password" value={form.confirm} onChange={e=>setForm(f=>({...f,confirm:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&handleChange()}/>
          </div>
          {error&&<div style={{background:'rgba(220,80,80,0.1)',border:'1px solid rgba(220,80,80,0.3)',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#E05252'}}>{error}</div>}
          <button style={{background:'#8DC63F',border:'none',color:'#0A0A0A',padding:'14px',borderRadius:8,cursor:'pointer',fontSize:14,fontFamily:'inherit',fontWeight:700,opacity:saving?.6:1,marginTop:4}} disabled={saving} onClick={handleChange}>{saving?'Saving…':'Set New Password'}</button>
          {!isForced&&<button style={{background:'transparent',border:'none',color:'#555',fontSize:12,cursor:'pointer',fontFamily:'inherit'}} onClick={()=>router.back()}>Cancel</button>}
        </div>
        <div style={{textAlign:'center',marginTop:24,fontSize:11,color:'#333'}}>{firm.firm_name}</div>
      </div>
    </div>
  </>);
}

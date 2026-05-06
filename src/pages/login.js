import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, signIn, signUp } from '../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [mode, setMode]       = useState('login'); // 'login' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]       = useState('');
  const [role, setRole]       = useState('attorney');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) { setError(error.message); setLoading(false); return; }
      router.replace('/');
    } else {
      if (!name.trim()) { setError('Please enter your full name.'); setLoading(false); return; }
      const { error } = await signUp(email, password, name, role);
      if (error) { setError(error.message); setLoading(false); return; }
      setError('');
      setMode('login');
      setLoading(false);
      alert('Account created! You can now log in.');
    }
  }

  const S = {
    page:  { background:'#0A0A0A', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif", padding:20 },
    box:   { background:'#111', border:'1px solid #1A1A1A', borderRadius:12, padding:36, width:'100%', maxWidth:400 },
    inp:   { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'10px 14px', borderRadius:7, fontSize:13, fontFamily:'inherit', width:'100%', outline:'none' },
    btn:   { background:'#6CC04A', border:'none', color:'#0A0A0A', padding:'11px 14px', borderRadius:7, fontSize:13, fontFamily:'inherit', fontWeight:700, width:'100%', cursor:'pointer' },
    lbl:   { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5, display:'block' },
    link:  { background:'none', border:'none', color:'#6CC04A', fontSize:12, cursor:'pointer', fontFamily:'inherit', padding:0 },
    sel:   { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'10px 14px', borderRadius:7, fontSize:13, fontFamily:'inherit', width:'100%' },
  };

  return (
    <>
      <Head><title>MB SmartTrack — Login</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0} input:focus,select:focus{outline:1px solid rgba(108,192,74,0.5);outline-offset:1px} select option{background:#1A1A1A;color:#F0F0F0}`}</style>
      <div style={S.page}>
        <div style={S.box}>
          {/* Logo */}
          <div style={{textAlign:'center', marginBottom:28}}>
            <div style={{fontWeight:900, fontSize:32, letterSpacing:'-0.05em', marginBottom:6}}>
              M<span style={{color:'#6CC04A'}}>B</span>
            </div>
            <div style={{fontSize:16, fontWeight:600, color:'#D0D0D0', marginBottom:4}}>SmartTrack</div>
            <div style={{fontSize:11, color:'#444', textTransform:'uppercase', letterSpacing:'.08em'}}>Motsoeneng Bill Attorneys</div>
          </div>

          <div style={{fontSize:14, fontWeight:600, color:'#D0D0D0', marginBottom:20, textAlign:'center'}}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{display:'flex', flexDirection:'column', gap:14}}>
              {mode === 'signup' && (
                <div>
                  <label style={S.lbl}>Full name *</label>
                  <input style={S.inp} type="text" placeholder="e.g. Adv. Takalani Muthelo" value={name} onChange={e=>setName(e.target.value)} required/>
                </div>
              )}
              <div>
                <label style={S.lbl}>Email address *</label>
                <input style={S.inp} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
              </div>
              <div>
                <label style={S.lbl}>Password *</label>
                <input style={S.inp} type="password" placeholder="Minimum 6 characters" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
              </div>
              {mode === 'signup' && (
                <div>
                  <label style={S.lbl}>Role *</label>
                  <select style={S.sel} value={role} onChange={e=>setRole(e.target.value)}>
                    <option value="attorney">Attorney</option>
                    <option value="manager">Practice Manager</option>
                  </select>
                  <div style={{fontSize:10, color:'#444', marginTop:4}}>Managers see billing summaries for all attorneys</div>
                </div>
              )}
              {error && (
                <div style={{background:'rgba(220,80,80,0.1)', border:'1px solid rgba(220,80,80,0.3)', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#E05252'}}>
                  {error}
                </div>
              )}
              <button style={{...S.btn, opacity: loading ? 0.7 : 1}} type="submit" disabled={loading}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </form>

          <div style={{textAlign:'center', marginTop:20, fontSize:12, color:'#555'}}>
            {mode === 'login' ? (
              <>Don't have an account? <button style={S.link} onClick={()=>{setMode('signup');setError('');}}>Create one</button></>
            ) : (
              <>Already have an account? <button style={S.link} onClick={()=>{setMode('login');setError('');}}>Sign in</button></>
            )}
          </div>

          <div style={{marginTop:24, padding:'12px 14px', background:'#0D0D0D', borderRadius:7, fontSize:11, color:'#444', textAlign:'center', lineHeight:1.6}}>
            Your data is protected and private.<br/>Only you can see your tracked activities.
          </div>
        </div>
      </div>
    </>
  );
}

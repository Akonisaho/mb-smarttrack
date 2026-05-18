import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, signIn, signUp } from '../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [mode, setMode]         = useState('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [role, setRole]         = useState('attorney');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
    // Load branches using anon key — no auth needed, policy allows public read
    supabase.from('branches').select('id, name, address').eq('is_active', true).order('name').then(({ data, error }) => {
      if (data && data.length) {
        setBranches(data);
        setBranchId(data[0].id);
      }
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
      if (!branchId) { setError('Please select your office branch.'); setLoading(false); return; }
      const { data, error } = await signUp(email, password, name, role);
      if (error) { setError(error.message); setLoading(false); return; }
      // Save branch to profile
      if (data?.user) {
        await supabase.from('profiles').update({ branch_id: branchId }).eq('id', data.user.id);
      }
      setMode('login');
      setLoading(false);
      alert('Account created! Please sign in.');
    }
  }

  const S = {
    page: { background:'#0A0A0A', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif", padding:20 },
    box:  { background:'#111', border:'1px solid #1A1A1A', borderRadius:12, padding:36, width:'100%', maxWidth:420 },
    inp:  { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'10px 14px', borderRadius:7, fontSize:13, fontFamily:'inherit', width:'100%', outline:'none' },
    btn:  { background:'#A2C52D', border:'none', color:'#0A0A0A', padding:'11px 14px', borderRadius:7, fontSize:13, fontFamily:'inherit', fontWeight:700, width:'100%', cursor:'pointer' },
    lbl:  { fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:5, display:'block' },
    link: { background:'none', border:'none', color:'#A2C52D', fontSize:12, cursor:'pointer', fontFamily:'inherit', padding:0 },
    sel:  { background:'#1A1A1A', border:'1px solid #252525', color:'#F0F0F0', padding:'10px 14px', borderRadius:7, fontSize:13, fontFamily:'inherit', width:'100%' },
    hint: { fontSize:10, color:'#444', marginTop:4 },
  };

  const roleDescriptions = {
    attorney:   'Tracks your own time, matters and invoices — sees your branch only',
    manager:    'Sees all attorneys, all branches, trust accounting and billing summaries',
    bookkeeper: 'Full trust accounting access across all branches — no time tracking',
  };

  return (
    <>
      <Head><title>MB SmartTrack — {mode === 'login' ? 'Sign In' : 'Create Account'}</title></Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input:focus,select:focus{outline:1px solid rgba(162,197,45,0.5);outline-offset:1px}
        select option{background:#1A1A1A;color:#F0F0F0}
        input::placeholder{color:#333}
      `}</style>
      <div style={S.page}>
        <div style={S.box}>

          {/* Logo */}
          <div style={{textAlign:'center', marginBottom:28}}>
            <div style={{
              width:64, height:64, background:'#A2C52D', borderRadius:10,
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 12px', fontWeight:900, fontSize:22,
              color:'#0A0A0A', letterSpacing:'-0.05em', fontFamily:"'DM Sans',sans-serif"
            }}>
              MB
            </div>
            <div style={{fontSize:17, fontWeight:700, color:'#F0F0F0', letterSpacing:'-0.02em'}}>SmartTrack</div>
            <div style={{fontSize:11, color:'#444', textTransform:'uppercase', letterSpacing:'.1em', marginTop:3}}>Motsoeneng Bill</div>
          </div>

          <div style={{fontSize:14, fontWeight:600, color:'#D0D0D0', marginBottom:20, textAlign:'center'}}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{display:'flex', flexDirection:'column', gap:14}}>

              {mode === 'signup' && (
                <div>
                  <label style={S.lbl}>Full name *</label>
                  <input style={S.inp} type="text" placeholder="e.g. Adv. Sarah Nkosi" value={name} onChange={e=>setName(e.target.value)} required/>
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

              {mode === 'signup' && (<>
                <div>
                  <label style={S.lbl}>Role *</label>
                  <select style={S.sel} value={role} onChange={e=>setRole(e.target.value)}>
                    <option value="attorney">Attorney / Fee Earner</option>
                    <option value="manager">Practice Manager</option>
                    <option value="bookkeeper">Bookkeeper</option>
                  </select>
                  <div style={S.hint}>{roleDescriptions[role]}</div>
                </div>

                <div>
                  <label style={S.lbl}>Office branch *</label>
                  {branches.length === 0 ? (
                    <div style={{...S.sel, display:'flex', alignItems:'center', color:'#555', fontSize:12}}>
                      Loading offices...
                    </div>
                  ) : (
                    <select style={S.sel} value={branchId} onChange={e=>setBranchId(e.target.value)}>
                      {branches.map(b=>(
                        <option key={b.id} value={b.id}>{b.name} — {b.address}</option>
                      ))}
                    </select>
                  )}
                  <div style={S.hint}>Attorneys only see data from their selected branch</div>
                </div>
              </>)}

              {error && (
                <div style={{background:'rgba(220,80,80,0.1)', border:'1px solid rgba(220,80,80,0.3)', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#E05252'}}>
                  {error}
                </div>
              )}

              <button style={{...S.btn, opacity:loading?0.7:1}} type="submit" disabled={loading}>
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

          {/* 3 offices shown on login screen */}
          {mode === 'login' && (
            <div style={{marginTop:20, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
              {[
                {name:'Johannesburg', addr:'Houghton Estate'},
                {name:'Pretoria',     addr:'Ashlea Gardens'},
                {name:'Durban',       addr:'Umhlanga'},
              ].map(b=>(
                <div key={b.name} style={{background:'#0D0D0D', borderRadius:6, padding:'8px 10px', textAlign:'center'}}>
                  <div style={{fontSize:11, fontWeight:600, color:'#D0D0D0', marginBottom:2}}>{b.name}</div>
                  <div style={{fontSize:10, color:'#444'}}>{b.addr}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{marginTop:14, padding:'10px 14px', background:'#0D0D0D', borderRadius:7, fontSize:11, color:'#444', textAlign:'center', lineHeight:1.6}}>
            Your data is private and encrypted.<br/>Only your branch data is visible to you.
          </div>

        </div>
      </div>
    </>
  );
}
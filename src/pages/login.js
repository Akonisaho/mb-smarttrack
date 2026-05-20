import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, signIn, signUp } from '../lib/supabase';

const FALLBACK_BRANCHES = [
  { id: 'jhb', name: 'Johannesburg', address: '85 Central Street, Houghton Estate' },
  { id: 'pta', name: 'Pretoria',     address: '41 Matroosberg Road, Ashlea Gardens' },
  { id: 'dbn', name: 'Durban',       address: '56 Richefond Circle, Umhlanga' },
];

export default function Login() {
  const router = useRouter();
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [role,     setRole]     = useState('attorney');
  const [branchId, setBranchId] = useState('jhb');
  const [branches, setBranches] = useState(FALLBACK_BRANCHES);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
    supabase.from('branches').select('id, name, address').eq('is_active', true).order('name')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setBranches(data);
          setBranchId(data[0].id);
        }
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) { setError(error.message); setLoading(false); return; }
      router.replace('/');
    } else {
      if (!name.trim()) { setError('Please enter your full name.'); setLoading(false); return; }
      if (!branchId)    { setError('Please select your office branch.'); setLoading(false); return; }
     const { data, error } = await signUp(email, password, name, role, branchId);
if (error) { setError(error.message); setLoading(false); return; }
if (data?.user) {
  await new Promise(r => setTimeout(r, 1500));
  await supabase.from('profiles').upsert({
    id:        data.user.id,
    full_name: name,
    email:     email,
    role:      role || 'attorney',
    branch_id: branchId || null,
    firm:      'Motsoeneng Bill',
  });
}
      setMode('login');
      setLoading(false);
      alert('Account created! Please sign in.');
    }
  }

  const roleDesc = {
    attorney:   'Tracks your own time, matters and invoices — sees your branch only',
    manager:    'Sees all attorneys, all branches, trust accounting and billing summaries',
    bookkeeper: 'Full trust accounting access across all branches — no time tracking',
  };

  return (
    <>
      <Head><title>MB SmartTrack — {mode === 'login' ? 'Sign In' : 'Create Account'}</title></Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A0A; }
        .f { display: flex; flex-direction: column; gap: 14px; }
        .lbl { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: block; }
        .inp {
          background: #1A1A1A; border: 1px solid #2A2A2A; color: #F0F0F0;
          padding: 10px 14px; border-radius: 7px; font-size: 13px;
          font-family: 'DM Sans', system-ui, sans-serif; width: 100%; display: block;
        }
        .inp:focus { outline: 1px solid rgba(162,197,45,0.6); border-color: rgba(162,197,45,0.4); }
        .inp::placeholder { color: #444; }
        .inp option { background: #1A1A1A; color: #F0F0F0; }
        .btn {
          background: #8DC63F; border: none; color: #0A0A0A; padding: 12px 14px;
          border-radius: 7px; font-size: 13px; font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 700; width: 100%; cursor: pointer;
        }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .lnk { background: none; border: none; color: #8DC63F; font-size: 12px; cursor: pointer; font-family: inherit; padding: 0; text-decoration: underline; }
        .hint { font-size: 10px; color: #444; margin-top: 4px; }
      `}</style>

      <div style={{background:'#0A0A0A',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',system-ui,sans-serif",padding:20}}>
        <div style={{background:'#111',border:'1px solid #1A1A1A',borderRadius:12,padding:36,width:'100%',maxWidth:420}}>

          {/* Logo */}
          <div style={{textAlign:'center',marginBottom:28}}>
            <img
              src="/logo.png"
              alt="Motsoeneng Bill"
              style={{width:80,height:80,objectFit:'contain',display:'block',margin:'0 auto 10px'}}
              onError={e=>{
                e.target.style.display='none';
                e.target.nextSibling.style.display='flex';
              }}
            />
            <div style={{display:'none',width:64,height:64,background:'#8DC63F',borderRadius:10,alignItems:'center',justifyContent:'center',margin:'0 auto 10px',fontWeight:900,fontSize:20,color:'#0A0A0A',letterSpacing:'-0.05em'}}>MB</div>
            <div style={{fontSize:16,fontWeight:700,color:'#F0F0F0',letterSpacing:'-0.02em'}}>SmartTrack</div>
            <div style={{fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:'.1em',marginTop:3}}>Motsoeneng Bill</div>
          </div>

          <div style={{fontSize:14,fontWeight:600,color:'#D0D0D0',marginBottom:20,textAlign:'center'}}>
            {mode==='login' ? 'Sign in to your account' : 'Create your account'}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="f">

              {mode==='signup' && (
                <div>
                  <label className="lbl">Full name *</label>
                  <input className="inp" type="text" placeholder="e.g. Adv. Sarah Nkosi" value={name} onChange={e=>setName(e.target.value)} required/>
                </div>
              )}

              <div>
                <label className="lbl">Email address *</label>
                <input className="inp" type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} required/>
              </div>

              <div>
                <label className="lbl">Password *</label>
                <input className="inp" type="password" placeholder="Minimum 6 characters" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6}/>
              </div>

              {mode==='signup' && (<>
                <div>
                  <label className="lbl">Role *</label>
                  <select className="inp" value={role} onChange={e=>setRole(e.target.value)}>
                    <option value="attorney">Attorney / Fee Earner</option>
                    <option value="manager">Practice Manager</option>
                    <option value="bookkeeper">Bookkeeper</option>
                  </select>
                  <div className="hint">{roleDesc[role]}</div>
                </div>

                <div>
                  <label className="lbl">Office branch *</label>
                  <select className="inp" value={branchId} onChange={e=>setBranchId(e.target.value)}>
                    {branches.map(b=>(
                      <option key={b.id} value={b.id}>{b.name} — {b.address}</option>
                    ))}
                  </select>
                  <div className="hint">Attorneys only see data from their selected branch</div>
                </div>
              </>)}

              {error && (
                <div style={{background:'rgba(220,80,80,0.1)',border:'1px solid rgba(220,80,80,0.3)',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#E05252'}}>
                  {error}
                </div>
              )}

              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Please wait...' : mode==='login' ? 'Sign In' : 'Create Account'}
              </button>

            </div>
          </form>

          <div style={{textAlign:'center',marginTop:20,fontSize:12,color:'#444'}}>
            Contact your manager to get access.
          </div>

          {mode==='login' && (
            <div style={{marginTop:20,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              {[
                {name:'Johannesburg',addr:'Houghton Estate'},
                {name:'Pretoria',    addr:'Ashlea Gardens'},
                {name:'Durban',      addr:'Umhlanga'},
              ].map(b=>(
                <div key={b.name} style={{background:'#0D0D0D',borderRadius:6,padding:'8px 10px',textAlign:'center',border:'1px solid #1A1A1A'}}>
                  <div style={{fontSize:11,fontWeight:600,color:'#D0D0D0',marginBottom:2}}>{b.name}</div>
                  <div style={{fontSize:10,color:'#444'}}>{b.addr}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{marginTop:14,padding:'10px 14px',background:'#0D0D0D',borderRadius:7,fontSize:11,color:'#444',textAlign:'center',lineHeight:1.6,border:'1px solid #1A1A1A'}}>
            Your data is private and encrypted.<br/>Only your branch data is visible to you.
          </div>

        </div>
      </div>
    </>
  );
}
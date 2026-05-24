import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, signIn } from '../lib/supabase';

export default function Login() {
  const router = useRouter();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetting,setResetting]= useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/');
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) { setError(error.message); setLoading(false); return; }
    router.replace('/');
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Please enter your email address first.'); return; }
    setResetting(true);
    setError('');
    setResetMsg('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://mb-smarttrack.vercel.app/reset-password',
    });
    if (error) { setError(error.message); setResetting(false); return; }
    setResetMsg('✓ Password reset email sent. Check your inbox.');
    setResetting(false);
  }

  return (
    <>
      <Head><title>MB SmartTrack — Sign In</title></Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A0A; }
        .lbl { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: block; }
        .inp {
          background: #1A1A1A; border: 1px solid #2A2A2A; color: #F0F0F0;
          padding: 10px 14px; border-radius: 7px; font-size: 13px;
          font-family: 'DM Sans', system-ui, sans-serif; width: 100%; display: block;
        }
        .inp:focus { outline: 1px solid rgba(141,198,63,0.6); border-color: rgba(141,198,63,0.4); }
        .inp::placeholder { color: #444; }
        .btn {
          background: #8DC63F; border: none; color: #0A0A0A; padding: 12px 14px;
          border-radius: 7px; font-size: 13px; font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 700; width: 100%; cursor: pointer;
        }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn:hover:not(:disabled) { opacity: 0.9; }
        .lnk { background: none; border: none; color: #8DC63F; font-size: 12px; cursor: pointer; font-family: inherit; padding: 0; text-decoration: underline; }
        .lnk:hover { opacity: 0.8; }
        .eye { background: none; border: none; color: #555; cursor: pointer; font-size: 16px; padding: 0 10px; position: absolute; right: 0; top: 50%; transform: translateY(-50%); }
        .eye:hover { color: #8DC63F; }
      `}</style>

      <div style={{background:'#0A0A0A',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',system-ui,sans-serif",padding:20}}>
        <div style={{background:'#111',border:'1px solid #1A1A1A',borderRadius:12,padding:36,width:'100%',maxWidth:420}}>

          {/* Logo */}
          <div style={{textAlign:'center',marginBottom:28}}>
            <img
              src="/logo.png"
              alt="Motsoeneng Bill"
              style={{width:80,height:80,objectFit:'contain',display:'block',margin:'0 auto 10px'}}
              onError={e=>{ e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
            />
            <div style={{display:'none',width:64,height:64,background:'#8DC63F',borderRadius:10,alignItems:'center',justifyContent:'center',margin:'0 auto 10px',fontWeight:900,fontSize:20,color:'#0A0A0A',letterSpacing:'-0.05em'}}>MB</div>
            <div style={{fontSize:16,fontWeight:700,color:'#F0F0F0',letterSpacing:'-0.02em'}}>SmartTrack</div>
            <div style={{fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:'.1em',marginTop:3}}>Motsoeneng Bill</div>
          </div>

          <div style={{fontSize:14,fontWeight:600,color:'#D0D0D0',marginBottom:20,textAlign:'center'}}>
            Sign in to your account
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>

              <div>
                <label className="lbl">Email address *</label>
                <input
                  className="inp"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e=>setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="lbl">Password *</label>
                <div style={{position:'relative'}}>
                  <input
                    className="inp"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Your password"
                    value={password}
                    onChange={e=>setPassword(e.target.value)}
                    required
                    style={{paddingRight:44}}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="eye"
                    onClick={()=>setShowPwd(v=>!v)}
                    tabIndex={-1}
                    title={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? 'Hide' : 'Show'}
                  </button>
                </div>
                <div style={{textAlign:'right',marginTop:6}}>
                  <button
                    type="button"
                    className="lnk"
                    onClick={handleForgotPassword}
                    disabled={resetting}
                  >
                    {resetting ? 'Sending...' : 'Forgot password?'}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{background:'rgba(220,80,80,0.1)',border:'1px solid rgba(220,80,80,0.3)',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#E05252'}}>
                  {error}
                </div>
              )}

              {resetMsg && (
                <div style={{background:'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.3)',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#8DC63F'}}>
                  {resetMsg}
                </div>
              )}

              <button className="btn" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

            </div>
          </form>

          <div style={{textAlign:'center',marginTop:20,fontSize:12,color:'#444'}}>
            Contact your manager to get access.
          </div>

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

          <div style={{marginTop:14,padding:'10px 14px',background:'#0D0D0D',borderRadius:7,fontSize:11,color:'#444',textAlign:'center',lineHeight:1.6,border:'1px solid #1A1A1A'}}>
            Your data is private and encrypted.<br/>Only your branch data is visible to you.
          </div>

        </div>
      </div>
    </>
  );
}
import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a valid session from the reset link
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError('Invalid or expired reset link. Please request a new one.');
      }
    });
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    if (!password || !confirm) { setError('Please fill in all fields.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.replace('/'), 3000);
  }

  return (
    <>
      <Head><title>MB SmartTrack — Reset Password</title></Head>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A0A0A; }
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
        .lbl { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 5px; display: block; }
        .eye { background: none; border: none; color: #555; cursor: pointer; padding: 0 10px; position: absolute; right: 0; top: 50%; transform: translateY(-50%); }
        .eye:hover { color: #8DC63F; }
      `}</style>

      <div style={{background:'#0A0A0A',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',system-ui,sans-serif",padding:20}}>
        <div style={{background:'#111',border:'1px solid #1A1A1A',borderRadius:12,padding:36,width:'100%',maxWidth:420}}>

          <div style={{textAlign:'center',marginBottom:28}}>
            <img src="/logo.png" alt="MB" style={{width:80,height:80,objectFit:'contain',display:'block',margin:'0 auto 10px'}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
            <div style={{display:'none',width:64,height:64,background:'#8DC63F',borderRadius:10,alignItems:'center',justifyContent:'center',margin:'0 auto 10px',fontWeight:900,fontSize:20,color:'#0A0A0A'}}>MB</div>
            <div style={{fontSize:16,fontWeight:700,color:'#F0F0F0'}}>SmartTrack</div>
            <div style={{fontSize:11,color:'#444',textTransform:'uppercase',letterSpacing:'.1em',marginTop:3}}>Motsoeneng Bill</div>
          </div>

          <div style={{fontSize:14,fontWeight:600,color:'#D0D0D0',marginBottom:20,textAlign:'center'}}>
            Reset your password
          </div>

          {success ? (
            <div style={{background:'rgba(141,198,63,0.1)',border:'1px solid rgba(141,198,63,0.3)',borderRadius:6,padding:'16px',fontSize:13,color:'#8DC63F',textAlign:'center'}}>
              ✓ Password reset successfully!<br/>
              <span style={{fontSize:11,color:'#555'}}>Redirecting to dashboard...</span>
            </div>
          ) : (
            <form onSubmit={handleReset}>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div>
                  <label className="lbl">New password *</label>
                  <div style={{position:'relative'}}>
                    <input
                      className="inp"
                      type={showPwd ? 'text' : 'password'}
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={e=>setPassword(e.target.value)}
                      style={{paddingRight:44}}
                      required
                    />
                    <button type="button" className="eye" onClick={()=>setShowPwd(v=>!v)}>
                      {showPwd ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="lbl">Confirm new password *</label>
                  <input
                    className="inp"
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    value={confirm}
                    onChange={e=>setConfirm(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div style={{background:'rgba(220,80,80,0.1)',border:'1px solid rgba(220,80,80,0.3)',borderRadius:6,padding:'10px 14px',fontSize:12,color:'#E05252'}}>
                    {error}
                  </div>
                )}

                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

          <div style={{marginTop:20,textAlign:'center',fontSize:11,color:'#444'}}>
            <button style={{background:'none',border:'none',color:'#8DC63F',cursor:'pointer',fontSize:11,fontFamily:'inherit'}} onClick={()=>router.replace('/login')}>
              ← Back to login
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
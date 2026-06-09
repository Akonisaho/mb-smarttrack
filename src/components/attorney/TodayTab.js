import { useState } from 'react';
import { C } from '../../lib/attyStyles';
import { toHm, calcUnits, calcAmt, appIcon, fdate, ftime, pct } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { savePerformanceFeedback, fetchPerformanceFeedback, markFeedbackRead } from '../../lib/supabase';

function Badge({ c }) {
  const s = c === 'billable' ? { color: '#6CC04A', border: '1px solid rgba(108,192,74,0.35)', bg: 'rgba(108,192,74,0.1)' } : c === 'work' ? { color: '#4A90D9', border: '1px solid rgba(74,144,217,0.35)', bg: 'rgba(74,144,217,0.1)' } : { color: '#666', border: '1px solid #2A2A2A', bg: 'rgba(42,42,42,0.4)' };
  return <span style={{ color: s.color, border: s.border, background: s.bg, fontSize: 9, padding: '2px 8px', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize', display: 'inline-block' }}>{c}</span>;
}

export default function TodayTab({
  liveActs, daySec, dayBillSec, dayBillU, matters, selDate, setSelDate, dates, invRate,
  setTab, openReviews, selfSubmitted, setSelfSubmitted, peerReviewedIds, setPeerReviewedIds,
  branchColleagues, perfFeedback, setPerfFeedback, profile, userId, reclassify, assignMatter, toast,
}) {
  const [showFbPanel, setShowFbPanel] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showSelfAssess, setShowSelfAssess] = useState(false);
  const [saForm, setSaForm] = useState({ billing_score: 0, client_score: 0, teamwork_score: 0, knowledge_score: 0, overall_score: 0, comments: '', reviewId: '', period: '' });
  const [submittingSA, setSubmittingSA] = useState(false);
  const [showPeerReview, setShowPeerReview] = useState(false);
  const [prPeriod, setPrPeriod] = useState('');
  const [prForm, setPrForm] = useState({ billing_score: 0, client_score: 0, teamwork_score: 0, knowledge_score: 0, overall_score: 0, comments: '', is_anonymous: false });
  const [submittingPR, setSubmittingPR] = useState(false);

  const unreadCount = perfFeedback.filter(f => !f.is_read && f.from_user_id !== userId).length;

  async function handleOpenFbPanel() {
    setShowFbPanel(s => !s);
    if (!showFbPanel && unreadCount > 0) {
      const unread = perfFeedback.filter(f => !f.is_read && f.from_user_id !== userId).map(f => f.id);
      await Promise.all(unread.map(id => markFeedbackRead(id)));
      setPerfFeedback(prev => prev.map(f => unread.includes(f.id) ? { ...f, is_read: true } : f));
    }
  }

  return (
    <div style={C.main}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>{fdate(selDate)}</div>
          <div style={{ fontSize: 11, color: '#444' }}>{liveActs.length} sessions · {toHm(daySec)} total</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={C.sel} value={selDate} onChange={e => setSelDate(e.target.value)}>
            <option value={new Date().toLocaleDateString('en-CA')}>Today</option>
            {dates.filter(d => d.date !== new Date().toLocaleDateString('en-CA')).map(d => <option key={d.date} value={d.date}>{fdate(d.date)} ({d.sessions})</option>)}
          </select>
          <button style={C.btn('p')} onClick={() => setTab('invoices')}>Generate Invoice</button>
        </div>
      </div>

      {!liveActs.length && (
        <div style={{ background: 'rgba(74,144,217,0.05)', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 11, color: '#666' }}>
          <strong style={{ color: '#4A90D9' }}>No live data yet</strong> — Electron agent must be running.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[{ l: 'Total Time', v: toHm(daySec), s: `${liveActs.length} sessions`, a: false }, { l: 'Billable Time', v: toHm(dayBillSec), s: `${pct(dayBillSec, daySec)}% utilisation`, a: true }, { l: 'Billing Units', v: dayBillU, s: '6-min units', a: false }, { l: 'Est. Value', v: `R${(dayBillU * invRate).toLocaleString()}`, s: `@ R${invRate}/unit`, a: false }].map(({ l, v, s, a }) => (
          <div key={l} style={C.stat(a)}>
            <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 8 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: a ? '#6CC04A' : '#F0F0F0' }}>{v}</div>
            <div style={{ fontSize: 10, color: '#444' }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Self-assessment banners */}
      {openReviews.filter(r => !selfSubmitted[r.id]).map(rv => (
        <div key={rv.id} style={{ background: 'rgba(141,198,63,0.04)', border: '1px solid rgba(141,198,63,0.3)', borderRadius: 8, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#8DC63F' }}>📋 Self-Assessment Due — {rv.period}</div>
            <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{rv.due_date ? `Due ${new Date(rv.due_date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long' })} · ` : ''}{rv.instructions || 'Please complete your performance self-assessment.'}</div>
          </div>
          <button style={{ ...C.btn('p'), fontSize: 12, padding: '7px 18px', whiteSpace: 'nowrap' }} onClick={() => { setSaForm({ billing_score: 0, client_score: 0, teamwork_score: 0, knowledge_score: 0, overall_score: 0, comments: '', reviewId: rv.id, period: rv.period }); setShowSelfAssess(true); }}>Complete Self-Assessment</button>
        </div>
      ))}
      {openReviews.filter(r => selfSubmitted[r.id]).map(rv => (
        <div key={rv.id} style={{ background: 'rgba(141,198,63,0.03)', border: '1px solid rgba(141,198,63,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#8DC63F', fontSize: 14 }}>✓</span>
          <span style={{ fontSize: 12, color: '#555' }}>Self-assessment submitted for <strong style={{ color: '#8DC63F' }}>{rv.period}</strong> — HR will complete their review.</span>
        </div>
      ))}

      {/* Peer review banners */}
      {openReviews.map(rv => {
        const pending = branchColleagues.filter(c => !peerReviewedIds.includes(c.id));
        const allDone = branchColleagues.length > 0 && branchColleagues.every(c => peerReviewedIds.includes(c.id));
        return (
          <div key={'pr-' + rv.id}>
            {pending.length > 0 && (
              <div style={{ background: 'rgba(74,144,217,0.04)', border: '1px solid rgba(74,144,217,0.28)', borderRadius: 8, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#4A90D9' }}>👥 Peer Reviews Due — {rv.period}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>{pending.length} colleague{pending.length !== 1 ? 's' : ''} to review{rv.due_date ? ` · Due ${new Date(rv.due_date + 'T12:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'long' })}` : ''}</div>
                </div>
                <button style={{ background: '#4A90D9', border: 'none', color: '#fff', padding: '7px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, whiteSpace: 'nowrap' }} onClick={() => { setPrPeriod(rv.period); setPrForm({ billing_score: 0, client_score: 0, teamwork_score: 0, knowledge_score: 0, overall_score: 0, comments: '', is_anonymous: false }); setShowPeerReview(true); }}>Start Peer Reviews ({pending.length})</button>
              </div>
            )}
            {allDone && (
              <div style={{ background: 'rgba(74,144,217,0.03)', border: '1px solid rgba(74,144,217,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#4A90D9', fontSize: 14 }}>✓</span>
                <span style={{ fontSize: 12, color: '#555' }}>All peer reviews submitted for <strong style={{ color: '#4A90D9' }}>{rv.period}</strong>.</span>
              </div>
            )}
          </div>
        );
      })}

      {/* HR Feedback panel */}
      {perfFeedback.length > 0 && (
        <div style={{ background: 'rgba(244,114,182,0.04)', border: `1px solid ${unreadCount > 0 ? 'rgba(244,114,182,0.35)' : 'rgba(244,114,182,0.12)'}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFbPanel ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12 }}>💬</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F472B6' }}>HR Feedback</span>
              {unreadCount > 0 && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(244,114,182,0.15)', color: '#F472B6', fontWeight: 700 }}>{unreadCount} new</span>}
            </div>
            <button style={{ ...C.btn(), fontSize: 11 }} onClick={handleOpenFbPanel}>{showFbPanel ? '▲ Hide' : '▼ Open'}</button>
          </div>
          {showFbPanel && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                {perfFeedback.map(msg => {
                  const isHr = msg.from_user_id !== userId;
                  const TC = { commendation: '#8DC63F', concern: '#E05252', action_required: '#EAB308', general: '#555' };
                  const tc = TC[msg.type] || '#555';
                  return (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: isHr ? 'flex-start' : 'flex-end' }}>
                      <div style={{ background: isHr ? '#1A1A1A' : 'rgba(108,192,74,0.08)', border: `1px solid ${isHr ? '#252525' : 'rgba(108,192,74,0.2)'}`, borderRadius: 8, padding: '8px 12px', maxWidth: '82%' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: isHr ? '#F472B6' : '#6CC04A' }}>{isHr ? msg.sender?.full_name || 'HR' : 'You'}</span>
                          <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, background: `${tc}20`, color: tc, textTransform: 'capitalize' }}>{msg.type?.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: 9, color: '#333', marginLeft: 'auto' }}>{new Date(msg.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#C0C0C0', lineHeight: 1.5 }}>{msg.message}</div>
                        {!msg.is_read && isHr && <div style={{ fontSize: 8, color: '#EAB308', marginTop: 2 }}>• New</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <textarea style={{ ...C.inp, flex: 1, minHeight: 50, resize: 'none' }} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply to HR…" />
                <button style={{ ...C.btn('p'), alignSelf: 'flex-end', padding: '8px 14px', whiteSpace: 'nowrap' }} disabled={sendingReply || !replyText.trim()} onClick={async () => {
                  setSendingReply(true);
                  const hrMsg = perfFeedback.find(f => f.from_user_id !== userId);
                  await savePerformanceFeedback({ from_user_id: userId, to_user_id: hrMsg?.from_user_id || null, message: replyText.trim(), type: 'general', period: perfFeedback[0]?.period || '', from_name: profile?.full_name || '', is_read: false });
                  setSendingReply(false); setReplyText('');
                  const [{ feedback: rcvd }, { feedback: sent }] = await Promise.all([fetchPerformanceFeedback({ toUserId: userId }), fetchPerformanceFeedback({ fromUserId: userId })]);
                  setPerfFeedback([...(rcvd || []), ...(sent || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
                }}>{sendingReply ? 'Sending…' : 'Reply'}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity log */}
      <div style={C.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0' }}>Activity Log — {fdate(selDate)}</span>
          <span style={{ fontSize: 10, color: '#444' }}>{liveActs.length} sessions</span>
        </div>
        {!liveActs.length ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#333' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🖥️</div>
            <div style={{ fontSize: 14, color: '#444', marginBottom: 6 }}>No sessions yet</div>
            <div style={{ fontSize: 11, color: '#2A2A2A' }}>Start the Electron agent to begin tracking</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Time', 'Application', 'Window Title', 'Matter', 'Duration', 'Units', 'Status', 'Override'].map(h => <th key={h} style={C.th}>{h}</th>)}</tr></thead>
              <tbody>
                {liveActs.map(a => {
                  const am = matters.find(m => m.id === a.matter);
                  return (
                    <tr key={a.id}>
                      <td style={{ ...C.td, fontFamily: 'monospace', color: '#555', whiteSpace: 'nowrap' }}>{ftime(a.start_time)}</td>
                      <td style={{ ...C.td, whiteSpace: 'nowrap' }}>{appIcon(a.app_display_name)} <span style={{ color: '#C8C8C8', fontSize: 11 }}>{a.app_display_name}</span></td>
                      <td style={{ ...C.td, color: '#666', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.window_title}>{a.window_title}</td>
                      <td style={{ ...C.td, minWidth: 170 }}>
                        <select style={{ ...C.asel, width: '100%', color: am ? '#A78BFA' : '#555', borderColor: am ? 'rgba(167,139,250,0.5)' : '#252525' }} value={a.matter || ''} onChange={e => assignMatter(a.id, e.target.value)}>
                          <option value="">— assign matter —</option>
                          {matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}
                        </select>
                        {am && <div style={{ fontSize: 9, color: '#A78BFA', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{am.name}</div>}
                      </td>
                      <td style={{ ...C.td, fontFamily: 'monospace', color: '#888' }}>{toHm(a.duration_seconds)}</td>
                      <td style={{ ...C.td, fontFamily: 'monospace', color: a.classification === 'billable' ? '#6CC04A' : '#444', fontWeight: 600 }}>{a.classification === 'billable' ? calcUnits(a.duration_seconds) : '—'}</td>
                      <td style={C.td}><Badge c={a.classification} /></td>
                      <td style={C.td}>
                        <select style={C.asel} value={a.classification} onChange={e => reclassify(a.id, e.target.value)}>
                          <option value="billable">Billable</option>
                          <option value="work">Work</option>
                          <option value="non-billable">Non-Billable</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Self-assessment modal */}
      {showSelfAssess && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={() => setShowSelfAssess(false)}>
          <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, padding: 28, width: '100%', maxWidth: 520, margin: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Self-Assessment — {saForm.period}</div>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 18 }}>Rate yourself honestly across each performance area</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['billing_score', 'Billing & Target Achievement'], ['client_score', 'Client Service & Communication'], ['teamwork_score', 'Teamwork & Professional Attitude'], ['knowledge_score', 'Legal Knowledge & Expertise'], ['overall_score', 'Overall Self-Rating']].map(([key, label]) => (
                <div key={key}>
                  <label style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6, display: 'block' }}>{label}</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} style={{ flex: 1, padding: '8px 4px', borderRadius: 6, border: `1px solid ${saForm[key] === n ? '#6CC04A' : '#252525'}`, background: saForm[key] === n ? 'rgba(108,192,74,0.12)' : '#1A1A1A', color: saForm[key] === n ? '#6CC04A' : '#555', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: saForm[key] === n ? 700 : 400 }} onClick={() => setSaForm(f => ({ ...f, [key]: n }))}>{n} {'★'.repeat(n)}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <label style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6, display: 'block' }}>Comments & Reflection</label>
                <textarea style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', minHeight: 80, resize: 'vertical' }} value={saForm.comments} onChange={e => setSaForm(f => ({ ...f, comments: e.target.value }))} placeholder="Reflect on your achievements, challenges, and goals…" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
              <button style={C.btn()} onClick={() => setShowSelfAssess(false)}>Cancel</button>
              <button style={{ background: '#6CC04A', border: 'none', color: '#0A0A0A', padding: '6px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, opacity: submittingSA || !saForm.overall_score ? 0.5 : 1 }} disabled={submittingSA || !saForm.overall_score} onClick={async () => {
                setSubmittingSA(true);
                const { error } = await supabase.from('feedback_360').insert([{ subject_id: userId, reviewer_id: userId, reviewer_type: 'self', period: saForm.period, billing_score: saForm.billing_score, client_score: saForm.client_score, teamwork_score: saForm.teamwork_score, knowledge_score: saForm.knowledge_score, overall_score: saForm.overall_score, comments: saForm.comments, is_anonymous: false }]);
                setSubmittingSA(false);
                if (error) { toast('Error: ' + error.message, 'error'); return; }
                setShowSelfAssess(false);
                setSelfSubmitted(prev => ({ ...prev, [saForm.reviewId]: true }));
                toast('✓ Self-assessment submitted — HR has been notified.', 'success');
              }}>{submittingSA ? 'Submitting…' : 'Submit Self-Assessment'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Peer review modal */}
      {showPeerReview && (() => {
        const pending = branchColleagues.filter(c => !peerReviewedIds.includes(c.id));
        if (!pending.length) return null;
        const current = pending[0];
        const done = branchColleagues.length - pending.length;
        const total = branchColleagues.length;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={() => setShowPeerReview(false)}>
            <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, padding: 28, width: '100%', maxWidth: 520, margin: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Peer Review — {prPeriod}</div>
                  <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>Reviewing <strong style={{ color: '#4A90D9' }}>{current.full_name}</strong></div>
                </div>
                <div style={{ fontSize: 11, color: '#555', textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#4A90D9' }}>{done + 1} of {total}</div>
                  <div style={{ marginTop: 2 }}>{pending.length - 1} remaining after this</div>
                </div>
              </div>
              <div style={{ height: 3, background: '#1A1A1A', borderRadius: 2, marginBottom: 18 }}>
                <div style={{ width: `${Math.round(done / total * 100)}%`, height: '100%', background: '#4A90D9', borderRadius: 2, transition: 'width .3s' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {[['billing_score', 'Billing & Target Achievement'], ['client_score', 'Client Service'], ['teamwork_score', 'Teamwork & Attitude'], ['knowledge_score', 'Legal Knowledge'], ['overall_score', 'Overall Rating']].map(([key, label]) => (
                  <div key={key}>
                    <label style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5, display: 'block' }}>{label}</label>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: `1px solid ${prForm[key] === n ? '#4A90D9' : '#252525'}`, background: prForm[key] === n ? 'rgba(74,144,217,0.12)' : '#1A1A1A', color: prForm[key] === n ? '#4A90D9' : '#555', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: prForm[key] === n ? 700 : 400 }} onClick={() => setPrForm(f => ({ ...f, [key]: n }))}>{n}★</button>
                      ))}
                    </div>
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5, display: 'block' }}>Comments (optional)</label>
                  <textarea style={{ background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '8px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', minHeight: 60, resize: 'vertical' }} value={prForm.comments} onChange={e => setPrForm(f => ({ ...f, comments: e.target.value }))} placeholder={`Strengths or development areas for ${current.full_name.split(' ')[0]}…`} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#777', cursor: 'pointer' }}>
                  <input type="checkbox" checked={prForm.is_anonymous} onChange={e => setPrForm(f => ({ ...f, is_anonymous: e.target.checked }))} />
                  Submit anonymously
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'space-between', alignItems: 'center' }}>
                <button style={C.btn()} onClick={() => setShowPeerReview(false)}>Save for Later</button>
                <button style={{ background: '#4A90D9', border: 'none', color: '#fff', padding: '7px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700, opacity: submittingPR || !prForm.overall_score ? 0.5 : 1 }} disabled={submittingPR || !prForm.overall_score} onClick={async () => {
                  setSubmittingPR(true);
                  await supabase.from('feedback_360').insert([{ subject_id: current.id, reviewer_id: prForm.is_anonymous ? null : userId, reviewer_type: 'peer', period: prPeriod, billing_score: prForm.billing_score, client_score: prForm.client_score, teamwork_score: prForm.teamwork_score, knowledge_score: prForm.knowledge_score, overall_score: prForm.overall_score, comments: prForm.comments, is_anonymous: prForm.is_anonymous }]);
                  const newReviewed = [...peerReviewedIds, current.id];
                  setPeerReviewedIds(newReviewed);
                  setPrForm({ billing_score: 0, client_score: 0, teamwork_score: 0, knowledge_score: 0, overall_score: 0, comments: '', is_anonymous: false });
                  setSubmittingPR(false);
                  if (!branchColleagues.filter(c => !newReviewed.includes(c.id)).length) { setShowPeerReview(false); toast('✓ All peer reviews submitted — thank you!', 'success'); }
                }}>{submittingPR ? 'Saving…' : pending.length > 1 ? 'Submit & Next →' : 'Submit & Finish ✓'}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

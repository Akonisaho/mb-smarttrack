import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase';
import { useFirmSettings } from '../lib/useFirmSettings';

export default function RatePage() {
  const router = useRouter();
  const { token } = router.query;
  const firm = useFirmSettings();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(null);
  const [attorney, setAttorney] = useState(null);
  const [matter, setMatter] = useState(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    supabase.from('client_satisfaction').select('*').eq('token', token).eq('submitted', false).single()
      .then(async ({ data, error }) => {
        if (error || !data) { setError('This rating link is invalid or has already been used.'); setLoading(false); return; }
        setRecord(data);
        if (data.attorney_id) {
          const { data: p } = await supabase.from('profiles').select('full_name').eq('id', data.attorney_id).single();
          setAttorney(p);
        }
        if (data.matter_id) {
          const { data: m } = await supabase.from('matters').select('name, client').eq('id', data.matter_id).single();
          setMatter(m);
        }
        setLoading(false);
      });
  }, [token]);

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    await supabase.from('client_satisfaction').update({ rating, comment, submitted: true }).eq('token', token);
    setDone(true);
    setSubmitting(false);
  }

  const S = {
    page: { background: '#F9FAFB', minHeight: '100vh', fontFamily: "'DM Sans',system-ui,sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' },
    card: { background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', padding: 32, width: '100%', maxWidth: 480 },
    star: (filled) => ({ fontSize: 40, cursor: 'pointer', color: filled ? '#F59E0B' : '#D1D5DB', transition: 'color 0.1s' }),
  };

  if (loading) return <div style={S.page}><div style={{ color: '#9CA3AF', fontSize: 14 }}>Loading…</div></div>;

  if (error) return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>❌</div>
        <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Link Invalid</div>
        <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>{error}</div>
      </div>
    </div>
  );

  if (done) return (
    <div style={S.page}>
      <Head><title>Thank You — {firm.firm_name}</title></Head>
      <div style={S.card}>
        <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🌟</div>
        <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Thank you for your feedback!</div>
        <div style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>Your rating helps us improve our service. We appreciate you taking the time.</div>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#D1D5DB' }}>{firm.firm_name}</div>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <Head><title>Rate Your Experience — {firm.firm_name}</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif;background:#F9FAFB}textarea:focus{outline:1px solid rgba(141,198,63,0.4);border-color:#8DC63F}`}</style>
      <div style={S.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '-0.03em', marginBottom: 4 }}>{firm.firm_name}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF' }}>Client Satisfaction Survey</div>
        </div>

        {attorney && (
          <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '14px 16px', marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 4 }}>How would you rate your experience with</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111' }}>{attorney.full_name}</div>
            {matter && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Matter: {matter.name}</div>}
          </div>
        )}

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Tap a star to rate</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[1, 2, 3, 4, 5].map(s => (
              <span key={s} style={S.star(s <= (hover || rating))}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}>★</span>
            ))}
          </div>
          {rating > 0 && (
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 10 }}>
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 6 }}>Additional comments (optional)</label>
          <textarea
            style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px', fontSize: 13, fontFamily: 'inherit', minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
            placeholder="Tell us about your experience…"
            value={comment}
            onChange={e => setComment(e.target.value)}
          />
        </div>

        <button
          style={{ width: '100%', background: rating ? '#8DC63F' : '#D1D5DB', border: 'none', color: rating ? '#0A0A0A' : '#9CA3AF', padding: 14, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: rating ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
          disabled={!rating || submitting}
          onClick={handleSubmit}>
          {submitting ? 'Submitting…' : 'Submit Rating'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#E5E7EB' }}>
          Your response is confidential · {firm.firm_name}
        </div>
      </div>
    </div>
  );
}

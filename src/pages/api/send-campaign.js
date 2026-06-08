import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { subject, body, recipientType, matterId, campaignType = 'email' } = req.body;
  if (!subject?.trim() || !body?.trim()) return res.status(400).json({ error: 'Subject and body are required.' });

  // Build recipient list
  let query = supabaseAdmin.from('clients').select('id,full_name,email').eq('is_active', true).not('email', 'is', null);
  if (recipientType === 'matter' && matterId) {
    const { data: matter } = await supabaseAdmin.from('matters').select('client_id').eq('id', matterId).single();
    if (matter?.client_id) query = query.eq('id', matter.client_id);
  } else if (recipientType === 'overdue') {
    const { data: invs } = await supabaseAdmin.from('invoices').select('client_id').eq('status', 'pending');
    const ids = [...new Set((invs || []).map(i => i.client_id).filter(Boolean))];
    if (ids.length) query = query.in('id', ids);
    else return res.status(200).json({ sent: 0, skipped: 0, message: 'No overdue clients with email addresses.' });
  }

  const { data: recipients, error: rErr } = await query;
  if (rErr) return res.status(500).json({ error: rErr.message });
  if (!recipients?.length) return res.status(200).json({ sent: 0, skipped: 0, message: 'No recipients found.' });

  if (!process.env.RESEND_API_KEY) {
    return res.status(200).json({ sent: recipients.length, skipped: 0, simulated: true, message: `RESEND_API_KEY not set — would have sent to ${recipients.length} recipient(s).` });
  }

  let sent = 0, skipped = 0;
  for (const client of recipients) {
    if (!client.email) { skipped++; continue; }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: 'MB SmartTrack <onboarding@resend.dev>',
          to: [client.email],
          subject,
          html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><p>Dear ${client.full_name},</p>${body.split('\n').map(l=>`<p>${l}</p>`).join('')}<p style="color:#888;font-size:12px;margin-top:32px">— Motsoeneng Bill</p></div>`,
        }),
      });
      if (r.ok) sent++; else skipped++;
    } catch { skipped++; }
  }

  // Log the campaign
  await supabaseAdmin.from('campaigns').insert([{ subject, recipient_type: recipientType, total_sent: sent, total_skipped: skipped, sent_at: new Date().toISOString() }]).catch(() => {});

  return res.status(200).json({ sent, skipped, message: `Sent to ${sent} recipient(s)${skipped > 0 ? `, ${skipped} skipped (no email)` : ''}.` });
}

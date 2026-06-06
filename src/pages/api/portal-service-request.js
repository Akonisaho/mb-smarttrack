import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { clientId, serviceType, description, urgency } = req.body;
  if (!clientId || !serviceType || !description) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const { data, error } = await supabaseAdmin.from('portal_service_requests').insert([{
    client_id: clientId, service_type: serviceType,
    description, urgency: urgency || 'normal',
  }]).select();

  if (error) return res.status(500).json({ error: error.message });

  const { data: client } = await supabaseAdmin.from('clients').select('full_name, email').eq('id', clientId).single();
  const { data: firm } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firm?.firm_name || 'MB SmartTrack';

  // Notify receptionist/manager
  const { data: staff } = await supabaseAdmin.from('profiles').select('email').in('role', ['receptionist','hr','manager','national_manager']);

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f5f5f5;">
      <div style="background:#0A0A0A;border-radius:10px;padding:20px;text-align:center;margin-bottom:16px;">
        <h2 style="color:#8DC63F;margin:0;">New Service Request</h2>
        <p style="color:#555;margin:4px 0 0;font-size:12px;">${firmName} · Client Portal</p>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;">
        <p style="font-size:14px;color:#333;"><strong>${client?.full_name||'A client'}</strong> has submitted a new service request through the client portal:</p>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin:16px 0;">
          <div style="font-size:12px;color:#999;margin-bottom:4px;">Service Type</div>
          <div style="font-size:15px;font-weight:700;color:#8DC63F;">${serviceType}</div>
          <div style="font-size:12px;color:#999;margin-top:10px;margin-bottom:4px;">Description</div>
          <div style="font-size:13px;color:#333;">${description}</div>
          <div style="font-size:12px;color:#999;margin-top:10px;margin-bottom:4px;">Urgency</div>
          <div style="font-size:13px;font-weight:700;color:${urgency==='urgent'?'#E05252':urgency==='low'?'#888':'#EAB308'};text-transform:capitalize;">${urgency||'normal'}</div>
        </div>
        <p style="font-size:13px;color:#666;">Log in and go to <strong>Clients → Requests</strong> to respond.</p>
      </div>
    </div>
  `;

  if (process.env.RESEND_API_KEY && staff?.length) {
    for (const s of staff) {
      if (!s.email) continue;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `${firmName} <onboarding@resend.dev>`,
          to: s.email,
          subject: `New portal request from ${client?.full_name||'client'} — ${serviceType}`,
          html,
        }),
      });
    }
  }

  return res.status(200).json({ success: true, id: data?.[0]?.id });
}

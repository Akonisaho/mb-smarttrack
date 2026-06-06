import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { fullName, email, phone, idNumber, serviceType, description, urgency } = req.body;
  if (!fullName || !email || !serviceType || !description) {
    return res.status(400).json({ error: 'Please fill in all required fields.' });
  }

  const { data, error } = await supabaseAdmin.from('client_requests').insert([{
    full_name: fullName, email, phone: phone||null,
    id_number: idNumber||null, service_type: serviceType,
    description, urgency: urgency||'normal',
  }]).select();

  if (error) return res.status(500).json({ error: error.message });

  const { data: firm } = await supabaseAdmin.from('firm_settings').select('*').limit(1).single();
  const firmName = firm?.firm_name || 'MB SmartTrack';

  // Notify receptionist staff by email
  const { data: receptionists } = await supabaseAdmin
    .from('profiles')
    .select('email, full_name')
    .in('role', ['receptionist', 'hr', 'manager', 'national_manager']);

  const notifyHtml = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f5f5f5;">
      <div style="background:#0A0A0A;border-radius:10px;padding:20px;text-align:center;margin-bottom:16px;">
        <h2 style="color:#8DC63F;margin:0;">New Client Request</h2>
        <p style="color:#555;margin:4px 0 0;font-size:12px;">${firmName}</p>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;">
        <p style="font-size:14px;color:#333;margin-bottom:16px;">A new client has submitted a service request:</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px;background:#f8f8f8;font-size:12px;color:#999;border:1px solid #eee;">Name</td><td style="padding:8px;border:1px solid #eee;font-weight:600;">${fullName}</td></tr>
          <tr><td style="padding:8px;background:#f8f8f8;font-size:12px;color:#999;border:1px solid #eee;">Email</td><td style="padding:8px;border:1px solid #eee;">${email}</td></tr>
          <tr><td style="padding:8px;background:#f8f8f8;font-size:12px;color:#999;border:1px solid #eee;">Phone</td><td style="padding:8px;border:1px solid #eee;">${phone||'—'}</td></tr>
          <tr><td style="padding:8px;background:#f8f8f8;font-size:12px;color:#999;border:1px solid #eee;">Service</td><td style="padding:8px;border:1px solid #eee;font-weight:600;color:#8DC63F;">${serviceType}</td></tr>
          <tr><td style="padding:8px;background:#f8f8f8;font-size:12px;color:#999;border:1px solid #eee;">Urgency</td><td style="padding:8px;border:1px solid #eee;color:${urgency==='urgent'?'#E05252':urgency==='low'?'#888':'#EAB308'};font-weight:600;text-transform:capitalize;">${urgency||'normal'}</td></tr>
          <tr><td style="padding:8px;background:#f8f8f8;font-size:12px;color:#999;border:1px solid #eee;">Description</td><td style="padding:8px;border:1px solid #eee;">${description}</td></tr>
        </table>
        <p style="font-size:13px;color:#666;margin-top:16px;">Log in to the system and go to <strong>Clients → Requests</strong> to review and respond.</p>
      </div>
    </div>
  `;

  if (process.env.RESEND_API_KEY && receptionists?.length) {
    for (const r of receptionists) {
      if (!r.email) continue;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: `${firmName} <onboarding@resend.dev>`,
          to: r.email,
          subject: `New client request from ${fullName} — ${serviceType}`,
          html: notifyHtml,
        }),
      });
    }
  }

  // Confirm email to client
  const confirmHtml = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#f5f5f5;">
      <div style="background:#0A0A0A;border-radius:10px;padding:20px;text-align:center;margin-bottom:16px;">
        <h2 style="color:#8DC63F;margin:0;">${firmName}</h2>
      </div>
      <div style="background:#fff;border-radius:10px;padding:32px;">
        <h3 style="color:#111;margin:0 0 12px;">Thank you, ${fullName}</h3>
        <p style="font-size:14px;color:#555;">We have received your request for <strong>${serviceType}</strong> and one of our team members will be in contact with you shortly.</p>
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:20px 0;">
          <p style="font-size:13px;color:#166534;margin:0;">✓ Your request has been submitted successfully. Reference: <strong>${data?.[0]?.id?.substring(0,8)||'—'}</strong></p>
        </div>
        <p style="font-size:13px;color:#666;">If your matter is urgent, please call us directly.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="font-size:11px;color:#ccc;text-align:center;">${firmName}${firm?.phone?' · '+firm.phone:''}</p>
      </div>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: `${firmName} <onboarding@resend.dev>`,
        to: email,
        subject: `We received your request — ${firmName}`,
        html: confirmHtml,
      }),
    });
  }

  return res.status(200).json({ success: true, id: data?.[0]?.id });
}

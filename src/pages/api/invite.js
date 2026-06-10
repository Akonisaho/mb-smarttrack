import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });
  const { data: callerProfile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
  const managerRoles = ['manager', 'national_manager', 'branch_manager'];
  if (!managerRoles.includes(callerProfile?.role)) return res.status(403).json({ error: 'Forbidden' });
  const { email, fullName, role, title, branchId, inviterRole } = req.body;
  if (!email || !fullName || !branchId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  // Branch managers can only create attorneys, bookkeepers, and receptionists
  const BRANCH_MANAGER_ALLOWED = ['attorney', 'bookkeeper', 'receptionist'];
  if (inviterRole === 'branch_manager' && !BRANCH_MANAGER_ALLOWED.includes(role)) {
    return res.status(403).json({ error: 'Branch managers can only add attorneys, bookkeepers, and receptionists.' });
  }
  try {
    const tempPass = 'ST@' + Math.random().toString(36).slice(2,8).toUpperCase() + '!' + new Date().getFullYear();

    // Get firm settings for email branding
    const { data: firmSettings } = await supabaseAdmin
      .from('firm_settings').select('*').limit(1).single();
    const firmName = firmSettings?.firm_name || 'SmartTrack';
    const firmEmail = firmSettings?.email || 'noreply@resend.dev';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://mb-smarttrack.vercel.app';

    // Create user via Supabase Admin API
    const { data: userData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPass,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, branch_id: branchId }
    });

    if (createErr) return res.status(400).json({ error: createErr.message });

    // Update profile
    await supabaseAdmin.from('profiles').upsert({
      id: userData.user.id,
      full_name: fullName,
      email,
      role: role || 'attorney',
      title: title || null,
      branch_id: branchId,
      firm: firmName,
      password_changed: false,
    });

    // Email is sent by the caller via /api/send-staff-credentials — no email here.
    return res.status(200).json({ success: true, tempPassword: tempPass });
  } catch(e) {
    console.error('Invite error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

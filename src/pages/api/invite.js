import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email, fullName, role, branchId } = req.body;
  if (!email || !fullName || !branchId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role: role || 'attorney' }
    });
    if (error) return res.status(400).json({ error: error.message });
    await new Promise(r => setTimeout(r, 1500));
    await supabaseAdmin.from('profiles').upsert({
      id:        data.user.id,
      full_name: fullName,
      email:     email,
      role:      role || 'attorney',
      branch_id: branchId || null,
      firm:      'Motsoeneng Bill',
    });
    return res.status(200).json({ success: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
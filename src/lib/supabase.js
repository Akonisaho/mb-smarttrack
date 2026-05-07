import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://zpqdhodxyrkfcgameekn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcWRob2R4eXJrZmNnYW1lZWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzU3MTcsImV4cCI6MjA5MzU1MTcxN30.sjYPAoi0Xc5tzRtjaFw-2odNAno4axh8R4TTOAAtY40';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// ── Auth ─────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}
export async function signOut() { await supabase.auth.signOut(); }
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) console.error('getProfile error:', error.message);
  return data;
}

// ── Activities ────────────────────────────────────────────────────────
export async function fetchActivities({ date, userId } = {}) {
  let q = supabase.from('activities').select('*').neq('agent_id', 'demo').eq('user_id', userId);
  if (date) q = q.eq('date', date);
  q = q.order('start_time', { ascending: false }).limit(500);
  const { data, error } = await q;
  if (error) console.error('fetchActivities:', error.message);
  return { activities: data || [] };
}
export async function fetchAllActivities({ userId } = {}) {
  // Include ALL activities except demo seeds — call logs (manual-call-*) are included
  const { data, error } = await supabase.from('activities').select('*')
    .not('agent_id', 'eq', 'demo').eq('user_id', userId)
    .order('start_time', { ascending: false }).limit(2000);
  if (error) console.error('fetchAllActivities:', error.message);
  return { activities: data || [] };
}
export async function patchActivity(id, updates) {
  const { error } = await supabase.from('activities').update(updates).eq('id', id);
  if (error) console.error('patchActivity:', error.message);
  return { error };
}
export async function patchActivityMatter(id, matter) {
  const { error } = await supabase.from('activities').update({ matter }).eq('id', id);
  if (error) console.error('patchActivityMatter:', error.message);
  return { error };
}

// ── Matters ───────────────────────────────────────────────────────────
export async function fetchMatters(userId) {
  let q = supabase.from('matters').select('*').order('created_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId); // null = manager sees all
  const { data, error } = await q;
  if (error) console.error('fetchMatters:', error.message);
  return { matters: data || [] };
}
export async function createMatter({ id, name, client, description, userId }) {
  const matterId = id.trim().toUpperCase();
  // Check for duplicate
  const { data: existing } = await supabase.from('matters').select('id').eq('id', matterId).eq('user_id', userId);
  if (existing && existing.length > 0) {
    return { data: null, error: { message: `Matter ID "${matterId}" already exists.` } };
  }
  const { data, error } = await supabase.from('matters').insert([{
    id: matterId, name: name.trim(), client: client.trim(),
    description: (description || '').trim(), user_id: userId
  }]).select();
  if (error) console.error('createMatter:', error.message);
  return { data: data?.[0] || null, error };
}
export async function deleteMatter(id) {
  await supabase.from('activities').update({ matter: '' }).eq('matter', id);
  const { error } = await supabase.from('matters').delete().eq('id', id);
  if (error) console.error('deleteMatter:', error.message);
  return { error };
}

// ── Invoices ──────────────────────────────────────────────────────────
export async function fetchInvoices(userId) {
  let q = supabase.from('invoices').select('*').order('created_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId); // null = manager sees all
  const { data, error } = await q;
  if (error) console.error('fetchInvoices:', error.message);
  return { invoices: data || [] };
}
export async function saveInvoice(invoice, userId) {
  try {
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    const num = (count || 0) + 1;
    const id  = `MB-${String(num).padStart(4, '0')}-${new Date().getFullYear()}`;
    // Ensure matter_id is the manually entered ID not auto-generated
    const invoiceData = {
      id,
      user_id:      userId,
      client:       invoice.client       || '',
      matter_id:    invoice.matter_id    || '',  // manually entered e.g. L2025/042
      matter_name:  invoice.matter_name  || '',
      attorney:     invoice.attorney     || '',
      period:       invoice.period       || 'day',
      period_label: invoice.period_label || '',
      rate:         invoice.rate         || 150,
      total_units:  invoice.total_units  || 0,
      total_amount: invoice.total_amount || 0,
      activity_ids: invoice.activity_ids || [],
    };
    const { data, error } = await supabase.from('invoices').insert([invoiceData]).select();
    if (error) console.error('saveInvoice error:', error.message);
    return { data: data?.[0], error, id };
  } catch(e) {
    console.error('saveInvoice exception:', e.message);
    return { data: null, error: { message: e.message } };
  }
}
export async function deleteInvoice(id) {
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) console.error('deleteInvoice:', error.message);
  return { error };
}

// ── History ────────────────────────────────────────────────────────────
export async function fetchHistory(year, userId) {
  const { data } = await supabase.from('activities').select('date, duration_seconds, is_billable, billing_units')
    .eq('user_id', userId).neq('agent_id', 'demo')
    .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`);
  const months = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    months[key] = { month: key, sessions: 0, total_seconds: 0, billable_seconds: 0, billable_units: 0 };
  }
  (data || []).forEach(a => {
    const key = a.date.substring(0, 7);
    if (!months[key]) return;
    months[key].sessions++;
    months[key].total_seconds    += a.duration_seconds || 0;
    months[key].billable_seconds += a.is_billable ? (a.duration_seconds || 0) : 0;
    months[key].billable_units   += a.is_billable ? (a.billing_units || 0) : 0;
  });
  return { months: Object.values(months) };
}
export async function fetchMonthActivities(month, userId) {
  const { data } = await supabase.from('activities').select('*')
    .eq('user_id', userId).neq('agent_id', 'demo')
    .gte('date', `${month}-01`).lte('date', `${month}-31`)
    .order('start_time', { ascending: true });
  return { activities: data || [] };
}

// ── Manager ───────────────────────────────────────────────────────────
export async function fetchManagerSummary(date) {
  // Get summary for selected date AND all-time totals
  const { data } = await supabase.from('manager_summary').select('*')
    .eq('date', date);
  // Also get all-time billing units per attorney
  const { data: allTime } = await supabase.from('activities').select(
    'user_id, billing_units, is_billable, duration_seconds'
  ).neq('agent_id', 'demo');
  return { summary: data || [], allTime: allTime || [] };
}
export async function fetchAllProfiles() {
  // Get all attorneys including those with no activity today
  const { data, error } = await supabase.from('profiles').select('*')
    .eq('role', 'attorney').order('full_name');
  if (error) console.error('fetchAllProfiles:', error.message);
  return { profiles: data || [] };
}

// ── Search (client-side fuzzy) ─────────────────────────────────────────
export async function searchAll(query, userId) {
  if (!query || !userId) return { activities: [], matters: [], invoices: [] };
  const q = query.toLowerCase().trim();

  const [actsRes, mattersRes, invoicesRes] = await Promise.all([
    supabase.from('activities').select('*').eq('user_id', userId).order('start_time', { ascending: false }).limit(500),
    supabase.from('matters').select('*').eq('user_id', userId),
    supabase.from('invoices').select('*').eq('user_id', userId).limit(100),
  ]);

  const match = (str) => str && str.toLowerCase().includes(q);

  return {
    activities: (actsRes.data  || []).filter(a => match(a.window_title) || match(a.app_display_name) || match(a.matter)).slice(0, 40),
    matters:    (mattersRes.data || []).filter(m => match(m.name) || match(m.client) || match(m.id)),
    invoices:   (invoicesRes.data|| []).filter(i => match(i.client) || match(i.matter_name) || match(i.id)),
  };
}

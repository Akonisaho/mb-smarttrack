import { createClient } from '@supabase/supabase-js';
 
const SUPABASE_URL  = 'https://zpqdhodxyrkfcgameekn.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwcWRob2R4eXJrZmNnYW1lZWtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzU3MTcsImV4cCI6MjA5MzU1MTcxN30.sjYPAoi0Xc5tzRtjaFw-2odNAno4axh8R4TTOAAtY40';
 
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true }
});
 
// ── Auth ──────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}
 
export async function signOut() {
  await supabase.auth.signOut();
}
 
export async function signUp(email, password, fullName, role, branchId) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role: role || 'attorney' } }
  });
  if (error) return { error };
  if (data.user) {
    await new Promise(r => setTimeout(r, 1500));
    await supabase.from('profiles').upsert({
      id:        data.user.id,
      full_name: fullName,
      email:     email,
      role:      role || 'attorney',
      branch_id: branchId || null,
      firm:      'Motsoeneng Bill',
    });
  }
  return { data, error: null };
}
 
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
 
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) console.error('getProfile error:', error.message);
  return data;
}
 
// ── Invite Staff (manager creates account directly) ───────────────────
export async function inviteStaff({ fullName, email, role, branchId }) {
  try {
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, role, branchId }),
    });
    const data = await res.json();
    if (!res.ok) return { error: { message: data.error || 'Invitation failed' } };
    return { data, error: null };
  } catch(e) {
    return { error: { message: e.message } };
  }
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
  const [recentRes, billableRes] = await Promise.all([
    supabase.from('activities').select('*')
      .not('agent_id', 'eq', 'demo').eq('user_id', userId)
      .order('start_time', { ascending: false }).limit(2000),
    supabase.from('activities').select('*')
      .not('agent_id', 'eq', 'demo').eq('user_id', userId)
      .eq('is_billable', true)
      .order('start_time', { ascending: false })
  ]);
  if (recentRes.error) console.error('fetchAllActivities:', recentRes.error.message);
  const recent = recentRes.data || [];
  const billable = billableRes.data || [];
  const ids = new Set(recent.map(a => a.id));
  const merged = [...recent, ...billable.filter(a => !ids.has(a.id))];
  return { activities: merged };
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
export async function fetchMatters(userId, allMatters=false) {
  let q = supabase.from('matters').select('*').order('created_at', { ascending: false });
  if (userId && !allMatters) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) console.error('fetchMatters:', error.message);
  return { matters: data || [] };
}
 
export async function createMatter({ id, name, client, description, userId, branchId }) {
  const matterId = id.trim().toUpperCase();
  const { data: existing } = await supabase.from('matters').select('id').eq('id', matterId).eq('user_id', userId);
  if (existing && existing.length > 0) {
    return { data: null, error: { message: `Matter ID "${matterId}" already exists.` } };
  }
  const { data, error } = await supabase.from('matters').insert([{
    id: matterId, name: name.trim(), client: client.trim(),
    description: (description || '').trim(), user_id: userId,
    branch_id: branchId || null
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
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) console.error('fetchInvoices:', error.message);
  return { invoices: data || [] };
}
 
export async function saveInvoice(invoice, userId) {
  try {
    const ts  = Date.now().toString().slice(-6);
    const id  = `MB-${ts}-${new Date().getFullYear()}`;
    const invoiceData = {
      id,
      user_id:      userId,
      client:       invoice.client       || '',
      matter_id:    invoice.matter_id    || '',
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
 
// ── History ───────────────────────────────────────────────────────────
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
export async function fetchManagerSummary(date, period='all') {
  const { data } = await supabase.from('manager_summary').select('*').eq('date', date);
  
  // Always fetch ALL activities — frontend handles period filtering
  const { data: allTime } = await supabase.from('activities').select(
    'user_id, billing_units, is_billable, duration_seconds, date, matter'
  ).neq('agent_id', 'demo');

  return { summary: data || [], allTime: allTime || [] };
}
 
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, branch_id')
    .order('full_name');
  if (error) console.error('fetchAllProfiles:', error.message);
  return { profiles: data || [] };
}
 
// ── Calendar ──────────────────────────────────────────────────────────
export async function fetchCalendarEvents({ userId, isManager, startDate, endDate } = {}) {
  let q = supabase.from('calendar_events').select('*').order('start_date').order('start_time', { nullsFirst: true });
  if (startDate) q = q.gte('start_date', startDate);
  if (endDate)   q = q.lte('start_date', endDate);
  if (!isManager && userId) q = q.or(`user_id.eq.${userId},is_firm_wide.eq.true`);
  const { data, error } = await q;
  if (error) console.error('fetchCalendarEvents:', error.message);
  return { events: data || [] };
}

export async function saveCalendarEvent(event, userId) {
  const payload = { ...event, updated_at: new Date().toISOString() };
  const { data, error } = event.id
    ? await supabase.from('calendar_events').update(payload).eq('id', event.id).select()
    : await supabase.from('calendar_events').insert([{ ...payload, created_by: userId }]).select();
  if (error) console.error('saveCalendarEvent:', error.message);
  return { data: data?.[0], error };
}

export async function deleteCalendarEvent(id) {
  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) console.error('deleteCalendarEvent:', error.message);
  return { error };
}

// ── Invoice Payments ──────────────────────────────────────────────────
export async function fetchInvoicePayments() {
  const { data, error } = await supabase.from('invoice_payments').select('*').order('payment_date', { ascending: false });
  if (error) console.error('fetchInvoicePayments:', error.message);
  return { payments: data || [] };
}

export async function saveInvoicePayment({ invoiceId, amount, paymentDate, reference, narration }, userId) {
  const { data, error } = await supabase.from('invoice_payments').insert([{
    invoice_id: invoiceId, amount, payment_date: paymentDate,
    reference, narration, received_by: userId
  }]).select();
  if (error) console.error('saveInvoicePayment:', error.message);
  return { data: data?.[0], error };
}

export async function deleteInvoicePayment(id) {
  const { error } = await supabase.from('invoice_payments').delete().eq('id', id);
  if (error) console.error('deleteInvoicePayment:', error.message);
  return { error };
}

// ── Clients ───────────────────────────────────────────────────────────
export async function fetchClients({ branchId, isActive = true } = {}) {
  let q = supabase.from('clients').select('*').order('full_name');
  if (branchId) q = q.eq('branch_id', branchId);
  if (isActive !== null) q = q.eq('is_active', isActive);
  const { data, error } = await q;
  if (error) console.error('fetchClients:', error.message);
  return { clients: data || [] };
}

export async function fetchClient(id) {
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
  if (error) console.error('fetchClient:', error.message);
  return { client: data };
}

export async function saveClient(client, userId) {
  const payload = { ...client, updated_at: new Date().toISOString() };
  if (!client.id) {
    // Auto-generate client number e.g. MB-C-0042
    const { count } = await supabase.from('clients').select('*', { count:'exact', head:true });
    payload.client_no = `MB-C-${String((count||0)+1).padStart(4,'0')}`;
    payload.created_by = userId;
  }
  const { data, error } = client.id
    ? await supabase.from('clients').update(payload).eq('id', client.id).select()
    : await supabase.from('clients').insert([payload]).select();
  if (error) console.error('saveClient:', error.message);
  return { data: data?.[0], error };
}

export async function deleteClient(id) {
  const { error } = await supabase.from('clients').update({ is_active: false }).eq('id', id);
  if (error) console.error('deleteClient:', error.message);
  return { error };
}

// ── FICA ──────────────────────────────────────────────────────────────
export async function fetchFicaRecord(clientId) {
  const { data, error } = await supabase.from('fica_records').select('*').eq('client_id', clientId).maybeSingle();
  if (error) console.error('fetchFicaRecord:', error.message);
  return { record: data };
}

export async function saveFicaRecord(record, userId) {
  const payload = { ...record, updated_at: new Date().toISOString() };
  const { data, error } = record.id
    ? await supabase.from('fica_records').update(payload).eq('id', record.id).select()
    : await supabase.from('fica_records').insert([{ ...payload, verified_by: userId }]).select();
  if (error) console.error('saveFicaRecord:', error.message);
  return { data: data?.[0], error };
}

export async function fetchAllFicaRecords() {
  const { data, error } = await supabase.from('fica_records').select('*, clients(full_name, client_no, email)');
  if (error) console.error('fetchAllFicaRecords:', error.message);
  return { records: data || [] };
}

// ── Disbursements ─────────────────────────────────────────────────────
export async function fetchDisbursements({ matterId, userId, status, all } = {}) {
  let q = supabase.from('disbursements').select('*').order('date', { ascending: false });
  if (matterId) q = q.eq('matter_id', matterId);
  if (userId && !all) q = q.eq('user_id', userId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) console.error('fetchDisbursements:', error.message);
  return { disbursements: data || [] };
}

export async function saveDisbursement(disb, userId) {
  const payload = { ...disb, updated_at: new Date().toISOString() };
  const { data, error } = disb.id
    ? await supabase.from('disbursements').update(payload).eq('id', disb.id).select()
    : await supabase.from('disbursements').insert([{ ...payload, user_id: userId }]).select();
  if (error) console.error('saveDisbursement:', error.message);
  return { data: data?.[0], error };
}

export async function deleteDisbursement(id) {
  const { error } = await supabase.from('disbursements').delete().eq('id', id);
  if (error) console.error('deleteDisbursement:', error.message);
  return { error };
}

export async function markDisbursementsBilled(ids, invoiceId) {
  const { error } = await supabase.from('disbursements')
    .update({ status: 'billed', invoice_id: invoiceId, updated_at: new Date().toISOString() })
    .in('id', ids);
  if (error) console.error('markDisbursementsBilled:', error.message);
  return { error };
}

// ── Fee Schedules ─────────────────────────────────────────────────────
export async function fetchFeeSchedules() {
  const { data, error } = await supabase.from('fee_schedules').select('*').eq('is_active', true).order('name');
  if (error) console.error('fetchFeeSchedules:', error.message);
  return { schedules: data || [] };
}

export async function saveFeeSchedule(schedule, userId) {
  const payload = { ...schedule };
  const { data, error } = schedule.id
    ? await supabase.from('fee_schedules').update(payload).eq('id', schedule.id).select()
    : await supabase.from('fee_schedules').insert([{ ...payload, created_by: userId }]).select();
  if (error) console.error('saveFeeSchedule:', error.message);
  return { data: data?.[0], error };
}

// ── Documents ─────────────────────────────────────────────────────────
export async function fetchDocuments({ matterId, clientId, userId } = {}) {
  let q = supabase.from('documents').select('*').order('uploaded_at', { ascending: false });
  if (matterId) q = q.eq('matter_id', matterId);
  if (clientId) q = q.eq('client_id', clientId);
  if (userId)   q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) console.error('fetchDocuments:', error.message);
  return { documents: data || [] };
}

export async function uploadDocument(file, { matterId, clientId, documentType, description, userId, branchId }) {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${matterId || clientId || 'general'}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('matter-documents').upload(path, file, { upsert: false });
  if (upErr) { console.error('uploadDocument storage:', upErr.message); return { error: upErr }; }
  const { data, error } = await supabase.from('documents').insert([{
    matter_id: matterId || null, client_id: clientId || null,
    user_id: userId, branch_id: branchId || null,
    file_name: file.name, file_path: path, file_size: file.size,
    mime_type: file.type, document_type: documentType || 'other',
    description, public_url: null,
  }]).select();
  if (error) console.error('uploadDocument db:', error.message);
  return { data: data?.[0], error };
}

export async function getDocumentUrl(filePath) {
  const { data, error } = await supabase.storage
    .from('matter-documents')
    .createSignedUrl(filePath, 3600);
  if (error) console.error('getDocumentUrl:', error.message);
  return { url: data?.signedUrl, error };
}

export async function deleteDocument(id, filePath) {
  await supabase.storage.from('matter-documents').remove([filePath]);
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) console.error('deleteDocument:', error.message);
  return { error };
}

// ── Client Portal ─────────────────────────────────────────────────────
export async function fetchPortalAccess(token) {
  const { data, error } = await supabase.from('client_portal_access')
    .select('*, clients(*)').eq('token', token).eq('is_active', true).maybeSingle();
  if (error) console.error('fetchPortalAccess:', error.message);
  return { access: data };
}

export async function createPortalAccess(clientId, email, createdBy) {
  const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  const { data, error } = await supabase.from('client_portal_access')
    .insert([{ client_id: clientId, email, token, is_active: true, created_by: createdBy }]).select();
  if (error) console.error('createPortalAccess:', error.message);
  return { data: data?.[0], token, error };
}

// ── Search ────────────────────────────────────────────────────────────
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
    activities: (actsRes.data   || []).filter(a => match(a.window_title) || match(a.app_display_name) || match(a.matter)).slice(0, 40),
    matters:    (mattersRes.data || []).filter(m => match(m.name) || match(m.client) || match(m.id)),
    invoices:   (invoicesRes.data|| []).filter(i => match(i.client) || match(i.matter_name) || match(i.id)),
  };
}
 
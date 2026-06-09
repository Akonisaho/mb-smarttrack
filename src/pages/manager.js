import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchAllProfiles, fetchManagerSummary, fetchInvoices, fetchInvoicePayments, saveInvoicePayment, fetchClients, fetchAllFicaRecords, fetchDisbursements, saveDisbursement, deleteDisbursement, fetchFeeSchedules, saveFeeSchedule, fetchCreditNotes, saveCreditNote, writeOffInvoice, undoWriteOff, fetchMatterNotes, saveMatterNote, deleteMatterNote, fetchUndertakings, saveUndertaking, fulfillUndertaking, deleteUndertaking, fetchClientCommunications, saveClientCommunication, deleteClientCommunication, fetchAuditLog, logAudit, saveInterestCharge, updateMatter } from '../lib/supabase';
import NavBar from '../components/NavBar';
import { SkeletonDashboard } from '../components/Skeleton';
import { fmtR, fmtDate } from '../lib/format';

// Tab components
import OverviewTab from '../components/manager/OverviewTab';
import TrustTab from '../components/manager/TrustTab';
import AnalyticsTab from '../components/manager/AnalyticsTab';
import HistoryTab from '../components/manager/HistoryTab';
import WipTab from '../components/manager/WipTab';
import DebtorsTab from '../components/manager/DebtorsTab';
import ReportsTab from '../components/manager/ReportsTab';
import StatementsTab from '../components/manager/StatementsTab';
import MattersTab from '../components/manager/MattersTab';
import ClientsTab from '../components/manager/ClientsTab';
import DisbursementsTab from '../components/manager/DisbursementsTab';
import SchedulesTab from '../components/manager/SchedulesTab';
import InvoicesTab from '../components/manager/InvoicesTab';
import VatTab from '../components/manager/VatTab';
import UndertakingsTab from '../components/manager/UndertakingsTab';
import CommunicationsTab from '../components/manager/CommunicationsTab';
import InterestTab from '../components/manager/InterestTab';
import AuditTab from '../components/manager/AuditTab';
import CampaignsTab from '../components/manager/CampaignsTab';
import FirmPerformanceTab from '../components/manager/FirmPerformanceTab';
import CourtRollTab from '../components/manager/CourtRollTab';
import TemplatesTab from '../components/manager/TemplatesTab';
import RequestsTab from '../components/manager/RequestsTab';
import StaffTab from '../components/manager/StaffTab';
import SettingsTab from '../components/manager/SettingsTab';

export default function Manager() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  const todayStr = new Date().toLocaleDateString('en-CA');
  const [selDate, setSelDate] = useState(todayStr);
  const [summary, setSummary] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [allTime, setAllTime] = useState([]);
  const [selAtty, setSelAtty] = useState('all');
  const [selBranch, setSelBranch] = useState('all');
  const [branches, setBranches] = useState([]);
  const [clock, setClock] = useState('');
  const [trustTxns, setTrustTxns] = useState([]);
  const [trustBalances, setTrustBalances] = useState({});
  const [pendingPayments, setPendingPayments] = useState([]);
  const [trustAlert, setTrustAlert] = useState({ msg: '', type: '' });
  const [matters, setMatters] = useState([]);
  const [invoicePayments, setInvoicePayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [ficaRecords, setFicaRecords] = useState([]);
  const [disbursements, setDisbursements] = useState([]);
  const [feeSchedules, setFeeSchedules] = useState([]);
  const [disbForm, setDisbForm] = useState({ matter_id: '', date: todayStr, category: 'copies', description: '', amount: '', quantity: 1, vat_applicable: false, reference: '' });
  const [showDisbForm, setShowDisbForm] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ fullName: '', email: '', role: 'attorney', title: '', branchId: '' });
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState({ msg: '', type: '' });
  const rate = 150;
  const [overviewPeriod, setOverviewPeriod] = useState('day');
  const [creditNotes, setCreditNotes] = useState([]);
  const [showCNForm, setShowCNForm] = useState(false);
  const [cnInvoice, setCnInvoice] = useState(null);
  const [cnForm, setCnForm] = useState({ amount: '', reason: '' });
  const [savingCN, setSavingCN] = useState(false);
  const [emailingInv, setEmailingInv] = useState(null);
  const [undertakings, setUndertakings] = useState([]);
  const [showUTForm, setShowUTForm] = useState(false);
  const [utForm, setUtForm] = useState({ matter_id: '', direction: 'given', description: '', given_to: '', due_date: '', notes: '' });
  const [communications, setCommunications] = useState([]);
  const [showCommForm, setShowCommForm] = useState(false);
  const [commForm, setCommForm] = useState({ client_id: '', matter_id: '', comm_type: 'call', direction: 'outbound', subject: '', body: '', comm_date: new Date().toLocaleDateString('en-CA') });
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [mgrNotesMatter, setMgrNotesMatter] = useState(null);
  const [mgrNotesMap, setMgrNotesMap] = useState({});
  const [mgrNoteText, setMgrNoteText] = useState('');
  const [mgrNoteType, setMgrNoteType] = useState('general');
  const [savingMgrNote, setSavingMgrNote] = useState(false);
  const [closingMatter, setClosingMatter] = useState(null);
  const [closureForm, setClosureForm] = useState({ closure_notes: '' });
  const [clientRequests, setClientRequests] = useState([]);
  const [showPayPlan, setShowPayPlan] = useState(false);
  const [payPlanInv, setPayPlanInv] = useState(null);
  const [payPlanForm, setPayPlanForm] = useState({ instalment: '', frequency: 'monthly', start_date: new Date().toLocaleDateString('en-CA'), notes: '' });
  const [savingPlan, setSavingPlan] = useState(false);
  const [showOppForm, setShowOppForm] = useState(false);
  const [oppMatter, setOppMatter] = useState(null);
  const [oppForm, setOppForm] = useState({ opposing_party: '', opposing_attorney: '', opposing_firm: '' });
  const [appUrl] = useState(typeof window !== 'undefined' ? window.location.origin : '');
  const [editingTitle, setEditingTitle] = useState({});
  const [schedForm, setSchedForm] = useState({ name: '', unit_rate: 150, description: '', is_default: false });
  const [showSchedForm, setShowSchedForm] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      const p = await getProfile(data.session.user.id);
      const isManager = p?.role === 'manager' || p?.role === 'national_manager' || p?.role === 'branch_manager' || data.session.user.email === 'livhuwaningwn@gmail.com';
      if (!isManager) { router.replace('/'); return; }
      setProfile(p || { full_name: data.session.user.email, role: 'manager' });
      setLoading(false);
    });
  }, []);

  const load = useCallback(async () => {
    const [sumRes, profRes, invRes, branchRes, trustRes, matRes, payRes, cliRes, ficaRes, disbRes, schedRes] = await Promise.all([
      fetchManagerSummary(selDate),
      fetchAllProfiles(),
      fetchInvoices(null),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
      supabase.from('trust_transactions').select('*').order('date', { ascending: false }),
      supabase.from('matters').select('*').order('created_at', { ascending: false }),
      fetchInvoicePayments(),
      fetchClients({}),
      fetchAllFicaRecords(),
      fetchDisbursements({ all: true }),
      fetchFeeSchedules(),
    ]);
    if (sumRes.summary) setSummary(sumRes.summary);
    if (sumRes.allTime) setAllTime(sumRes.allTime);
    if (profRes.profiles) setProfiles(profRes.profiles);
    if (invRes.invoices) setInvoices(invRes.invoices || []);
    setInvoicePayments(payRes.payments || []);
    setClients(cliRes.clients || []);
    setFicaRecords(ficaRes.records || []);
    setDisbursements(disbRes.disbursements || []);
    setFeeSchedules(schedRes.schedules || []);
    setBranches(branchRes.data || []);
    setMatters(matRes.data || []);
    const txns = trustRes.data || [];
    setTrustTxns(txns);
    setPendingPayments(txns.filter(t => t.status === 'pending'));
    const bals = {};
    txns.filter(t => t.status === 'posted').forEach(t => {
      if (!bals[t.matter_id]) bals[t.matter_id] = 0;
      if (t.type === 'receipt') bals[t.matter_id] += Number(t.amount);
      else bals[t.matter_id] -= Number(t.amount);
    });
    setTrustBalances(bals);
  }, [selDate]);

  useEffect(() => { if (!loading) { load(); const t = setInterval(load, 30000); return () => clearInterval(t); } }, [loading, load]);

  useEffect(() => {
    if (tab === 'undertakings' && !loading) fetchUndertakings({}).then(r => setUndertakings(r.undertakings || []));
    if (tab === 'communications' && !loading) fetchClientCommunications({}).then(r => setCommunications(r.communications || []));
    if (tab === 'audit' && !loading) { setAuditLoading(true); fetchAuditLog({}).then(r => { setAuditLogs(r.logs || []); setAuditLoading(false); }); }
    if (tab === 'requests' && !loading) supabase.from('client_requests').select('*').order('created_at', { ascending: false }).then(({ data }) => setClientRequests(data || []));
  }, [tab, loading]);

  function getPeriodActs(acts) {
    if (!acts || !acts.length) return [];
    try {
      if (overviewPeriod === 'day') return acts.filter(a => a.date === selDate);
      if (overviewPeriod === 'week') {
        const d = new Date(selDate + 'T12:00:00');
        const day = d.getDay() === 0 ? 7 : d.getDay();
        const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
        const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
        const start = monday.toLocaleDateString('en-CA');
        const end = sunday.toLocaleDateString('en-CA');
        return acts.filter(a => a.date >= start && a.date <= end);
      }
      if (overviewPeriod === 'month') return acts.filter(a => a.date && a.date.startsWith(selDate.substring(0, 7)));
      return acts;
    } catch (e) { return acts; }
  }

  function getPeriodInvoices(invs) {
    if (overviewPeriod === 'all') return invs;
    if (overviewPeriod === 'day') return invs.filter(i => i.created_at?.substring(0, 10) === selDate);
    if (overviewPeriod === 'week') {
      const d = new Date(selDate + 'T12:00:00');
      const day = d.getDay() === 0 ? 7 : d.getDay();
      const monday = new Date(d); monday.setDate(d.getDate() - day + 1);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      const start = monday.toLocaleDateString('en-CA');
      const end = sunday.toLocaleDateString('en-CA');
      return invs.filter(i => { const dt = i.created_at?.substring(0, 10) || ''; return dt >= start && dt <= end; });
    }
    if (overviewPeriod === 'month') return invs.filter(i => i.created_at?.substring(0, 7) === selDate.substring(0, 7));
    return invs;
  }

  function showAlert(msg, type = 'success') { setTrustAlert({ msg, type }); setTimeout(() => setTrustAlert({ msg: '', type: '' }), 60000); }

  async function handleSaveCreditNote() {
    if (!cnForm.amount || !cnForm.reason.trim() || !cnInvoice) return;
    setSavingCN(true);
    const { error } = await saveCreditNote({ invoiceId: cnInvoice.id, client: cnInvoice.client, matterId: cnInvoice.matter_id, amount: cnForm.amount, reason: cnForm.reason }, profile?.id);
    setSavingCN(false);
    if (error) { showAlert('Error: ' + error.message, 'error'); return; }
    const { creditNotes: cn } = await fetchCreditNotes(null);
    setCreditNotes(cn);
    setShowCNForm(false); setCnInvoice(null); setCnForm({ amount: '', reason: '' });
    showAlert('✓ Credit note issued.');
    await logAudit('credit_note_issued', 'invoice', cnInvoice.id, { amount: cnForm.amount, reason: cnForm.reason }, profile?.id);
  }

  async function handleEmailInvoice(inv, customEmail) {
    setEmailingInv(inv.id);
    const res = await fetch('/api/send-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: inv.id, recipientEmail: customEmail || '' }) });
    const data = await res.json();
    setEmailingInv(null);
    if (!res.ok) { showAlert('Could not send: ' + (data.error || 'Unknown error'), 'error'); return; }
    showAlert(data.warning || `✓ Invoice emailed to ${data.sentTo}`);
    await logAudit('invoice_emailed', 'invoice', inv.id, { sentTo: customEmail }, profile?.id);
  }

  async function loadMgrNotes(matterId) { const { notes } = await fetchMatterNotes(matterId); setMgrNotesMap(m => ({ ...m, [matterId]: notes })); }
  async function handleSaveMgrNote(matterId) { if (!mgrNoteText.trim()) return; setSavingMgrNote(true); const { data, error } = await saveMatterNote({ matterId, note: mgrNoteText.trim(), noteType: mgrNoteType }, profile?.id); setSavingMgrNote(false); if (error) return; setMgrNoteText(''); setMgrNotesMap(m => ({ ...m, [matterId]: [data, ...(m[matterId] || [])] })); }
  async function handleCloseMatter(m) { if (!closureForm.closure_notes.trim()) { showAlert('Please add closure notes.', 'error'); return; } const { error } = await updateMatter(m.id, { status: 'closed', closure_notes: closureForm.closure_notes, closed_at: new Date().toISOString(), closed_by: profile?.id }); if (error) { showAlert('Error: ' + error.message, 'error'); return; } showAlert(`✓ Matter ${m.id} closed.`); setClosingMatter(null); setClosureForm({ closure_notes: '' }); load(); await logAudit('matter_closed', 'matter', m.id, { notes: closureForm.closure_notes }, profile?.id); }
  async function handleAddInterest(inv) { const age = Math.floor((new Date() - new Date(inv.created_at || 0)) / 86400000); const r = 10.5; const outstanding = Math.max(0, (inv.total_units || 0) * (inv.rate || 150) * 1.15 - invoicePayments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount), 0)); const interest = parseFloat((outstanding * (r / 100) * (age / 365)).toFixed(2)); if (interest <= 0) { showAlert('No interest due.', 'error'); return; } if (!confirm(`Add R${interest} interest charge (${r}% p.a. × ${age} days)?`)) return; const { error } = await saveInterestCharge({ invoiceId: inv.id, amount: interest, ratePercent: r, daysOverdue: age }, profile?.id); if (error) { showAlert('Error: ' + error.message, 'error'); return; } showAlert(`✓ Interest charge of R${interest} added.`); await logAudit('interest_charged', 'invoice', inv.id, { amount: interest, days: age }, profile?.id); }
  async function handleSavePayPlan() { if (!payPlanForm.instalment || !payPlanInv) return; setSavingPlan(true); const total = (payPlanInv.total_units || 0) * (payPlanInv.rate || 150) * 1.15; const months = Math.ceil(total / parseFloat(payPlanForm.instalment)); const { error } = await supabase.from('payment_plans').insert([{ invoice_id: payPlanInv.id, client_id: payPlanInv.client_id || null, total_amount: total, instalment: parseFloat(payPlanForm.instalment), frequency: payPlanForm.frequency, start_date: payPlanForm.start_date, notes: payPlanForm.notes, created_by: profile?.id }]); setSavingPlan(false); if (error) { showAlert('Error: ' + error.message, 'error'); return; } showAlert(`✓ Payment plan created — ${months} instalments of R${payPlanForm.instalment}`); setShowPayPlan(false); setPayPlanInv(null); }
  async function handleSaveOpp() { if (!oppMatter) return; const { error } = await supabase.from('matters').update({ opposing_party: oppForm.opposing_party, opposing_attorney: oppForm.opposing_attorney, opposing_firm: oppForm.opposing_firm }).eq('id', oppMatter.id); if (error) { showAlert('Error: ' + error.message, 'error'); return; } showAlert('✓ Opposing party saved.'); setShowOppForm(false); load(); }
  async function sendSatisfactionRequest(matter) { const res = await fetch('/api/send-satisfaction-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matterId: matter.id, clientId: matter.client_id || null, attorneyId: matter.user_id, appUrl }) }); const data = await res.json(); if (!res.ok) { showAlert('Could not send: ' + (data.error || 'No client email'), 'error'); return; } showAlert('✓ Satisfaction survey sent to client.'); }
  async function updateFicaRisk(clientId, rating) { await supabase.from('clients').update({ risk_rating: rating }).eq('id', clientId); showAlert('✓ Risk rating updated.'); load(); }
  async function sendOverdueReminders() { const now = new Date(); const overdue = invoices.filter(inv => { const age = Math.floor((now - new Date(inv.created_at || 0)) / 86400000); const paid = invoicePayments.filter(p => p.invoice_id === inv.id).reduce((s, p) => s + Number(p.amount), 0); return age > 30 && Math.max(0, (inv.total_units || 0) * (inv.rate || 150) * 1.15 - paid) > 0 && !inv.written_off; }); if (!overdue.length) { showAlert('No overdue invoices to remind.', 'error'); return; } let sent = 0; for (const inv of overdue) { const res = await fetch('/api/send-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ invoiceId: inv.id, type: 'reminder' }) }); if (res.ok) sent++; } showAlert(`✓ Sent ${sent} overdue reminders.`); }
  async function approvePayment(id) { const { error } = await supabase.from('trust_transactions').update({ status: 'posted', approved_by: profile?.id, approved_at: new Date().toISOString() }).eq('id', id); if (error) { showAlert('Error: ' + error.message, 'error'); return; } showAlert('✓ Payment approved and posted.'); load(); }
  async function rejectPayment(id, reason) { const { error } = await supabase.from('trust_transactions').update({ status: 'rejected', rejection_reason: reason || 'Rejected by manager' }).eq('id', id); if (error) { showAlert('Error: ' + error.message, 'error'); return; } showAlert('Payment rejected.'); load(); }
  async function assignBranch(userId, branchId) { const { error } = await supabase.from('profiles').update({ branch_id: branchId }).eq('id', userId); if (error) { showAlert('Error: ' + error.message, 'error'); return; } showAlert('✓ Branch updated.'); load(); }
  async function saveTitle(userId, title) { await supabase.from('profiles').update({ title }).eq('id', userId); setProfiles(prev => prev.map(p => p.id === userId ? { ...p, title } : p)); setEditingTitle(prev => ({ ...prev, [userId]: false })); showAlert('✓ Title updated.'); }
  async function removeStaff(userId, name) { if (!confirm(`Remove ${name} from the system? This cannot be undone.`)) return; const { data: { session } } = await supabase.auth.getSession(); const res = await fetch('/api/remove-staff', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ userId }) }); const data = await res.json(); if (!res.ok) { showAlert('Error: ' + data.error, 'error'); return; } showAlert(`✓ ${name} removed.`); load(); }

  async function handleInvite() {
    if (!inviteForm.fullName || !inviteForm.email || !inviteForm.branchId) { setInviteMsg({ msg: 'Please fill in all fields.', type: 'error' }); return; }
    setInviting(true); setInviteMsg({ msg: '', type: '' });
    const res = await fetch('/api/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...inviteForm, inviterRole: profile?.role }) });
    const result = await res.json();
    if (!res.ok) { setInviteMsg({ msg: 'Error: ' + (result.error || 'Failed'), type: 'error' }); setInviting(false); return; }
    const branchName = branches.find(b => b.id === inviteForm.branchId)?.name || 'the firm';
    const tempPassword = result.tempPassword || '';
    if (tempPassword) await fetch('/api/send-staff-credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: inviteForm.fullName, email: inviteForm.email, role: inviteForm.role, tempPassword, branchName }) });
    showAlert(`✓ ${inviteForm.fullName} added to ${branchName}. Login details emailed to ${inviteForm.email}. Temporary password: ${tempPassword} — shown here as backup.`);
    setInviting(false); setShowInvite(false);
    setInviteForm({ fullName: '', email: '', role: 'attorney', title: '', branchId: branches[0]?.id || '' });
    load();
  }

  const isBranchManager = profile?.role === 'branch_manager';
  const myBranch = isBranchManager ? profile?.branch_id : selBranch;
  const filteredProfiles = myBranch === 'all' || !myBranch ? profiles : profiles.filter(p => p.branch_id === myBranch);
  const filteredAllTime = selAtty === 'all' ? allTime : allTime.filter(a => a.user_id === selAtty);
  const filtInvoices = selAtty === 'all' ? invoices : invoices.filter(i => i.user_id === selAtty);
  const billedRevenue = filtInvoices.reduce((s, i) => s + (i.total_units || 0) * (i.rate || 150), 0);

  const branchTrustData = branches.map(b => {
    const bTxns = trustTxns.filter(t => t.branch_id === b.id && t.status === 'posted');
    return { ...b, balance: bTxns.reduce((s, t) => t.type === 'receipt' ? s + Number(t.amount) : s - Number(t.amount), 0), receipts: bTxns.filter(t => t.type === 'receipt').reduce((s, t) => s + Number(t.amount), 0), payments: bTxns.filter(t => t.type === 'payment').reduce((s, t) => s + Number(t.amount), 0), txnCount: bTxns.length };
  });

  if (loading) return <div style={{ background: '#0A0A0A', minHeight: '100vh' }}><SkeletonDashboard /></div>;

  return (
    <>
      <Head><title>MB SmartTrack — Manager</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}table tr:hover td{background:rgba(141,198,63,0.025)}select option{background:#1A1A1A;color:#F0F0F0}input[type=date]{color-scheme:dark}button:hover{opacity:.85}.mb-inp{background:#1A1A1A;border:1px solid #252525;color:#F0F0F0;padding:10px 14px;border-radius:7px;font-size:13px;font-family:'DM Sans',system-ui,sans-serif;width:100%;display:block;}.mb-inp:focus{outline:1px solid rgba(141,198,63,0.5);border-color:rgba(141,198,63,0.4);}.mb-inp option{background:#1A1A1A;color:#F0F0F0;}`}</style>
      <div style={{ background: '#0A0A0A', minHeight: '100vh', fontFamily: "'DM Sans',system-ui,sans-serif", color: '#F0F0F0' }}>
        <NavBar
          role={isBranchManager ? 'branch_manager' : 'manager'}
          tab={tab} setTab={setTab} profile={profile} clock={clock}
          onSignOut={async () => { await signOut(); router.replace('/login'); }}
          pendingCount={pendingPayments.length}
          ficaCount={(() => { const fm = Object.fromEntries(ficaRecords.map(r => [r.client_id, r])); return clients.filter(c => { const r = fm[c.id]; return !r || r.fica_status === 'pending' || r.fica_status === 'expired'; }).length; })()}
        />

        {trustAlert.msg && (
          <div style={{ background: trustAlert.type === 'error' ? 'rgba(220,80,80,0.1)' : 'rgba(141,198,63,0.1)', border: `1px solid ${trustAlert.type === 'error' ? 'rgba(220,80,80,0.4)' : 'rgba(141,198,63,0.3)'}`, padding: '14px 24px', fontSize: 12, color: trustAlert.type === 'error' ? '#E05252' : '#8DC63F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <span style={{ flex: 1 }}>{trustAlert.msg}</span>
            {trustAlert.type === 'success' && trustAlert.msg.includes('Temporary password:') && (
              <button style={{ background: 'rgba(141,198,63,0.2)', border: '1px solid rgba(141,198,63,0.4)', color: '#8DC63F', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', whiteSpace: 'nowrap' }} onClick={() => { const pwd = trustAlert.msg.match(/Temporary password: ([^\s—]+)/)?.[1]; if (pwd) navigator.clipboard.writeText(pwd); }}>📋 Copy Password</button>
            )}
            <button style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', flexShrink: 0 }} onClick={() => setTrustAlert({ msg: '', type: '' })}>✕</button>
          </div>
        )}
        {pendingPayments.length > 0 && tab !== 'trust' && (
          <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', padding: '10px 24px', fontSize: 12, color: '#EAB308', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⏳ {pendingPayments.length} trust payment{pendingPayments.length > 1 ? 's' : ''} pending your approval — {fmtR(pendingPayments.reduce((s, t) => s + Number(t.amount), 0))}</span>
            <button className="mb-btn mb-btn-warn" onClick={() => setTab('trust')}>Review approvals →</button>
          </div>
        )}
        {(() => { const ficaMap = Object.fromEntries(ficaRecords.map(r => [r.client_id, r])); const pending = clients.filter(c => { const r = ficaMap[c.id]; return !r || r.fica_status === 'pending' || r.fica_status === 'expired'; }).length; return pending > 0 && tab !== 'clients' ? (<div style={{ background: 'rgba(220,80,80,0.08)', border: '1px solid rgba(220,80,80,0.25)', padding: '10px 24px', fontSize: 12, color: '#E05252', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>🪪 {pending} client{pending !== 1 ? 's' : ''} with FICA pending or expired</span><button className="mb-btn mb-btn-danger mb-btn-sm" onClick={() => setTab('clients')}>Review →</button></div>) : null; })()}

        {tab === 'overview' && <OverviewTab profiles={profiles} branches={branches} branchTrustData={branchTrustData} allTime={allTime} invoices={invoices} trustBalances={trustBalances} pendingPayments={pendingPayments} isMobile={isMobile} rate={rate} selDate={selDate} setSelDate={setSelDate} overviewPeriod={overviewPeriod} setOverviewPeriod={setOverviewPeriod} selBranch={selBranch} setSelBranch={setSelBranch} selAtty={selAtty} setSelAtty={setSelAtty} isBranchManager={isBranchManager} profile={profile} filteredProfiles={filteredProfiles} filteredAllTime={filteredAllTime} getPeriodActs={getPeriodActs} getPeriodInvoices={getPeriodInvoices} setTab={setTab} />}
        {tab === 'trust' && <TrustTab trustTxns={trustTxns} trustBalances={trustBalances} pendingPayments={pendingPayments} matters={matters} branches={branches} branchTrustData={branchTrustData} isMobile={isMobile} selBranch={selBranch} setSelBranch={setSelBranch} profile={profile} showAlert={showAlert} approvePayment={approvePayment} rejectPayment={rejectPayment} load={load} />}
        {tab === 'analytics' && <AnalyticsTab filteredProfiles={filteredProfiles} branches={branches} allTime={allTime} invoices={invoices} isMobile={isMobile} rate={rate} selDate={selDate} setSelDate={setSelDate} selAtty={selAtty} setSelAtty={setSelAtty} overviewPeriod={overviewPeriod} setOverviewPeriod={setOverviewPeriod} getPeriodActs={getPeriodActs} getPeriodInvoices={getPeriodInvoices} />}
        {tab === 'history' && <HistoryTab allTime={allTime} profiles={profiles} branches={branches} rate={rate} isMobile={isMobile} selAtty={selAtty} setSelAtty={setSelAtty} />}
        {tab === 'wip' && <WipTab allTime={allTime} invoices={invoices} filteredProfiles={filteredProfiles} branches={branches} matters={matters} selBranch={selBranch} setSelBranch={setSelBranch} selAtty={selAtty} setSelAtty={setSelAtty} rate={rate} isMobile={isMobile} />}
        {tab === 'debtors' && <DebtorsTab invoices={invoices} invoicePayments={invoicePayments} isMobile={isMobile} showAlert={showAlert} load={load} profile={profile} todayStr={todayStr} emailingInv={emailingInv} setEmailingInv={setEmailingInv} setCnInvoice={setCnInvoice} setCnForm={setCnForm} setShowCNForm={setShowCNForm} setPayPlanInv={setPayPlanInv} setPayPlanForm={setPayPlanForm} setShowPayPlan={setShowPayPlan} />}
        {tab === 'reports' && <ReportsTab invoices={invoices} invoicePayments={invoicePayments} filteredProfiles={filteredProfiles} branches={branches} isMobile={isMobile} rate={rate} />}
        {tab === 'statements' && <StatementsTab invoices={invoices} invoicePayments={invoicePayments} isMobile={isMobile} profile={profile} />}
        {tab === 'matters' && <MattersTab matters={matters} profiles={profiles} branches={branches} trustBalances={trustBalances} selBranch={selBranch} setSelBranch={setSelBranch} mgrNotesMatter={mgrNotesMatter} setMgrNotesMatter={setMgrNotesMatter} mgrNotesMap={mgrNotesMap} mgrNoteText={mgrNoteText} setMgrNoteText={setMgrNoteText} mgrNoteType={mgrNoteType} setMgrNoteType={setMgrNoteType} savingMgrNote={savingMgrNote} showOppForm={showOppForm} setShowOppForm={setShowOppForm} oppMatter={oppMatter} setOppMatter={setOppMatter} oppForm={oppForm} setOppForm={setOppForm} closingMatter={closingMatter} setClosingMatter={setClosingMatter} closureForm={closureForm} setClosureForm={setClosureForm} handleSaveMgrNote={handleSaveMgrNote} handleCloseMatter={handleCloseMatter} handleSaveOpp={handleSaveOpp} sendSatisfactionRequest={sendSatisfactionRequest} loadMgrNotes={loadMgrNotes} load={load} showAlert={showAlert} />}
        {tab === 'clients' && <ClientsTab clients={clients} ficaRecords={ficaRecords} matters={matters} isMobile={isMobile} showAlert={showAlert} updateFicaRisk={updateFicaRisk} />}
        {tab === 'disbursements' && <DisbursementsTab disbursements={disbursements} matters={matters} showDisbForm={showDisbForm} setShowDisbForm={setShowDisbForm} disbForm={disbForm} setDisbForm={setDisbForm} todayStr={todayStr} profile={profile} showAlert={showAlert} load={load} />}
        {tab === 'schedules' && <SchedulesTab feeSchedules={feeSchedules} showAlert={showAlert} load={load} />}
        {tab === 'invoices' && <InvoicesTab invoices={filtInvoices} isMobile={isMobile} billedRevenue={billedRevenue} />}
        {tab === 'vat' && <VatTab invoices={invoices} disbursements={disbursements} profile={profile} isMobile={isMobile} showAlert={showAlert} />}
        {tab === 'undertakings' && <UndertakingsTab undertakings={undertakings} setUndertakings={setUndertakings} showUTForm={showUTForm} setShowUTForm={setShowUTForm} utForm={utForm} setUtForm={setUtForm} matters={matters} showAlert={showAlert} isMobile={isMobile} />}
        {tab === 'communications' && <CommunicationsTab communications={communications} setCommunications={setCommunications} showCommForm={showCommForm} setShowCommForm={setShowCommForm} commForm={commForm} setCommForm={setCommForm} clients={clients} matters={matters} profile={profile} showAlert={showAlert} />}
        {tab === 'interest' && <InterestTab invoices={invoices} invoicePayments={invoicePayments} profile={profile} showAlert={showAlert} load={load} />}
        {tab === 'audit' && <AuditTab auditLogs={auditLogs} auditLoading={auditLoading} setAuditLogs={setAuditLogs} setAuditLoading={setAuditLoading} />}
        {tab === 'campaigns' && <CampaignsTab matters={matters} clients={clients} isMobile={isMobile} showAlert={showAlert} />}
        {tab === 'firmperformance' && <FirmPerformanceTab allTime={allTime} profiles={profiles} branches={branches} invoices={invoices} isMobile={isMobile} showAlert={showAlert} />}
        {tab === 'courtroll' && <CourtRollTab matters={matters} profiles={profiles} isMobile={isMobile} />}
        {tab === 'templates' && <TemplatesTab matters={matters} profiles={profiles} />}
        {tab === 'requests' && <RequestsTab clientRequests={clientRequests} setClientRequests={setClientRequests} profile={profile} showAlert={showAlert} isMobile={isMobile} />}
        {tab === 'staff' && <StaffTab profiles={profiles} branches={branches} isMobile={isMobile} showAlert={showAlert} load={load} isBranchManager={isBranchManager} showInvite={showInvite} setShowInvite={setShowInvite} inviteForm={inviteForm} setInviteForm={setInviteForm} inviting={inviting} setInviting={setInviting} inviteMsg={inviteMsg} setInviteMsg={setInviteMsg} editingTitle={editingTitle} setEditingTitle={setEditingTitle} handleInvite={handleInvite} removeStaff={removeStaff} assignBranch={assignBranch} saveTitle={saveTitle} />}
        {tab === 'settings' && <SettingsTab profile={profile} isMobile={isMobile} />}

        {/* Global modals: Credit Note, Payment Plan */}
        {showCNForm && cnInvoice && (
          <div className="mb-overlay" onClick={() => setShowCNForm(false)}>
            <div className="mb-modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Issue Credit Note</div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 16 }}>Against invoice <strong style={{ color: '#F0F0F0' }}>{cnInvoice.id}</strong> · {cnInvoice.client} · {fmtR((cnInvoice.total_units || 0) * (cnInvoice.rate || 150) * 1.15)} incl. VAT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label className="mb-lbl">Credit amount (R) *</label><input className="mb-inp" type="number" placeholder="0.00" value={cnForm.amount} onChange={e => setCnForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><label className="mb-lbl">Reason *</label><textarea className="mb-inp" style={{ minHeight: 70, resize: 'vertical' }} placeholder="Reason for credit note..." value={cnForm.reason} onChange={e => setCnForm(f => ({ ...f, reason: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="mb-btn" onClick={() => setShowCNForm(false)}>Cancel</button>
                <button className="mb-btn mb-btn-primary" disabled={savingCN || !cnForm.amount || !cnForm.reason.trim()} onClick={handleSaveCreditNote}>{savingCN ? 'Saving…' : 'Issue Credit Note'}</button>
              </div>
            </div>
          </div>
        )}

        {showPayPlan && payPlanInv && (
          <div className="mb-overlay" onClick={() => setShowPayPlan(false)}>
            <div className="mb-modal-box" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Payment Plan — {payPlanInv.id}</div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>{payPlanInv.client} · Total: {fmtR((payPlanInv.total_units || 0) * (payPlanInv.rate || 150) * 1.15)} incl. VAT</div>
              {payPlanForm.instalment && <div style={{ fontSize: 11, color: '#8DC63F', marginBottom: 12 }}>≈ {Math.ceil((payPlanInv.total_units || 0) * (payPlanInv.rate || 150) * 1.15 / parseFloat(payPlanForm.instalment))} instalments of R{payPlanForm.instalment}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label className="mb-lbl">Monthly Instalment (R) *</label><input className="mb-inp" type="number" placeholder="e.g. 2500" value={payPlanForm.instalment} onChange={e => setPayPlanForm(f => ({ ...f, instalment: e.target.value }))} /></div>
                  <div><label className="mb-lbl">Frequency</label><select className="mb-inp" value={payPlanForm.frequency} onChange={e => setPayPlanForm(f => ({ ...f, frequency: e.target.value }))}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select></div>
                </div>
                <div><label className="mb-lbl">Start Date</label><input className="mb-inp" type="date" value={payPlanForm.start_date} onChange={e => setPayPlanForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div><label className="mb-lbl">Notes</label><input className="mb-inp" placeholder="e.g. Agreed telephonically" value={payPlanForm.notes} onChange={e => setPayPlanForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button className="mb-btn" onClick={() => setShowPayPlan(false)}>Cancel</button>
                <button className="mb-btn mb-btn-primary" disabled={savingPlan || !payPlanForm.instalment} onClick={handleSavePayPlan}>{savingPlan ? 'Saving…' : 'Create Plan'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

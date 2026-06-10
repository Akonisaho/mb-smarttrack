import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../components/Toast';
import { useRouter } from 'next/router';
import Fuse from 'fuse.js';
import NavBar from '../components/NavBar';
import { useFirmSettings } from '../lib/useFirmSettings';
import { generateDetailedInvoicePDF } from '../lib/generateInvoicePDF';
import Head from 'next/head';
import { SkeletonDashboard } from '../components/Skeleton';
import { calcUnits, calcAmt, appIcon, toHm, fdate, fmonth, fmtR } from '../lib/format';

import TodayTab from '../components/attorney/TodayTab';
import ActivitiesTab from '../components/attorney/ActivitiesTab';
import HistoryTab from '../components/attorney/HistoryTab';
import MattersTab from '../components/attorney/MattersTab';
import InvoicesTab from '../components/attorney/InvoicesTab';
import ArchiveTab from '../components/attorney/ArchiveTab';
import AnalyticsTab from '../components/attorney/AnalyticsTab';
import PerformanceTab from '../components/attorney/PerformanceTab';
import TrustTab from '../components/attorney/TrustTab';
import UndertakingsTab from '../components/attorney/UndertakingsTab';
import CommunicationsTab from '../components/attorney/CommunicationsTab';
import DisbursementsTab from '../components/attorney/DisbursementsTab';
import InvoiceDoc from '../components/attorney/InvoiceDoc';

import {
  supabase, signOut, getProfile,
  fetchActivities, fetchAllActivities, patchActivity, patchActivityMatter,
  fetchMatters, createMatter, deleteMatter,
  fetchInvoices, saveInvoice, deleteInvoice,
  fetchHistory, fetchMonthActivities,
  fetchDisbursements,
  fetchMatterNotes, saveMatterNote, deleteMatterNote,
  fetchCreditNotes, saveCreditNote,
  writeOffInvoice, undoWriteOff,
  fetchUndertakings,
  fetchClientCommunications,
  updateMatter,
  searchAll,
  fetchPerformanceFeedback, savePerformanceFeedback, markFeedbackRead,
  fetchPerformanceReviews,
} from '../lib/supabase';

export default function App() {
  const today = new Date().toLocaleDateString('en-CA');
  const router = useRouter();
  const toast = useToast();
  const firm = useFirmSettings();

  // ── Auth ──────────────────────────────────────────────────────────
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ── Navigation ────────────────────────────────────────────────────
  const [tab, setTab] = useState('today');
  const [online, setOnline] = useState(false);
  const [clock, setClock] = useState('');

  // ── Activities ────────────────────────────────────────────────────
  const [liveActs, setLiveActs] = useState([]);
  const [allActs, setAllActs] = useState([]);
  const [dates, setDates] = useState([]);
  const [selDate, setSelDate] = useState(today);
  const [analyticsPeriod, setAP] = useState('day');

  // ── Matters ───────────────────────────────────────────────────────
  const [matters, setMatters] = useState([]);
  const [allMatters, setAllMatters] = useState([]);

  // ── Invoices ──────────────────────────────────────────────────────
  const [invoices, setInvoices] = useState([]);
  const [invMatterId, setInvMatterId] = useState('');
  const [invAtty, setInvAtty] = useState('');
  const [invRate, setInvRate] = useState(150);
  const [invPeriod, setInvPeriod] = useState('day');
  const [preview, setPreview] = useState(null);
  const [viewInv, setViewInv] = useState(null);
  const [archFilter, setArchFilter] = useState('');
  const [emailingInv, setEmailingInv] = useState(null);

  // ── Credit notes ──────────────────────────────────────────────────
  const [creditNotes, setCreditNotes] = useState([]);
  const [showCNForm, setShowCNForm] = useState(false);
  const [cnInvoice, setCnInvoice] = useState(null);
  const [cnForm, setCnForm] = useState({ amount: '', reason: '' });
  const [savingCN, setSavingCN] = useState(false);

  // ── Search ────────────────────────────────────────────────────────
  const searchRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // ── History ───────────────────────────────────────────────────────
  const [histYear, setHistYear] = useState(new Date().getFullYear());
  const [histMonths, setHistMonths] = useState([]);
  const [histYears, setHistYears] = useState([]);
  const [selMonth, setSelMonth] = useState(null);
  const [monthData, setMonthData] = useState(null);

  // ── Disbursements ─────────────────────────────────────────────────
  const [disbursements, setDisbursements] = useState([]);
  const [disbForm, setDisbForm] = useState({ matter_id: '', date: today, category: 'copies', description: '', amount: '', quantity: 1, vat_applicable: false, reference: '' });
  const [showDisbForm, setShowDisbForm] = useState(false);

  // ── Call log modal ────────────────────────────────────────────────
  const [showCall, setShowCall] = useState(false);
  const [callForm, setCallForm] = useState({ description: '', matterId: '', durationMins: 6, date: today });
  const [callSaving, setCallSaving] = useState(false);

  // ── Matter form ───────────────────────────────────────────────────
  const [showMatterForm, setShowMatterForm] = useState(false);
  const [matterForm, setMatterForm] = useState({ id: '', name: '', client: '', description: '' });
  const [matterSaving, setMatterSaving] = useState(false);
  const [matterMsg, setMatterMsg] = useState('');

  // ── Password change ───────────────────────────────────────────────
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState({ msg: '', type: '' });
  const [pwdSaving, setPwdSaving] = useState(false);

  // ── Matter notes ──────────────────────────────────────────────────
  const [openNotesMatter, setOpenNotesMatter] = useState(null);
  const [matterNotesMap, setMatterNotesMap] = useState({});
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [savingNote, setSavingNote] = useState(false);

  // ── Activities filters (for ActivitiesTab) ────────────────────────
  const [filterCls, setFilterCls] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterApp, setFilterApp] = useState('');

  // ── Undertakings ──────────────────────────────────────────────────
  const [undertakings, setUndertakings] = useState([]);
  const [showUTForm, setShowUTForm] = useState(false);
  const [utForm, setUtForm] = useState({ matter_id: '', direction: 'given', description: '', given_to: '', due_date: '', notes: '' });

  // ── Communications ────────────────────────────────────────────────
  const [communications, setCommunications] = useState([]);
  const [showCommForm, setShowCommForm] = useState(false);
  const [commForm, setCommForm] = useState({ client_id: '', matter_id: '', comm_type: 'call', direction: 'outbound', subject: '', body: '', comm_date: today });

  // ── HR Performance feedback ───────────────────────────────────────
  const [perfFeedback, setPerfFeedback] = useState([]);
  const [openReviews, setOpenReviews] = useState([]);
  const [selfSubmitted, setSelfSubmitted] = useState({});
  const [branchColleagues, setBranchColleagues] = useState([]);
  const [peerReviewedIds, setPeerReviewedIds] = useState([]);

  // ── Trust ─────────────────────────────────────────────────────────
  const [trustTransactions, setTrustTransactions] = useState([]);
  const [trustAccounts, setTrustAccounts] = useState([]);
  const [trustBalances, setTrustBalances] = useState({});
  const [trustLoading, setTrustLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [lockedPeriods, setLockedPeriods] = useState([]);
  const [balanceAlerts, setBalanceAlerts] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);

  const userId = user?.id || null;

  // ── Clock ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Auth check ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/login'); return; }
      const u = data.session.user; setUser(u);
      const p = await getProfile(u.id); setProfile(p);
      if (p?.rate) setInvRate(Number(p.rate) || 150);
      if (p?.full_name) setInvAtty(p.full_name);
      if (p?.role === 'manager' || p?.role === 'national_manager') { router.replace(p?.password_changed === false ? '/change-password' : '/manager'); return; }
      if (p?.role === 'branch_manager') { router.replace(p?.password_changed === false ? '/change-password' : '/manager'); return; }
      if (p?.role === 'bookkeeper') { router.replace(p?.password_changed === false ? '/change-password' : '/bookkeeper'); return; }
      if (p?.role === 'receptionist') { router.replace(p?.password_changed === false ? '/change-password' : '/receptionist'); return; }
      if (p?.role === 'hr') { router.replace(p?.password_changed === false ? '/change-password' : '/hr'); return; }
      if (p?.password_changed === false) { router.replace('/change-password'); return; }
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Performance feedback ──────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !userId) return;
    const load = async () => {
      const [{ feedback: rcvd }, { feedback: sent }] = await Promise.all([fetchPerformanceFeedback({ toUserId: userId }), fetchPerformanceFeedback({ fromUserId: userId })]);
      setPerfFeedback([...(rcvd || []), ...(sent || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    };
    load();
  }, [authLoading, userId]);

  // ── Performance reviews & peer review ────────────────────────────
  useEffect(() => {
    if (authLoading || !userId) return;
    fetchPerformanceReviews().then(async ({ reviews }) => {
      const open = (reviews || []).filter(r => r.status === 'open');
      setOpenReviews(open);
      if (!open.length) return;
      const submitted = {};
      await Promise.all(open.map(async rv => {
        const { data } = await supabase.from('feedback_360').select('id').eq('subject_id', userId).eq('reviewer_id', userId).eq('reviewer_type', 'self').eq('period', rv.period).maybeSingle();
        submitted[rv.id] = !!data;
      }));
      setSelfSubmitted(submitted);
      const periods = [...new Set(open.map(r => r.period))];
      const { data: reviewed } = await supabase.from('feedback_360').select('subject_id').eq('reviewer_id', userId).eq('reviewer_type', 'peer').in('period', periods);
      setPeerReviewedIds((reviewed || []).map(r => r.subject_id));
    });
  }, [authLoading, userId]);

  // ── Branch colleagues for peer review ────────────────────────────
  useEffect(() => {
    if (!profile?.branch_id || !userId) return;
    supabase.from('profiles').select('id,full_name,role').eq('branch_id', profile.branch_id).neq('id', userId).in('role', ['attorney', 'branch_manager', 'manager', 'national_manager']).then(({ data }) => setBranchColleagues(data || []));
  }, [profile?.branch_id, userId]);

  // ── Main data load ────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    const doLoad = async () => {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s) { router.replace('/login'); return; }
      const [liveRes, allRes, invRes, matRes] = await Promise.all([fetchActivities({ date: selDate, userId }), fetchAllActivities({ userId }), fetchInvoices(userId), fetchMatters(userId)]);
      if (cancelled) return;
      setOnline(true);
      setLiveActs((liveRes.activities || []).sort((a, b) => a.start_time - b.start_time));
      setAllActs(allRes.activities || []);
      setInvoices(invRes.invoices || []);
      setMatters(matRes.matters || []);
      const dmap = {}; (allRes.activities || []).forEach(a => { if (!dmap[a.date]) dmap[a.date] = { date: a.date, sessions: 0 }; dmap[a.date].sessions++; });
      setDates(Object.values(dmap).sort((a, b) => b.date.localeCompare(a.date)));
      const disbRes = await fetchDisbursements({ userId, all: false });
      setDisbursements(disbRes.disbursements || []);
    };
    doLoad();
    const t = setInterval(doLoad, 120000);
    return () => { cancelled = true; clearInterval(t); };
  }, [authLoading, userId, selDate]);

  const load = useCallback(async () => {
    if (!userId) return;
    const [liveRes, allRes, invRes, matRes] = await Promise.all([fetchActivities({ date: selDate, userId }), fetchAllActivities({ userId }), fetchInvoices(userId), fetchMatters(userId)]);
    setOnline(true);
    setLiveActs((liveRes.activities || []).sort((a, b) => a.start_time - b.start_time));
    setAllActs(allRes.activities || []);
    setInvoices(invRes.invoices || []);
    setMatters(matRes.matters || []);
    const dmap = {}; (allRes.activities || []).forEach(a => { if (!dmap[a.date]) dmap[a.date] = { date: a.date, sessions: 0 }; dmap[a.date].sessions++; });
    setDates(Object.values(dmap).sort((a, b) => b.date.localeCompare(a.date)));
  }, [userId, selDate]);

  // ── Trust data load ───────────────────────────────────────────────
  const loadTrust = useCallback(async () => {
    if (!userId) return;
    const { data: { session: s } } = await supabase.auth.getSession();
    if (!s) { router.replace('/login'); return; }
    setTrustLoading(true);
    try {
      const [accsRes, txnsRes, branchRes, locksRes, alertsRes] = await Promise.all([
        supabase.from('trust_accounts').select('*').eq('is_active', true).order('name'),
        supabase.from('trust_transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('branches').select('*').eq('is_active', true).order('name'),
        supabase.from('trust_period_locks').select('*').order('period', { ascending: false }),
        supabase.from('trust_balance_alerts').select('*'),
      ]);
      const accs = accsRes.data || [], txns = txnsRes.data || [];
      setTrustAccounts(accs);
      setBranches(branchRes.data || []);
      setLockedPeriods((locksRes.data || []).map(l => l.period));
      setBalanceAlerts(alertsRes.data || []);
      const allMat = await fetchMatters(null, true);
      setAllMatters(allMat.matters || []);
      setTrustTransactions(txns);
      setPendingPayments(txns.filter(t => t.status === 'pending'));
      const bals = {};
      txns.filter(t => t.status === 'posted').forEach(t => {
        if (!bals[t.matter_id]) bals[t.matter_id] = 0;
        if (t.type === 'receipt') bals[t.matter_id] += Number(t.amount);
        else bals[t.matter_id] -= Number(t.amount);
      });
      setTrustBalances(bals);
    } catch (e) { console.error('loadTrust:', e.message); }
    setTrustLoading(false);
  }, [userId]);

  useEffect(() => {
    if ((tab === 'trust' || tab === 'invoices') && userId) {
      loadTrust();
      const t = setInterval(loadTrust, 300000);
      return () => clearInterval(t);
    }
  }, [tab, userId]);

  // ── Tab-specific loads ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    if (tab === 'undertakings') fetchUndertakings({ userId }).then(r => setUndertakings(r.undertakings || []));
    if (tab === 'communications') fetchClientCommunications({ userId }).then(r => setCommunications(r.communications || []));
  }, [tab, userId]);

  useEffect(() => {
    if (tab !== 'history' || !userId) return;
    fetchHistory(histYear, userId).then(res => { if (res.months) setHistMonths(res.months); setHistYears([...new Set(allActs.map(a => a.date?.substring(0, 4)).filter(Boolean))].sort((a, b) => b - a)); });
  }, [tab, histYear, userId]);

  // ── Search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const t = setTimeout(async () => {
      if (!userId) return;
      setSearching(true);
      const res = await searchAll(searchQuery.trim(), userId);
      const fuseA = new Fuse(res.activities || [], { keys: ['window_title', 'app_display_name', 'matter'], threshold: 0.4 });
      const fuseM = new Fuse(res.matters || [], { keys: ['name', 'client', 'id'], threshold: 0.3 });
      const fuseI = new Fuse(res.invoices || [], { keys: ['client', 'matter_name', 'id'], threshold: 0.3 });
      const q = searchQuery.toLowerCase();
      const fA = fuseA.search(q).map(r => r.item), fM = fuseM.search(q).map(r => r.item), fI = fuseI.search(q).map(r => r.item);
      const aS = new Set(fA.map(a => a.id)), mS = new Set(fM.map(m => m.id)), iS = new Set(fI.map(i => i.id));
      setSearchResults({ activities: [...fA, ...(res.activities || []).filter(a => !aS.has(a.id))].slice(0, 40), matters: [...fM, ...(res.matters || []).filter(m => !mS.has(m.id))], invoices: [...fI, ...(res.invoices || []).filter(i => !iS.has(i.id))], query: searchQuery });
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, userId]);

  // ── Handlers ──────────────────────────────────────────────────────
  const loadMonth = (month) => {
    if (!userId) return;
    setSelMonth(month);
    fetchMonthActivities(month, userId).then(res => {
      if (!res.activities) return;
      const acts = res.activities, tSec = acts.reduce((s, a) => s + Number(a.duration_seconds || 0), 0), bSec = acts.filter(a => a.is_billable).reduce((s, a) => s + Number(a.duration_seconds || 0), 0), bU = acts.filter(a => a.is_billable).reduce((s, a) => s + Number(a.billing_units || 0), 0);
      setMonthData({ activities: acts, totals: { sessions: acts.length, total_seconds: tSec, billable_seconds: bSec, billable_units: bU } });
    });
  };

  async function reclassify(id, cls) { const act = [...allActs, ...liveActs].find(a => a.id === id); const units = cls === 'billable' ? Math.max(1, Math.ceil((act?.duration_seconds || 0) / 360)) : 0; await patchActivity(id, { classification: cls, billing_units: units, is_billable: cls === 'billable' }); load(); }
  async function assignMatter(actId, matterId) { await patchActivityMatter(actId, matterId); load(); }

  async function loadNotes(matterId) { const { notes } = await fetchMatterNotes(matterId); setMatterNotesMap(m => ({ ...m, [matterId]: notes })); }
  async function handleSaveNote(matterId) {
    if (!noteText.trim()) return;
    setSavingNote(true);
    const { data, error } = await saveMatterNote({ matterId, note: noteText.trim(), noteType }, userId);
    setSavingNote(false);
    if (error) return;
    setNoteText('');
    setMatterNotesMap(m => ({ ...m, [matterId]: [data, ...(m[matterId] || [])] }));
  }
  async function handleDeleteNote(noteId, matterId) { await deleteMatterNote(noteId); setMatterNotesMap(m => ({ ...m, [matterId]: (m[matterId] || []).filter(n => n.id !== noteId) })); }

  async function handleSaveCreditNote() {
    if (!cnForm.amount || !cnForm.reason.trim() || !cnInvoice) return;
    setSavingCN(true);
    const { error } = await saveCreditNote({ invoiceId: cnInvoice.id, client: cnInvoice.client, matterId: cnInvoice.matter_id, amount: cnForm.amount, reason: cnForm.reason }, userId);
    setSavingCN(false);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    const { creditNotes: cn } = await fetchCreditNotes(userId);
    setCreditNotes(cn);
    setShowCNForm(false); setCnInvoice(null); setCnForm({ amount: '', reason: '' });
  }

  async function handleEmailInvoice(inv, customEmail) {
    setEmailingInv(inv.id);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/send-invoice', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }, body: JSON.stringify({ invoiceId: inv.id, recipientEmail: customEmail || '' }) });
    const data = await res.json();
    setEmailingInv(null);
    if (!res.ok) { toast('Could not send: ' + (data.error || 'Unknown error'), 'error'); return; }
    toast(data.warning || `Invoice emailed to ${data.sentTo}`, 'success');
  }

  async function logCall() {
    if (!callForm.description) return; setCallSaving(true);
    const durSec = Math.max(6, Number(callForm.durationMins) || 6) * 60, m = matters.find(x => x.id === callForm.matterId), title = `📞 Call: ${callForm.description}${m ? ' [' + m.id + ']' : ''}`, now = Date.now(), units = Math.max(1, Math.ceil(durSec / 360));
    await supabase.from('activities').insert({ user_id: user.id, agent_id: `manual-call-${now}`, app_name: 'Phone Call', app_display_name: 'Phone Call', window_title: title, start_time: now, end_time: now + durSec * 1000, duration_seconds: durSec, classification: 'billable', billing_units: units, is_billable: true, matter: callForm.matterId || '', date: new Date().toISOString().split('T')[0] });
    await load(); setCallSaving(false); setShowCall(false);
    setCallForm({ description: '', matterId: '', durationMins: 6, date: today });
  }

  async function handleCreateMatter() {
    if (!matterForm.name || !matterForm.client) return; setMatterSaving(true);
    const { conflicts } = await (await import('../lib/supabase')).checkConflict(matterForm.client);
    if (conflicts.length > 0) {
      const names = [...new Set(conflicts.map(c => c.client))].join(', ');
      if (!confirm(`⚠ Potential conflict of interest detected!\n\nClient "${matterForm.client}" appears in existing matters for: ${names}\n\nDo you want to continue?`)) { setMatterSaving(false); return; }
    }
    const res = await createMatter({ ...matterForm, userId: user.id, branchId: profile?.branch_id || null });
    if (res.error) { toast(res.error.message, 'error'); setMatterSaving(false); return; }
    const savedId = (res.data?.id || matterForm.id).toUpperCase();
    const words = [...matterForm.name.toLowerCase().split(/[\s\-\/,.()]+/), ...matterForm.client.toLowerCase().split(/[\s\-\/,.()]+/)].filter(w => w.length > 2);
    const toLink = allActs.filter(a => !a.matter && words.some(w => (a.window_title || '').toLowerCase().includes(w)));
    if (toLink.length > 0) await Promise.all(toLink.map(a => patchActivityMatter(a.id, savedId)));
    setMatterSaving(false); setShowMatterForm(false); setMatterForm({ id: '', name: '', client: '', description: '' });
    setMatterMsg(`Matter ${savedId} created — ${toLink.length} activit${toLink.length === 1 ? 'y' : 'ies'} linked.`);
    setTimeout(() => setMatterMsg(''), 4000); load();
  }

  async function handleDeleteMatter(id) { if (!confirm(`Delete matter ${id}?`)) return; await deleteMatter(id); load(); }

  async function handleChangePassword() {
    if (!pwdForm.newPwd || !pwdForm.confirm) { setPwdMsg({ msg: 'Please fill in all fields.', type: 'error' }); return; }
    if (pwdForm.newPwd !== pwdForm.confirm) { setPwdMsg({ msg: 'New passwords do not match.', type: 'error' }); return; }
    if (pwdForm.newPwd.length < 6) { setPwdMsg({ msg: 'Password must be at least 6 characters.', type: 'error' }); return; }
    setPwdSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwdForm.newPwd });
    if (error) { setPwdMsg({ msg: 'Error: ' + error.message, type: 'error' }); setPwdSaving(false); return; }
    setPwdMsg({ msg: '✓ Password changed successfully!', type: 'success' });
    setPwdSaving(false);
    setTimeout(() => { setShowPwdForm(false); setPwdForm({ current: '', newPwd: '', confirm: '' }); setPwdMsg({ msg: '', type: '' }); }, 2000);
  }

  function buildPreview() {
    if (!invMatterId) return;
    const invMatter = matters.find(m => m.id === invMatterId);
    const mActs = allActs.filter(a => a.matter === invMatterId);
    let filtered;
    if (invPeriod === 'day') filtered = mActs.filter(a => a.date === selDate);
    else if (invPeriod === 'week') { const d = new Date(selDate + 'T12:00:00'); d.setDate(d.getDate() - d.getDay() + 1); const s = d.toISOString().split('T')[0]; const e = new Date(d); e.setDate(d.getDate() + 6); filtered = mActs.filter(a => a.date >= s && a.date <= e.toISOString().split('T')[0]); }
    else filtered = mActs.filter(a => a.date.startsWith(selDate.substring(0, 7)));
    const label = invPeriod === 'day' ? fdate(selDate) : invPeriod === 'week' ? 'This week' : fmonth(selDate);
    const bill = filtered.filter(a => a.classification === 'billable'), tU = bill.reduce((s, a) => s + calcUnits(a.duration_seconds), 0);
    setPreview({ label, filtered, bill, tU, tAmt: tU * invRate });
  }

  async function handleSaveInvoice() {
    const invMatter = matters.find(m => m.id === invMatterId);
    if (!preview || !invMatter) return;
    const res = await saveInvoice({ client: invMatter.client, matter_id: invMatter.id, matter_name: invMatter.name, attorney: invAtty, period: invPeriod, period_label: preview.label, rate: invRate, total_units: preview.tU, total_amount: preview.tAmt, activity_ids: preview.bill.map(a => a.id) }, user.id);
    if (res.error) { toast('Error: ' + res.error.message, 'error'); return; }
    setPreview(null); await load(); setTab('archive');
  }

  function getAnalyticsActs(p) {
    if (p === 'day') return allActs.filter(a => a.date === selDate);
    if (p === 'week') { const d = new Date(selDate + 'T12:00:00'); d.setDate(d.getDate() - d.getDay() + 1); const s = d.toISOString().split('T')[0]; const e = new Date(d); e.setDate(d.getDate() + 6); return allActs.filter(a => a.date >= s && a.date <= e.toISOString().split('T')[0]); }
    return allActs.filter(a => a.date.startsWith(selDate.substring(0, 7)));
  }

  // ── Derived ───────────────────────────────────────────────────────
  const daySec = liveActs.reduce((s, a) => s + Number(a.duration_seconds || 0), 0);
  const dayBillSec = liveActs.filter(a => a.classification === 'billable').reduce((s, a) => s + Number(a.duration_seconds || 0), 0);
  const dayBillU = liveActs.filter(a => a.classification === 'billable').reduce((s, a) => s + calcUnits(a.duration_seconds), 0);
  const allApps = [...new Set(allActs.map(a => a.app_display_name))].sort();
  const filtActs = allActs.filter(a => { if (filterCls && a.classification !== filterCls) return false; if (filterDate && a.date !== filterDate) return false; if (filterApp && a.app_display_name !== filterApp) return false; return true; }).sort((a, b) => b.start_time - a.start_time);

  const C = {
    page: { background: '#0A0A0A', minHeight: '100vh', fontFamily: 'system-ui,sans-serif', color: '#F0F0F0' },
    main: { maxWidth: 1300, margin: '0 auto', padding: '20px 24px' },
    card: { background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: 16, marginBottom: 14 },
    stat: (acc) => ({ background: acc ? 'rgba(108,192,74,0.05)' : '#111', border: `1px solid ${acc ? 'rgba(108,192,74,0.25)' : '#1A1A1A'}`, borderRadius: 8, padding: 14 }),
    btn: (v = 's') => ({ background: v === 'p' ? '#6CC04A' : v === 'pur' ? '#A78BFA' : v === 'r' ? 'rgba(220,80,80,0.15)' : v === 'trust' ? 'rgba(74,144,217,0.15)' : v === 'warn' ? 'rgba(234,179,8,0.15)' : 'transparent', border: v === 'p' ? 'none' : v === 'pur' ? 'none' : v === 'g' ? '1px solid rgba(108,192,74,0.35)' : v === 'r' ? '1px solid rgba(220,80,80,0.4)' : v === 'trust' ? '1px solid rgba(74,144,217,0.4)' : v === 'warn' ? '1px solid rgba(234,179,8,0.4)' : '1px solid #252525', color: v === 'p' ? '#0A0A0A' : v === 'pur' ? '#0A0A0A' : v === 'g' ? '#6CC04A' : v === 'r' ? '#E05252' : v === 'trust' ? '#4A90D9' : v === 'warn' ? '#EAB308' : '#888', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: v === 'p' || v === 'pur' ? 700 : 500, whiteSpace: 'nowrap' }),
    ntab: (on) => ({ background: 'transparent', border: `1px solid ${on ? '#2A2A2A' : 'transparent'}`, color: on ? '#F0F0F0' : '#555', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: on ? 600 : 400 }),
    sel: { background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '5px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit' },
    inp: { background: '#1A1A1A', border: '1px solid #252525', color: '#F0F0F0', padding: '7px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', width: '100%' },
    lbl: { fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4, display: 'block' },
    modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
    mbox: { background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, padding: 28, width: '100%', maxWidth: 480 },
    th: { fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#444', padding: '9px 10px', borderBottom: '1px solid #181818', textAlign: 'left', fontWeight: 600 },
    td: { padding: '9px 10px', fontSize: 11, borderBottom: '1px solid #161616', verticalAlign: 'middle' },
  };

  // ── Target gauge ──────────────────────────────────────────────────
  const currMonth = new Date().toLocaleDateString('en-CA').substring(0, 7);
  const currMonthUnits = allActs.filter(a => a.is_billable && a.date?.startsWith(currMonth)).reduce((s, a) => s + (a.billing_units || 0), 0);
  const monthTarget = profile?.monthly_target || 0;
  const today2 = new Date();
  const daysInMonth = new Date(today2.getFullYear(), today2.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - today2.getDate();
  const monthPct = monthTarget > 0 ? Math.min(100, Math.round(currMonthUnits / monthTarget * 100)) : null;
  const gaugeColor = monthPct === null ? '#444' : monthPct >= 100 ? '#6CC04A' : monthPct >= 70 ? '#EAB308' : '#E05252';
  const monthName = today2.toLocaleDateString('en-ZA', { month: 'long' });
  const invMatter = matters.find(m => m.id === invMatterId) || null;

  if (authLoading) return <div style={{ background: '#0A0A0A', minHeight: '100vh' }}><SkeletonDashboard /></div>;

  return (
    <>
      <Head><title>MB SmartTrack</title></Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}table tr:hover td{background:rgba(108,192,74,0.025)}button:hover{opacity:.85}select option{background:#1A1A1A;color:#F0F0F0}input[type=date],input[type=month]{color-scheme:dark}input:focus,select:focus{outline:1px solid rgba(108,192,74,0.4);outline-offset:1px}`}</style>
      <div style={C.page}>
        <NavBar
          role={profile?.role === 'bookkeeper' ? 'bookkeeper' : 'attorney'}
          tab={tab} setTab={setTab} profile={profile}
          clock={online ? clock : null}
          onSignOut={async () => { await signOut(); router.replace('/login'); }}
          pendingCount={pendingPayments.length}
          rightSlot={<>
            <div style={{ position: 'relative' }}>
              <input ref={searchRef} style={{ background: '#1A1A1A', border: `1px solid ${searchQuery ? 'rgba(108,192,74,0.4)' : '#252525'}`, color: '#F0F0F0', padding: '5px 12px 5px 32px', borderRadius: 20, fontSize: 12, fontFamily: 'inherit', width: 180, outline: 'none' }} placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, pointerEvents: 'none' }}>{searching ? '⌛' : '🔍'}</span>
              {searchQuery && <button style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 12, padding: 0 }} onClick={() => setSearchQuery('')}>✕</button>}
            </div>
            <button style={{ ...C.btn(), fontSize: 11 }} onClick={() => setShowCall(true)}>📞 Log a Call</button>
            <button style={{ background: 'transparent', border: '1px solid #252525', color: '#555', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }} onClick={() => setShowPwdForm(true)}>🔒</button>
            {!online && <span style={{ fontSize: 11, color: '#3A3A3A' }}>Offline</span>}
          </>}
        />

        {/* Target gauge */}
        {monthTarget > 0 && (
          <div style={{ background: '#0D0D0D', borderBottom: '1px solid #1A1A1A', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>{monthName} target</div>
            <div style={{ flex: 1, minWidth: 120, height: 6, background: '#1A1A1A', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${monthPct || 0}%`, height: '100%', background: gaugeColor, borderRadius: 3, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: gaugeColor, whiteSpace: 'nowrap' }}>{currMonthUnits}/{monthTarget} units ({monthPct || 0}%)</div>
            <div style={{ fontSize: 10, color: '#333', whiteSpace: 'nowrap' }}>{daysLeft} days left</div>
            {monthPct !== null && monthPct >= 100 && <div style={{ fontSize: 10, color: '#6CC04A', fontWeight: 700 }}>🎉 Target hit!</div>}
          </div>
        )}

        {/* ── TABS ── */}
        {tab === 'today' && (
          <TodayTab
            liveActs={liveActs} daySec={daySec} dayBillSec={dayBillSec} dayBillU={dayBillU}
            matters={matters} selDate={selDate} setSelDate={setSelDate} dates={dates} invRate={invRate}
            setTab={setTab} openReviews={openReviews} selfSubmitted={selfSubmitted} setSelfSubmitted={setSelfSubmitted}
            peerReviewedIds={peerReviewedIds} setPeerReviewedIds={setPeerReviewedIds}
            branchColleagues={branchColleagues} perfFeedback={perfFeedback} setPerfFeedback={setPerfFeedback}
            profile={profile} userId={userId} reclassify={reclassify} assignMatter={assignMatter} toast={toast}
          />
        )}

        {tab === 'activities' && (
          <ActivitiesTab
            filtActs={filtActs} allActs={allActs} matters={matters} dates={dates}
            filterCls={filterCls} setFilterCls={setFilterCls}
            filterDate={filterDate} setFilterDate={setFilterDate}
            filterApp={filterApp} setFilterApp={setFilterApp}
            allApps={allApps} reclassify={reclassify} assignMatter={assignMatter}
          />
        )}

        {tab === 'history' && (
          <HistoryTab
            histYear={histYear} setHistYear={setHistYear} histMonths={histMonths}
            histYears={histYears} selMonth={selMonth} monthData={monthData}
            invRate={invRate} setInvMatterId={setInvMatterId} setTab={setTab} loadMonth={loadMonth}
          />
        )}

        {tab === 'matters' && (
          <MattersTab
            matters={matters} allActs={allActs} invoices={invoices}
            trustBalances={trustBalances} balanceAlerts={balanceAlerts} invRate={invRate}
            openNotesMatter={openNotesMatter} setOpenNotesMatter={setOpenNotesMatter}
            matterNotesMap={matterNotesMap} noteText={noteText} setNoteText={setNoteText}
            noteType={noteType} setNoteType={setNoteType} savingNote={savingNote}
            setShowMatterForm={setShowMatterForm} handleSaveNote={handleSaveNote}
            handleDeleteNote={handleDeleteNote} loadNotes={loadNotes}
            handleDeleteMatter={handleDeleteMatter} setInvMatterId={setInvMatterId} setTab={setTab}
            matterMsg={matterMsg}
          />
        )}

        {tab === 'invoices' && (
          <InvoicesTab
            matters={matters} allActs={allActs} invMatterId={invMatterId} setInvMatterId={setInvMatterId}
            invAtty={invAtty} invRate={invRate} invPeriod={invPeriod} setInvPeriod={setInvPeriod}
            selDate={selDate} setSelDate={setSelDate} preview={preview} setPreview={setPreview}
            buildPreview={buildPreview} handleSaveInvoice={handleSaveInvoice}
            trustBalances={trustBalances} firm={firm}
            generateDetailedInvoicePDF={generateDetailedInvoicePDF} setTab={setTab}
          />
        )}

        {tab === 'archive' && (
          <ArchiveTab
            invoices={invoices} allActs={allActs} archFilter={archFilter} setArchFilter={setArchFilter}
            emailingInv={emailingInv} setEmailingInv={setEmailingInv} handleEmailInvoice={handleEmailInvoice}
            setCnInvoice={setCnInvoice} setCnForm={setCnForm} setShowCNForm={setShowCNForm}
            setViewInv={setViewInv} userId={userId} load={load} invRate={invRate} firm={firm}
            generateDetailedInvoicePDF={generateDetailedInvoicePDF}
          />
        )}

        {tab === 'analytics' && (
          <AnalyticsTab
            allActs={allActs} selDate={selDate} setSelDate={setSelDate}
            analyticsPeriod={analyticsPeriod} setAP={setAP}
            invRate={invRate} getAnalyticsActs={getAnalyticsActs}
          />
        )}

        {tab === 'performance' && (
          <PerformanceTab
            allActs={allActs} invoices={invoices} monthTarget={monthTarget}
            invRate={invRate} profile={profile} toast={toast}
          />
        )}

        {tab === 'trust' && (
          <div style={C.main}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.03em' }}>🏦 Trust Accounting</div>
                <div style={{ fontSize: 11, color: '#444' }}>Legal Practice Act compliant · 3 branches · balance never goes negative · payments ≥ {fmtR(50000)} require approval</div>
              </div>
              <button style={C.btn()} onClick={loadTrust}>↻ Refresh</button>
            </div>
            <TrustTab
              trustTransactions={trustTransactions} trustAccounts={trustAccounts}
              trustBalances={trustBalances} balanceAlerts={balanceAlerts}
              lockedPeriods={lockedPeriods} branches={branches}
              matters={matters} allMatters={allMatters} invoices={invoices}
              pendingPayments={pendingPayments} trustLoading={trustLoading}
              profile={profile} userId={userId} loadTrust={loadTrust}
            />
          </div>
        )}

        {tab === 'undertakings' && (
          <UndertakingsTab
            undertakings={undertakings} setUndertakings={setUndertakings}
            showUTForm={showUTForm} setShowUTForm={setShowUTForm}
            utForm={utForm} setUtForm={setUtForm}
            matters={matters} userId={userId} toast={toast}
          />
        )}

        {tab === 'communications' && (
          <CommunicationsTab
            communications={communications} setCommunications={setCommunications}
            showCommForm={showCommForm} setShowCommForm={setShowCommForm}
            commForm={commForm} setCommForm={setCommForm}
            matters={matters} userId={userId} toast={toast}
          />
        )}

        {tab === 'disbursements' && (
          <DisbursementsTab
            disbursements={disbursements} setDisbursements={setDisbursements}
            showDisbForm={showDisbForm} setShowDisbForm={setShowDisbForm}
            disbForm={disbForm} setDisbForm={setDisbForm}
            matters={matters} today={today} userId={userId} profile={profile}
          />
        )}

        {/* ── Search overlay ── */}
        {searchQuery && searchResults && (
          <div style={{ position: 'fixed', top: 56, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 90, overflowY: 'auto' }} onClick={() => setSearchQuery('')}>
            <div style={{ maxWidth: 800, margin: '20px auto', background: '#111', border: '1px solid #2A2A2A', borderRadius: 10, padding: 20 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Results for <span style={{ color: '#6CC04A' }}>"{searchResults.query}"</span></span>
                <span style={{ fontSize: 11, color: '#555' }}>{searchResults.activities.length} activities · {searchResults.matters.length} matters · {searchResults.invoices.length} invoices</span>
              </div>
              {searchResults.matters.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Matters</div>
                  {searchResults.matters.map(m => { const mU = allActs.filter(a => a.matter === m.id && a.classification === 'billable').reduce((s, a) => s + calcUnits(a.duration_seconds), 0); return (<div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0D0D0D', borderRadius: 6, marginBottom: 6, cursor: 'pointer' }} onClick={() => { setSearchQuery(''); setTab('matters'); }}><div><div style={{ fontSize: 11, color: '#A78BFA', fontFamily: 'monospace', marginBottom: 2 }}>{m.id}</div><div style={{ fontSize: 13, fontWeight: 600, color: '#E0E0E0' }}>{m.name}</div><div style={{ fontSize: 11, color: '#666' }}>{m.client}</div></div><div style={{ textAlign: 'right' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#6CC04A' }}>R{(mU * invRate).toLocaleString()}</div><div style={{ fontSize: 10, color: '#444' }}>{mU} units</div></div></div>); })}
                </div>
              )}
              {searchResults.activities.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Activities</div>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {searchResults.activities.map(a => { const m = matters.find(x => x.id === a.matter); return (<div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#0D0D0D', borderRadius: 6, marginBottom: 4 }}><div style={{ fontSize: 16, flexShrink: 0 }}>{appIcon(a.app_display_name)}</div><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 500, color: '#D0D0D0' }}>{a.app_display_name}</div><div style={{ fontSize: 11, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.window_title}</div>{m && <div style={{ fontSize: 10, color: '#A78BFA', marginTop: 1 }}>{m.id} · {m.client}</div>}</div><div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{toHm(a.duration_seconds)}</div><div style={{ fontSize: 10, color: '#444' }}>{fdate(a.date)}</div></div></div>); })}
                  </div>
                </div>
              )}
              {searchResults.invoices.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Invoices</div>
                  {searchResults.invoices.map(inv => (<div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0D0D0D', borderRadius: 6, marginBottom: 4, cursor: 'pointer' }} onClick={() => { setSearchQuery(''); setViewInv(inv); }}><div><div style={{ fontSize: 12, fontWeight: 600, color: '#D0D0D0' }}>{inv.id}</div><div style={{ fontSize: 11, color: '#666' }}>{inv.client} · {inv.matter_name}</div></div><div style={{ fontSize: 14, fontWeight: 700, color: '#6CC04A' }}>R{((inv.total_units || 0) * (inv.rate || 150) * 1.15).toFixed(2)}</div></div>))}
                </div>
              )}
              {!searchResults.activities.length && !searchResults.matters.length && !searchResults.invoices.length && (<div style={{ textAlign: 'center', padding: '40px', color: '#444' }}><div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div><div style={{ fontSize: 14, color: '#555' }}>No results for "{searchResults.query}"</div></div>)}
            </div>
          </div>
        )}

        {/* ── Global modals ── */}

        {/* Call log */}
        {showCall && (
          <div style={C.modal} onClick={() => setShowCall(false)}>
            <div style={C.mbox} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📞 Log a Call</div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 20 }}>Record a client call as a billable activity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={C.lbl}>Description *</label><input style={C.inp} placeholder="e.g. Smith — settlement discussion" value={callForm.description} onChange={e => setCallForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div><label style={C.lbl}>Assign to matter</label><select style={C.inp} value={callForm.matterId} onChange={e => setCallForm(f => ({ ...f, matterId: e.target.value }))}><option value="">— optional —</option>{matters.map(m => <option key={m.id} value={m.id}>{m.id} · {m.name} ({m.client})</option>)}</select></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><label style={C.lbl}>Duration (minutes)</label><input style={C.inp} type="number" min="1" value={callForm.durationMins} onChange={e => setCallForm(f => ({ ...f, durationMins: parseInt(e.target.value) || 6 }))} /><div style={{ fontSize: 10, color: '#6CC04A', marginTop: 4 }}>{calcUnits(callForm.durationMins * 60)} unit(s) · R{calcAmt(callForm.durationMins * 60, invRate).toLocaleString()}</div></div>
                  <div><label style={C.lbl}>Logged at</label><div style={{ ...C.inp, display: 'flex', alignItems: 'center', color: '#888', fontSize: 11 }}>{new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}</div></div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button style={C.btn()} onClick={() => setShowCall(false)}>Cancel</button>
                <button style={C.btn('pur')} onClick={logCall} disabled={callSaving || !callForm.description}>{callSaving ? 'Saving…' : 'Save as Billable'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Credit note */}
        {showCNForm && cnInvoice && (
          <div style={C.modal} onClick={() => setShowCNForm(false)}>
            <div style={{ ...C.mbox, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Issue Credit Note</div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 16 }}>Against invoice <strong style={{ color: '#F0F0F0' }}>{cnInvoice.id}</strong> · {cnInvoice.client} · R{((cnInvoice.total_units || 0) * (cnInvoice.rate || 150) * 1.15).toFixed(2)} incl. VAT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={C.lbl}>Credit amount (R) *</label><input style={C.inp} type="number" placeholder="0.00" value={cnForm.amount} onChange={e => setCnForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div><label style={C.lbl}>Reason *</label><textarea style={{ ...C.inp, minHeight: 70, resize: 'vertical' }} placeholder="Reason for credit note…" value={cnForm.reason} onChange={e => setCnForm(f => ({ ...f, reason: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button style={C.btn()} onClick={() => setShowCNForm(false)}>Cancel</button>
                <button style={C.btn('p')} disabled={savingCN || !cnForm.amount || !cnForm.reason.trim()} onClick={handleSaveCreditNote}>{savingCN ? 'Saving…' : 'Issue Credit Note'}</button>
              </div>
            </div>
          </div>
        )}

        {/* New matter */}
        {showMatterForm && (
          <div style={C.modal} onClick={() => setShowMatterForm(false)}>
            <div style={C.mbox} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📁 New Client Matter</div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 20 }}>Activities auto-linked by matching window titles.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={C.lbl}>Matter ID *</label><input style={C.inp} placeholder="e.g. L2025/042" value={matterForm.id} onChange={e => setMatterForm(f => ({ ...f, id: e.target.value.toUpperCase() }))} /></div>
                <div><label style={C.lbl}>Matter name *</label><input style={C.inp} placeholder="e.g. Smith v Jones — Contract Review" value={matterForm.name} onChange={e => setMatterForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label style={C.lbl}>Client name *</label><input style={C.inp} placeholder="e.g. ABC Corporation" value={matterForm.client} onChange={e => setMatterForm(f => ({ ...f, client: e.target.value }))} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div><label style={C.lbl}>Prescription Date</label><input style={C.inp} type="date" value={matterForm.prescription_date || ''} onChange={e => setMatterForm(f => ({ ...f, prescription_date: e.target.value }))} /></div>
                  <div><label style={C.lbl}>Next Action Date</label><input style={C.inp} type="date" value={matterForm.next_action_date || ''} onChange={e => setMatterForm(f => ({ ...f, next_action_date: e.target.value }))} /></div>
                  <div><label style={C.lbl}>Budget (units)</label><input style={C.inp} type="number" min="0" placeholder="0" value={matterForm.budget_units || ''} onChange={e => setMatterForm(f => ({ ...f, budget_units: parseInt(e.target.value) || 0 }))} /></div>
                </div>
                <div><label style={C.lbl}>Description</label><input style={C.inp} placeholder="Optional" value={matterForm.description} onChange={e => setMatterForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button style={C.btn()} onClick={() => setShowMatterForm(false)}>Cancel</button>
                <button style={C.btn('p')} onClick={handleCreateMatter} disabled={matterSaving || !matterForm.id || !matterForm.name || !matterForm.client}>{matterSaving ? 'Creating…' : 'Create Matter'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Password change */}
        {showPwdForm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowPwdForm(false)}>
            <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 12, padding: 32, width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F0', marginBottom: 4 }}>🔒 Change Password</div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 20 }}>Choose a strong password you'll remember</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={{ ...C.lbl, marginBottom: 4 }}>New password *</label><input type="password" style={{ ...C.inp, padding: '10px 14px', borderRadius: 7, fontSize: 13 }} placeholder="Minimum 6 characters" value={pwdForm.newPwd} onChange={e => setPwdForm(f => ({ ...f, newPwd: e.target.value }))} /></div>
                <div><label style={{ ...C.lbl, marginBottom: 4 }}>Confirm new password *</label><input type="password" style={{ ...C.inp, padding: '10px 14px', borderRadius: 7, fontSize: 13 }} placeholder="Repeat new password" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} /></div>
                {pwdMsg.msg && (<div style={{ background: pwdMsg.type === 'error' ? 'rgba(220,80,80,0.1)' : 'rgba(141,198,63,0.1)', border: `1px solid ${pwdMsg.type === 'error' ? 'rgba(220,80,80,0.4)' : 'rgba(141,198,63,0.3)'}`, borderRadius: 6, padding: '10px 12px', fontSize: 12, color: pwdMsg.type === 'error' ? '#E05252' : '#8DC63F' }}>{pwdMsg.msg}</div>)}
                <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
                  <button style={C.btn()} onClick={() => setShowPwdForm(false)}>Cancel</button>
                  <button style={{ background: '#8DC63F', border: 'none', color: '#0A0A0A', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 700 }} disabled={pwdSaving} onClick={handleChangePassword}>{pwdSaving ? 'Saving…' : 'Change Password'}</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View invoice modal */}
        {viewInv && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 20px' }} onClick={() => setViewInv(null)}>
            <div style={{ background: '#111', border: '1px solid #252525', borderRadius: 12, padding: 24, maxWidth: 780, width: '100%' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                <div><div style={{ fontSize: 14, fontWeight: 700 }}>{viewInv.id}</div><div style={{ fontSize: 11, color: '#555' }}>{viewInv.client} · <span style={{ color: '#A78BFA' }}>{viewInv.matter_id || viewInv.matter_name}</span></div></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={C.btn('g')} onClick={() => generateDetailedInvoicePDF(viewInv, allActs.filter(a => (viewInv.activity_ids || []).includes(a.id)), firm)}>⬇ PDF</button>
                  <button style={C.btn('r')} onClick={async () => { if (!confirm(`Delete ${viewInv.id}?`)) return; await deleteInvoice(viewInv.id); setViewInv(null); load(); }}>Delete</button>
                  <button style={C.btn()} onClick={() => setViewInv(null)}>Close</button>
                </div>
              </div>
              <InvoiceDoc inv={viewInv} acts={allActs.filter(a => (viewInv.activity_ids || []).includes(a.id))} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

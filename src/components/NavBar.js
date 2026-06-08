import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useFirmSettings } from '../lib/useFirmSettings';
import { useOffline } from '../lib/useOffline';

const NAV = {
  manager: [
    { type:'item', label:'Overview', id:'overview' },
    { type:'group', label:'Billing', items:[
      { label:'Invoices', id:'invoices' },
      { label:'WIP Report', id:'wip' },
      { label:'Debtors', id:'debtors' },
      { label:'Statements', id:'statements' },
      { label:'Disbursements', id:'disbursements' },
    ]},
    { type:'group', label:'Finance', items:[
      { label:'Trust', id:'trust' },
      { label:'Reports', id:'reports' },
      { label:'VAT Report', id:'vat' },
      { label:'Interest', id:'interest' },
      { label:'Fee Schedules', id:'schedules' },
    ]},
    { type:'group', label:'Practice', items:[
      { label:'Matters', id:'matters' },
      { label:'Clients', id:'clients' },
      { label:'Requests', id:'requests' },
      { label:'Undertakings', id:'undertakings' },
      { label:'Communications', id:'communications' },
      { label:'Templates', id:'templates' },
      { label:'Calendar', href:'/calendar' },
      { label:'Documents', href:'/documents' },
    ]},
    { type:'group', label:'Analytics', items:[
      { label:'Analytics', id:'analytics' },
      { label:'History', id:'history' },
      { label:'Performance', id:'firmperformance' },
    ]},
    { type:'group', label:'Admin', items:[
      { label:'Staff', id:'staff' },
      { label:'Campaigns', id:'campaigns' },
      { label:'Court Roll', id:'courtroll' },
      { label:'Audit Log', id:'audit' },
      { label:'Settings', id:'settings' },
    ]},
  ],
  attorney: [
    { type:'item', label:'Today', id:'today' },
    { type:'group', label:'Work', items:[
      { label:'Matters', id:'matters' },
      { label:'All Activities', id:'activities' },
      { label:'Undertakings', id:'undertakings' },
      { label:'Communications', id:'communications' },
      { label:'Analytics', id:'analytics' },
      { label:'History', id:'history' },
      { label:'Performance', id:'performance' },
    ]},
    { type:'group', label:'Billing', items:[
      { label:'Invoice', id:'invoices' },
      { label:'Costs', id:'disbursements' },
      { label:'Archive', id:'archive' },
    ]},
    { type:'item', label:'Trust', id:'trust' },
    { type:'link', label:'Calendar', href:'/calendar' },
    { type:'link', label:'Documents', href:'/documents' },
  ],
  bookkeeper: [
    { type:'item', label:'Trust', id:'trust' },
    { type:'item', label:'Invoices', id:'invoices' },
    { type:'item', label:'Archive', id:'archive' },
  ],
  receptionist: [
    { type:'item', label:'Dashboard', id:'dashboard' },
    { type:'item', label:'Clients', id:'clients' },
    { type:'item', label:'Calendar', id:'calendar' },
    { type:'item', label:'Matters', id:'matters' },
  ],
  hr: [
    { type:'item', label:'Staff', id:'staff' },
    { type:'item', label:'Performance', id:'performance' },
    { type:'item', label:'Leave', id:'leave' },
    { type:'item', label:'Payroll', id:'payroll' },
  ],
};

export default function NavBar({ role, tab, setTab, onSignOut, profile, clock, pendingCount=0, ficaCount=0, rightSlot }) {
  const firm = useFirmSettings();
  const router = useRouter();
  const isOnline = useOffline();
  const [openGroup, setOpenGroup] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    function handler(e) {
      const inHeader = headerRef.current && headerRef.current.contains(e.target);
      const inMenu   = menuRef.current   && menuRef.current.contains(e.target);
      if (!inHeader && !inMenu) { setOpenGroup(null); setMobileOpen(false); }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = NAV[role] || NAV.attorney;
  const activeGroup = items.find(i => i.type==='group' && i.items?.some(it => it.id===tab))?.label;

  function handleItem(item) {
    if (item.href) { router.push(item.href); setOpenGroup(null); setMobileOpen(false); return; }
    if (item.id)   { setTab(item.id);        setOpenGroup(null); setMobileOpen(false); }
  }

  const S = {
    hdr: {
      background:'#0F0F0F',
      borderBottom:'1px solid #1A1A1A',
      padding:'0 20px',
      height:52,
      display:'flex',
      alignItems:'center',
      justifyContent:'space-between',
      position:'sticky',
      top:0,
      zIndex:200,
      gap:8,
    },
    logo: { display:'flex', alignItems:'center', gap:12, flexShrink:0, marginRight:12 },
    nav:  { display:'flex', alignItems:'center', gap:2, flex:1, flexWrap:'nowrap' },
    item: (active) => ({
      background:'transparent', border:'none',
      color: active ? '#F0F0F0' : '#666',
      padding:'5px 11px', borderRadius:6, cursor:'pointer', fontSize:12,
      fontFamily:"'DM Sans',system-ui,sans-serif", fontWeight: active ? 600 : 400,
      whiteSpace:'nowrap', position:'relative', display:'flex', alignItems:'center', gap:4,
      borderBottom: active ? '2px solid #8DC63F' : '2px solid transparent',
      transition:'color 0.15s',
    }),
    groupBtn: (active, open) => ({
      background: open ? 'rgba(255,255,255,0.05)' : 'transparent', border:'none',
      color: active||open ? '#F0F0F0' : '#666',
      padding:'5px 11px', borderRadius:6, cursor:'pointer', fontSize:12,
      fontFamily:"'DM Sans',system-ui,sans-serif", fontWeight: active ? 600 : 400,
      whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4,
      borderBottom: active ? '2px solid #8DC63F' : '2px solid transparent',
    }),
    dropdown: {
      position:'absolute', top:'calc(100% + 6px)', left:0,
      background:'#111', border:'1px solid #252525', borderRadius:8,
      padding:'6px', minWidth:160, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', zIndex:300,
    },
    dropItem: (active) => ({
      display:'block', width:'100%',
      background: active ? 'rgba(141,198,63,0.1)' : 'transparent', border:'none',
      color: active ? '#8DC63F' : '#888',
      padding:'8px 12px', borderRadius:5, cursor:'pointer', fontSize:12,
      fontFamily:"'DM Sans',system-ui,sans-serif", fontWeight: active ? 600 : 400, textAlign:'left',
    }),
    pill:    { display:'flex', alignItems:'center', gap:5, background:'rgba(141,198,63,0.08)', border:'1px solid rgba(141,198,63,0.2)', borderRadius:20, padding:'3px 10px', fontSize:11, color:'#8DC63F', flexShrink:0 },
    dot:     { width:6, height:6, borderRadius:'50%', background:'#8DC63F', boxShadow:'0 0 5px rgba(141,198,63,0.8)' },
    signOut: { background:'transparent', border:'1px solid rgba(220,80,80,0.3)', color:'#E05252', padding:'4px 12px', borderRadius:6, cursor:'pointer', fontSize:11, fontFamily:"'DM Sans',system-ui,sans-serif", flexShrink:0 },
    burger:  { background:'transparent', border:'1px solid #252525', color:'#888', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:16, lineHeight:1, flexShrink:0 },
  };

  return (
    <>
      {!isOnline && (
        <div style={{ background:'#7F1D1D', borderBottom:'1px solid #991B1B', padding:'8px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontSize:12, color:'#FEE2E2', position:'sticky', top:0, zIndex:201 }}>
          <span>⚡</span>
          <strong>You are offline</strong>
          <span style={{ color:'#FCA5A5' }}>— changes will sync when your connection is restored. Data shown is from your last session.</span>
        </div>
      )}
      <div style={S.hdr} ref={headerRef}>
        {/* LOGO */}
        <div style={S.logo}>
          <img src={firm.logo_url || '/logo.png'} alt="MB" style={{width:44,height:44,objectFit:'contain',borderRadius:6,flexShrink:0}} onError={e=>{e.target.style.display='none';e.target.insertAdjacentHTML('afterend','<div style="width:44px;height:44px;background:#8DC63F;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;color:#0A0A0A;flex-shrink:0">MB</div>');}}/>

          <div style={{width:1,height:36,background:'#2A2A2A',flexShrink:0}}/>

          <div style={{lineHeight:1.5}}>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:'-0.02em'}}><span style={{color:'#F0F0F0'}}>Smart</span><span style={{color:'#8DC63F'}}>Track</span></div>
            <div style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.08em'}}>{profile?.full_name}</div>
          </div>
        </div>

        {/* DESKTOP NAV */}
        {!isMobile && (
          <nav style={S.nav}>
            {items.map((item, i) => {
              if (item.type === 'item') {
                const active = tab === item.id;
                return (
                  <button key={i} style={S.item(active)} onClick={() => handleItem(item)}
                    onMouseEnter={e=>{ if(!active) e.currentTarget.style.color='#CCC'; }}
                    onMouseLeave={e=>{ if(!active) e.currentTarget.style.color='#666'; }}>
                    {item.label}
                    {item.id==='trust'&&pendingCount>0&&<span style={{background:'#EAB308',color:'#000',borderRadius:'50%',width:15,height:15,fontSize:8,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center'}}>{pendingCount}</span>}
                  </button>
                );
              }
              if (item.type === 'link') {
                const active = router.pathname === item.href;
                return (
                  <button key={i} style={S.item(active)} onClick={() => router.push(item.href)}
                    onMouseEnter={e=>{ if(!active) e.currentTarget.style.color='#CCC'; }}
                    onMouseLeave={e=>{ if(!active) e.currentTarget.style.color='#666'; }}>
                    {item.label}
                  </button>
                );
              }
              if (item.type === 'group') {
                const active = activeGroup === item.label;
                const open = openGroup === item.label;
                const hasAlert = (item.label==='Finance'&&pendingCount>0) || (item.label==='Practice'&&ficaCount>0);
                return (
                  <div key={i} style={{position:'relative'}}>
                    <button style={S.groupBtn(active, open)} onClick={() => setOpenGroup(open ? null : item.label)}
                      onMouseEnter={e=>{ if(!active&&!open) e.currentTarget.style.color='#CCC'; }}
                      onMouseLeave={e=>{ if(!active&&!open) e.currentTarget.style.color='#666'; }}>
                      {item.label}
                      {hasAlert&&<span style={{width:6,height:6,borderRadius:'50%',background:'#EAB308',display:'inline-block'}}/>}
                      <span style={{fontSize:9,opacity:0.6}}>{open?'▲':'▼'}</span>
                    </button>
                    {open&&(
                      <div style={S.dropdown}>
                        {item.items.map((sub, j) => (
                          <button key={j} style={S.dropItem(tab===sub.id)} onClick={() => handleItem(sub)}
                            onMouseEnter={e=>{ if(tab!==sub.id){ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#D0D0D0'; }}}
                            onMouseLeave={e=>{ if(tab!==sub.id){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#888'; }}}>
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </nav>
        )}

        {/* RIGHT SIDE */}
        <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
          {!isMobile && rightSlot}
          {!isMobile && clock&&<div style={S.pill}><div style={S.dot}/>{clock}</div>}
          {!isMobile && <button style={S.signOut} onClick={onSignOut}>Sign out</button>}
          {isMobile && (
            <button style={S.burger} onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
              {mobileOpen ? '✕' : '☰'}
            </button>
          )}
        </div>
      </div>

      {/* MOBILE MENU */}
      {isMobile && mobileOpen && (
        <div ref={menuRef} style={{
          position:'fixed', top:52, left:0, right:0,
          background:'#0F0F0F', borderBottom:'1px solid #1A1A1A',
          zIndex:199, overflowY:'auto', maxHeight:'calc(100vh - 52px)',
        }}>
          {items.map((item, i) => {
            if (item.type === 'item') {
              const active = tab === item.id;
              return (
                <button key={i} onClick={() => handleItem(item)} style={{
                  display:'flex', alignItems:'center', gap:8,
                  width:'100%', background: active ? 'rgba(141,198,63,0.08)' : 'transparent',
                  border:'none', borderBottom:'1px solid #141414',
                  color: active ? '#F0F0F0' : '#888',
                  padding:'14px 20px', cursor:'pointer', fontSize:13,
                  fontFamily:"'DM Sans',system-ui,sans-serif", fontWeight: active ? 600 : 400, textAlign:'left',
                }}>
                  {item.label}
                  {item.id==='trust'&&pendingCount>0&&<span style={{background:'#EAB308',color:'#000',borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:700}}>{pendingCount}</span>}
                </button>
              );
            }
            if (item.type === 'link') {
              const active = router.pathname === item.href;
              return (
                <button key={i} onClick={() => handleItem(item)} style={{
                  display:'block', width:'100%',
                  background: active ? 'rgba(141,198,63,0.08)' : 'transparent',
                  border:'none', borderBottom:'1px solid #141414',
                  color: active ? '#F0F0F0' : '#888',
                  padding:'14px 20px', cursor:'pointer', fontSize:13,
                  fontFamily:"'DM Sans',system-ui,sans-serif", fontWeight: active ? 600 : 400, textAlign:'left',
                }}>
                  {item.label}
                </button>
              );
            }
            if (item.type === 'group') {
              const hasAlert = (item.label==='Finance'&&pendingCount>0) || (item.label==='Practice'&&ficaCount>0);
              return (
                <div key={i}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:6,
                    fontSize:9, color:'#444', textTransform:'uppercase',
                    letterSpacing:'0.1em', padding:'12px 20px 6px', fontWeight:700,
                  }}>
                    {item.label}
                    {hasAlert&&<span style={{width:6,height:6,borderRadius:'50%',background:'#EAB308',display:'inline-block'}}/>}
                  </div>
                  {item.items.map((sub, j) => {
                    const active = tab === sub.id || router.pathname === sub.href;
                    return (
                      <button key={j} onClick={() => handleItem(sub)} style={{
                        display:'block', width:'100%',
                        background: active ? 'rgba(141,198,63,0.08)' : 'transparent',
                        border:'none', borderBottom:'1px solid #141414',
                        color: active ? '#8DC63F' : '#777',
                        padding:'12px 20px 12px 32px', cursor:'pointer', fontSize:12,
                        fontFamily:"'DM Sans',system-ui,sans-serif", fontWeight: active ? 600 : 400, textAlign:'left',
                      }}>
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              );
            }
            return null;
          })}

          {/* MOBILE BOTTOM: rightSlot + clock + sign out */}
          <div style={{padding:'12px 20px 20px', borderTop:'1px solid #1A1A1A', display:'flex', flexDirection:'column', gap:10}}>
            {rightSlot && <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{rightSlot}</div>}
            {clock&&<div style={{...S.pill, alignSelf:'flex-start'}}><div style={S.dot}/>{clock}</div>}
            <button style={{...S.signOut, padding:'10px', textAlign:'center', width:'100%'}} onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      )}
    </>
  );
}

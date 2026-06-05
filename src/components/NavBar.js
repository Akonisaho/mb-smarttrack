import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useFirmSettings } from '../lib/useFirmSettings';

// nav config per role
// item: { label, id }  → calls setTab(id)
// link: { label, href } → router.push(href)
// group: { label, items: [...] } → dropdown

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
      { label:'Fee Schedules', id:'schedules' },
    ]},
    { type:'group', label:'Practice', items:[
      { label:'Clients', id:'clients' },
      { label:'Calendar', href:'/calendar' },
      { label:'Documents', href:'/documents' },
    ]},
    { type:'group', label:'Analytics', items:[
      { label:'Analytics', id:'analytics' },
      { label:'History', id:'history' },
    ]},
    { type:'group', label:'Admin', items:[
      { label:'Staff', id:'staff' },
      { label:'Settings', href:'/settings' },
    ]},
  ],
  attorney: [
    { type:'item', label:'Today', id:'today' },
    { type:'group', label:'Work', items:[
      { label:'Matters', id:'matters' },
      { label:'All Activities', id:'activities' },
      { label:'Analytics', id:'analytics' },
      { label:'History', id:'history' },
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
};

export default function NavBar({ role, tab, setTab, onSignOut, profile, clock, pendingCount=0, ficaCount=0, rightSlot }) {
  const firm = useFirmSettings();
  const router = useRouter();
  const [openGroup, setOpenGroup] = useState(null);
  const ref = useRef(null);

  // close dropdown on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpenGroup(null); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = NAV[role] || NAV.attorney;

  // which group contains the active tab
  const activeGroup = items.find(i => i.type==='group' && i.items?.some(it => it.id===tab))?.label;

  function handleItem(item) {
    if (item.href) { router.push(item.href); setOpenGroup(null); return; }
    if (item.id) { setTab(item.id); setOpenGroup(null); }
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
    logo: {
      display:'flex', alignItems:'center', gap:8, flexShrink:0, marginRight:8,
    },
    nav: {
      display:'flex', alignItems:'center', gap:2, flex:1, flexWrap:'nowrap',
    },
    item: (active) => ({
      background:'transparent',
      border:'none',
      color: active ? '#F0F0F0' : '#666',
      padding:'5px 11px',
      borderRadius:6,
      cursor:'pointer',
      fontSize:12,
      fontFamily:"'DM Sans',system-ui,sans-serif",
      fontWeight: active ? 600 : 400,
      whiteSpace:'nowrap',
      position:'relative',
      display:'flex',
      alignItems:'center',
      gap:4,
      borderBottom: active ? '2px solid #8DC63F' : '2px solid transparent',
      transition:'color 0.15s',
    }),
    groupBtn: (active, open) => ({
      background: open ? 'rgba(255,255,255,0.05)' : 'transparent',
      border:'none',
      color: active||open ? '#F0F0F0' : '#666',
      padding:'5px 11px',
      borderRadius:6,
      cursor:'pointer',
      fontSize:12,
      fontFamily:"'DM Sans',system-ui,sans-serif",
      fontWeight: active ? 600 : 400,
      whiteSpace:'nowrap',
      display:'flex',
      alignItems:'center',
      gap:4,
      borderBottom: active ? '2px solid #8DC63F' : '2px solid transparent',
    }),
    dropdown: {
      position:'absolute',
      top:'calc(100% + 6px)',
      left:0,
      background:'#111',
      border:'1px solid #252525',
      borderRadius:8,
      padding:'6px',
      minWidth:160,
      boxShadow:'0 8px 24px rgba(0,0,0,0.4)',
      zIndex:300,
    },
    dropItem: (active) => ({
      display:'block',
      width:'100%',
      background: active ? 'rgba(141,198,63,0.1)' : 'transparent',
      border:'none',
      color: active ? '#8DC63F' : '#888',
      padding:'8px 12px',
      borderRadius:5,
      cursor:'pointer',
      fontSize:12,
      fontFamily:"'DM Sans',system-ui,sans-serif",
      fontWeight: active ? 600 : 400,
      textAlign:'left',
    }),
    pill: {
      display:'flex', alignItems:'center', gap:5, background:'rgba(141,198,63,0.08)',
      border:'1px solid rgba(141,198,63,0.2)', borderRadius:20, padding:'3px 10px',
      fontSize:11, color:'#8DC63F', flexShrink:0,
    },
    dot: { width:6, height:6, borderRadius:'50%', background:'#8DC63F', boxShadow:'0 0 5px rgba(141,198,63,0.8)' },
    signOut: {
      background:'transparent', border:'1px solid rgba(220,80,80,0.3)', color:'#E05252',
      padding:'4px 12px', borderRadius:6, cursor:'pointer', fontSize:11,
      fontFamily:"'DM Sans',system-ui,sans-serif", flexShrink:0,
    },
  };

  return (
    <div style={S.hdr} ref={ref}>
      {/* LOGO */}
      <div style={S.logo}>
        {firm.logo_url && <img src={firm.logo_url} alt="" style={{width:30,height:30,objectFit:'contain',borderRadius:5}}/>}
        <div style={{lineHeight:1.2}}>
          <div style={{fontSize:12,fontWeight:700,color:'#F0F0F0',letterSpacing:'-0.02em'}}>MB SmartTrack</div>
          <div style={{fontSize:9,color:'#333',textTransform:'uppercase',letterSpacing:'0.08em'}}>{profile?.full_name}</div>
        </div>
      </div>

      {/* NAV ITEMS */}
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
            const hasAlert = item.label==='Finance'&&pendingCount>0 || item.label==='Practice'&&ficaCount>0;
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
                      <button key={j} style={S.dropItem(tab===sub.id)}
                        onClick={() => handleItem(sub)}
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

      {/* RIGHT SIDE */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
        {rightSlot}
        {clock&&<div style={S.pill}><div style={S.dot}/>{clock}</div>}
        <button style={S.signOut} onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useFirmSettings } from '../lib/useFirmSettings';

export default function Sidebar({ role, tab, setTab, onSignOut, profile, pendingCount = 0, ficaCount = 0 }) {
  const firm = useFirmSettings();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close mobile menu when tab changes
  useEffect(() => { setMobileOpen(false); }, [tab]);

  const NAV = {
    manager: [
      { type:'item', id:'overview', label:'Overview', icon:'📊' },
      { type:'divider', label:'BILLING' },
      { type:'item', id:'invoices', label:'Invoices', icon:'🧾' },
      { type:'item', id:'wip', label:'WIP Report', icon:'📋' },
      { type:'item', id:'debtors', label:'Debtors', icon:'⏰', badge: null },
      { type:'item', id:'statements', label:'Statements', icon:'📄' },
      { type:'item', id:'disbursements', label:'Disbursements', icon:'📦' },
      { type:'divider', label:'FINANCE' },
      { type:'item', id:'trust', label:'Trust', icon:'🏦', badge: pendingCount },
      { type:'item', id:'reports', label:'Reports', icon:'📈' },
      { type:'item', id:'schedules', label:'Fee Schedules', icon:'💹' },
      { type:'divider', label:'PRACTICE' },
      { type:'item', id:'clients', label:'Clients', icon:'👥', badge: ficaCount },
      { type:'link', href:'/calendar', label:'Calendar', icon:'📅' },
      { type:'link', href:'/documents', label:'Documents', icon:'📂' },
      { type:'divider', label:'ANALYTICS' },
      { type:'item', id:'analytics', label:'Analytics', icon:'📉' },
      { type:'item', id:'history', label:'History', icon:'🕐' },
      { type:'divider', label:'ADMIN' },
      { type:'item', id:'staff', label:'Staff', icon:'👔' },
      { type:'link', href:'/settings', label:'Settings', icon:'⚙️' },
    ],
    attorney: [
      { type:'item', id:'today', label:'Today', icon:'🏠' },
      { type:'link', href:'/calendar', label:'Calendar', icon:'📅' },
      { type:'divider', label:'WORK' },
      { type:'item', id:'matters', label:'Matters', icon:'📁' },
      { type:'item', id:'activities', label:'All Activities', icon:'🗂️' },
      { type:'item', id:'analytics', label:'Analytics', icon:'📊' },
      { type:'item', id:'history', label:'History', icon:'🕐' },
      { type:'divider', label:'BILLING' },
      { type:'item', id:'invoices', label:'Invoice', icon:'🧾' },
      { type:'item', id:'disbursements', label:'Costs', icon:'📦' },
      { type:'item', id:'archive', label:'Archive', icon:'📜' },
      { type:'divider', label:'TRUST' },
      { type:'item', id:'trust', label:'Trust Account', icon:'🏦' },
      { type:'link', href:'/documents', label:'Documents', icon:'📂' },
    ],
    bookkeeper: [
      { type:'item', id:'trust', label:'Trust', icon:'🏦' },
      { type:'item', id:'invoices', label:'Invoices', icon:'🧾' },
      { type:'item', id:'archive', label:'Archive', icon:'📜' },
    ],
    receptionist: [
      { type:'item', id:'dashboard', label:'Dashboard', icon:'🏠' },
      { type:'item', id:'clients', label:'Clients', icon:'👥' },
      { type:'item', id:'calendar', label:'Calendar', icon:'📅' },
      { type:'item', id:'matters', label:'Matters', icon:'📁' },
    ],
  };

  const items = NAV[role] || NAV.attorney;
  const sideW = collapsed ? 56 : 220;

  const S = {
    sidebar: {
      width: sideW,
      minHeight: '100vh',
      background: '#0D0D0D',
      borderRight: '1px solid #1A1A1A',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: isMobile ? (mobileOpen ? 0 : -280) : 0,
      zIndex: 200,
      transition: 'width 0.2s ease, left 0.25s ease',
      overflowY: 'auto',
      overflowX: 'hidden',
    },
    logo: {
      padding: collapsed ? '16px 0' : '16px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      borderBottom: '1px solid #1A1A1A',
      minHeight: 60,
      justifyContent: collapsed ? 'center' : 'flex-start',
    },
    item: (active) => ({
      display: 'flex',
      alignItems: 'center',
      gap: collapsed ? 0 : 10,
      padding: collapsed ? '10px 0' : '9px 14px',
      justifyContent: collapsed ? 'center' : 'flex-start',
      cursor: 'pointer',
      borderRadius: 6,
      margin: '1px 6px',
      background: active ? 'rgba(141,198,63,0.12)' : 'transparent',
      color: active ? '#8DC63F' : '#666',
      fontSize: 12,
      fontWeight: active ? 600 : 400,
      fontFamily: "'DM Sans',system-ui,sans-serif",
      border: 'none',
      width: `calc(100% - 12px)`,
      textAlign: 'left',
      textDecoration: 'none',
      transition: 'background 0.15s, color 0.15s',
      position: 'relative',
    }),
    divider: {
      padding: collapsed ? '8px 0 2px' : '12px 14px 2px',
      fontSize: 9,
      color: '#2A2A2A',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      fontWeight: 700,
      textAlign: collapsed ? 'center' : 'left',
    },
    badge: {
      background: '#EAB308',
      color: '#000',
      borderRadius: '50%',
      width: 16,
      height: 16,
      fontSize: 9,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
      flexShrink: 0,
    },
    ficaBadge: {
      background: '#E05252',
      color: '#fff',
      borderRadius: '50%',
      width: 16,
      height: 16,
      fontSize: 9,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 'auto',
      flexShrink: 0,
    },
  };

  const SidebarContent = () => (
    <div style={S.sidebar}>
      {/* LOGO */}
      <div style={S.logo}>
        {firm.logo_url
          ? <img src={firm.logo_url} alt="" style={{width:32,height:32,objectFit:'contain',borderRadius:6,flexShrink:0}}/>
          : <div style={{width:32,height:32,background:'#8DC63F',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:'#0A0A0A',flexShrink:0}}>MB</div>
        }
        {!collapsed&&<div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:700,color:'#F0F0F0',letterSpacing:'-0.02em',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{firm.firm_name||'MB SmartTrack'}</div><div style={{fontSize:9,color:'#333',textTransform:'uppercase',letterSpacing:'0.08em',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{profile?.full_name}</div></div>}
        {!isMobile&&<button style={{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:14,padding:4,flexShrink:0,marginLeft:'auto'}} onClick={()=>setCollapsed(c=>!c)}>{collapsed?'→':'←'}</button>}
        {isMobile&&<button style={{background:'none',border:'none',color:'#333',cursor:'pointer',fontSize:18,padding:4,flexShrink:0,marginLeft:'auto'}} onClick={()=>setMobileOpen(false)}>✕</button>}
      </div>

      {/* NAV ITEMS */}
      <div style={{flex:1,padding:'8px 0',overflowY:'auto'}}>
        {items.map((item, i) => {
          if (item.type === 'divider') return (
            <div key={i} style={S.divider}>{collapsed ? '·' : item.label}</div>
          );
          if (item.type === 'link') {
            const isActive = router.pathname === item.href;
            return (
              <a key={i} href={item.href} style={{...S.item(isActive),display:'flex',textDecoration:'none'}}
                onMouseEnter={e=>{if(!isActive){e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='#888';}}}
                onMouseLeave={e=>{if(!isActive){e.currentTarget.style.background='transparent';e.currentTarget.style.color='#666';}}}>
                <span style={{fontSize:15,flexShrink:0,width:20,textAlign:'center'}}>{item.icon}</span>
                {!collapsed&&<span style={{flex:1}}>{item.label}</span>}
              </a>
            );
          }
          const isActive = tab === item.id;
          const badge = item.badge;
          return (
            <button key={i} style={S.item(isActive)}
              onClick={() => setTab(item.id)}
              onMouseEnter={e=>{if(!isActive){e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='#888';}}}
              onMouseLeave={e=>{if(!isActive){e.currentTarget.style.background=isActive?'rgba(141,198,63,0.12)':'transparent';e.currentTarget.style.color=isActive?'#8DC63F':'#666';}}}>
              <span style={{fontSize:15,flexShrink:0,width:20,textAlign:'center'}}>{item.icon}</span>
              {!collapsed&&<span style={{flex:1}}>{item.label}</span>}
              {!collapsed&&badge>0&&<span style={item.id==='clients'?S.ficaBadge:S.badge}>{badge}</span>}
              {collapsed&&badge>0&&<span style={{position:'absolute',top:4,right:4,width:8,height:8,borderRadius:'50%',background:item.id==='clients'?'#E05252':'#EAB308'}}/>}
            </button>
          );
        })}
      </div>

      {/* SIGN OUT */}
      <div style={{borderTop:'1px solid #1A1A1A',padding:'8px 0'}}>
        <button style={{...S.item(false),color:'#555'}} onClick={onSignOut}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(220,80,80,0.08)';e.currentTarget.style.color='#E05252';}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='#555';}}>
          <span style={{fontSize:15,flexShrink:0,width:20,textAlign:'center'}}>🚪</span>
          {!collapsed&&<span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobile&&mobileOpen&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:199}} onClick={()=>setMobileOpen(false)}/>}

      {/* Mobile hamburger */}
      {isMobile&&(
        <button style={{position:'fixed',top:12,left:12,zIndex:201,background:'#0D0D0D',border:'1px solid #1A1A1A',color:'#F0F0F0',borderRadius:8,width:40,height:40,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:18}} onClick={()=>setMobileOpen(o=>!o)}>
          ☰
        </button>
      )}

      <SidebarContent/>

      {/* Spacer to push content right */}
      <div style={{width: isMobile ? 0 : sideW, flexShrink:0, transition:'width 0.2s ease'}}/>
    </>
  );
}

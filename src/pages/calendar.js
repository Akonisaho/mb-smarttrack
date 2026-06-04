import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase, getProfile, signOut, fetchAllProfiles, fetchCalendarEvents, saveCalendarEvent, deleteCalendarEvent } from '../lib/supabase';

const EV_COLORS = { meeting:'#4A90D9', court:'#E05252', deadline:'#EAB308', call:'#A78BFA', other:'#8DC63F' };
function fdate(d){ try{return new Date(d+'T12:00:00').toLocaleDateString('en-ZA',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});}catch{return d;} }
const today = ()=>new Date().toLocaleDateString('en-CA');

export default function CalendarPage(){
  const router=useRouter();
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [view,setView]=useState('month');
  const [cur,setCur]=useState(new Date());
  const [events,setEvents]=useState([]);
  const [profiles,setProfiles]=useState([]);
  const [matters,setMatters]=useState([]);
  const [selUser,setSelUser]=useState('all');
  const [showForm,setShowForm]=useState(false);
  const [editEv,setEditEv]=useState(null);
  const [saving,setSaving]=useState(false);
  const [alert,setAlert]=useState({msg:'',type:''});
  const blankForm={title:'',description:'',event_type:'meeting',start_date:today(),end_date:'',start_time:'09:00',end_time:'10:00',all_day:false,matter_id:'',is_firm_wide:false,location:'',user_id:''};
  const [form,setForm]=useState(blankForm);

  const isMgr=profile?.role==='manager'||profile?.role==='national_manager'||profile?.role==='branch_manager';

  useEffect(()=>{
    supabase.auth.getSession().then(async({data})=>{
      if(!data.session){router.replace('/login');return;}
      const p=await getProfile(data.session.user.id);
      if(!p){router.replace('/login');return;}
      setProfile(p);
      setLoading(false);
    });
  },[]);

  const loadEvents=useCallback(async()=>{
    if(!profile) return;
    const y=cur.getFullYear(),m=cur.getMonth();
    const start=new Date(y,m-1,1).toLocaleDateString('en-CA');
    const end=new Date(y,m+2,0).toLocaleDateString('en-CA');
    const {events:evts}=await fetchCalendarEvents({userId:profile.id,isManager:isMgr,startDate:start,endDate:end});
    setEvents(isMgr&&selUser!=='all'?evts.filter(e=>e.user_id===selUser||e.is_firm_wide):evts);
  },[profile,cur,selUser,isMgr]);

  useEffect(()=>{
    if(!loading){
      loadEvents();
      if(isMgr) fetchAllProfiles().then(r=>setProfiles(r.profiles||[]));
      supabase.from('matters').select('id,client,name').order('created_at',{ascending:false}).then(({data})=>setMatters(data||[]));
    }
  },[loading,loadEvents]);

  function showMsg(msg,type='success'){setAlert({msg,type});setTimeout(()=>setAlert({msg:'',type:''}),5000);}

  function openAdd(date=''){
    setEditEv(null);
    setForm({...blankForm,start_date:date||today()});
    setShowForm(true);
  }
  function openEdit(ev){
    setEditEv(ev);
    setForm({title:ev.title,description:ev.description||'',event_type:ev.event_type||'meeting',start_date:ev.start_date,end_date:ev.end_date||'',start_time:ev.start_time||'09:00',end_time:ev.end_time||'10:00',all_day:ev.all_day||false,matter_id:ev.matter_id||'',is_firm_wide:ev.is_firm_wide||false,location:ev.location||'',user_id:ev.user_id||''});
    setShowForm(true);
  }

  async function handleSave(){
    if(!form.title||!form.start_date){showMsg('Title and start date are required.','error');return;}
    setSaving(true);
    const payload={...form,color:EV_COLORS[form.event_type]||'#8DC63F',user_id:(isMgr&&form.user_id)?form.user_id:profile.id,branch_id:profile.branch_id||null};
    if(editEv) payload.id=editEv.id;
    const {error}=await saveCalendarEvent(payload,profile.id);
    setSaving(false);
    if(error){showMsg('Error: '+error.message,'error');return;}
    showMsg(editEv?'✓ Event updated.':'✓ Event created.');
    setShowForm(false);
    loadEvents();
  }

  async function handleDelete(id){
    if(!confirm('Delete this event?'))return;
    const {error}=await deleteCalendarEvent(id);
    if(error){showMsg('Error: '+error.message,'error');return;}
    showMsg('Event deleted.');
    setShowForm(false);
    loadEvents();
  }

  const y=cur.getFullYear(),m=cur.getMonth();
  const firstDay=new Date(y,m,1).getDay();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const todayStr=today();
  const monthStr=`${y}-${String(m+1).padStart(2,'0')}`;

  function dayEvts(day){
    const d=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return events.filter(e=>e.start_date===d||(e.end_date&&e.start_date<=d&&e.end_date>=d));
  }

  const upcoming=events.filter(e=>e.start_date>=todayStr).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  const past=events.filter(e=>e.start_date<todayStr).sort((a,b)=>b.start_date.localeCompare(a.start_date)).slice(0,20);

  const C={
    page:{background:'#0A0A0A',minHeight:'100vh',fontFamily:"'DM Sans',system-ui,sans-serif",color:'#F0F0F0'},
    hdr:{background:'#0F0F0F',borderBottom:'1px solid #1A1A1A',padding:'0 24px',height:56,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100},
    main:{maxWidth:1200,margin:'0 auto',padding:'20px 24px'},
    card:{background:'#111',border:'1px solid #1A1A1A',borderRadius:8,padding:16,marginBottom:14},
    btn:(v='s')=>({background:v==='p'?'#8DC63F':v==='r'?'rgba(220,80,80,0.15)':'transparent',border:v==='p'?'none':v==='r'?'1px solid rgba(220,80,80,0.4)':'1px solid #252525',color:v==='p'?'#0A0A0A':v==='r'?'#E05252':'#888',padding:'6px 14px',borderRadius:6,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:v==='p'?700:500}),
    sel:{background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'5px 10px',borderRadius:6,fontSize:12,fontFamily:'inherit'},
  };
  const inp={background:'#1A1A1A',border:'1px solid #252525',color:'#F0F0F0',padding:'9px 12px',borderRadius:6,fontSize:12,fontFamily:"'DM Sans',system-ui,sans-serif",width:'100%',boxSizing:'border-box'};
  const lbl={fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:4,display:'block'};

  if(loading) return <div style={{...C.page,display:'flex',alignItems:'center',justifyContent:'center',color:'#444',fontSize:13}}>Loading...</div>;

  return(<>
    <Head><title>MB SmartTrack — Calendar</title></Head>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif}::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#2A2A2A;border-radius:2px}select option{background:#1A1A1A;color:#F0F0F0}input[type=date],input[type=time]{color-scheme:dark}button:hover{opacity:.85}textarea{resize:vertical;}`}</style>
    <div style={C.page}>

      <div style={C.hdr}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/logo.png" alt="MB" style={{width:34,height:34,objectFit:'contain',borderRadius:6}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex';}}/>
          <div style={{display:'none',background:'#8DC63F',borderRadius:6,width:34,height:34,alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:13,color:'#0A0A0A'}}>MB</div>
          <div><div style={{fontSize:13,fontWeight:700,letterSpacing:'-0.02em'}}>SmartTrack — Calendar</div><div style={{fontSize:9,color:'#3A3A3A',textTransform:'uppercase',letterSpacing:'0.1em'}}>Motsoeneng Bill · {profile?.full_name}</div></div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          <button style={C.btn()} onClick={()=>router.back()}>← Back</button>
          <button style={C.btn('p')} onClick={()=>openAdd()}>+ New Event</button>
          <button style={C.btn('r')} onClick={async()=>{await signOut();router.replace('/login');}}>Sign out</button>
        </div>
      </div>

      {alert.msg&&<div style={{background:alert.type==='error'?'rgba(220,80,80,0.1)':'rgba(141,198,63,0.1)',border:`1px solid ${alert.type==='error'?'rgba(220,80,80,0.4)':'rgba(141,198,63,0.3)'}`,padding:'12px 24px',fontSize:12,color:alert.type==='error'?'#E05252':'#8DC63F',display:'flex',justifyContent:'space-between'}}><span>{alert.msg}</span><button style={{background:'none',border:'none',color:'inherit',cursor:'pointer'}} onClick={()=>setAlert({msg:'',type:''})}>✕</button></div>}

      <div style={C.main}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button style={C.btn()} onClick={()=>setCur(new Date(y,m-1,1))}>‹</button>
            <div style={{fontSize:16,fontWeight:700,minWidth:190,textAlign:'center'}}>{new Date(y,m,1).toLocaleDateString('en-ZA',{month:'long',year:'numeric'})}</div>
            <button style={C.btn()} onClick={()=>setCur(new Date(y,m+1,1))}>›</button>
            <button style={{...C.btn(),fontSize:11}} onClick={()=>setCur(new Date())}>Today</button>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {isMgr&&<select style={C.sel} value={selUser} onChange={e=>setSelUser(e.target.value)}><option value="all">All attorneys</option>{profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select>}
            <div style={{display:'flex',background:'#1A1A1A',border:'1px solid #252525',borderRadius:6,padding:2}}>
              {[['month','Month'],['list','List']].map(([v,l])=>(
                <button key={v} style={{background:view===v?'#2A2A2A':'transparent',border:'none',color:view===v?'#F0F0F0':'#555',padding:'4px 12px',borderRadius:5,cursor:'pointer',fontSize:11,fontFamily:'inherit'}} onClick={()=>setView(v)}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {view==='month'&&(<div style={C.card}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:1}}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><div key={d} style={{padding:'6px 4px',fontSize:10,color:'#444',textTransform:'uppercase',letterSpacing:'.05em',fontWeight:600,textAlign:'center'}}>{d}</div>)}
            {Array.from({length:firstDay},(_,i)=><div key={'b'+i}/>)}
            {Array.from({length:daysInMonth},(_,i)=>{
              const day=i+1;
              const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const de=dayEvts(day);
              const isToday=ds===todayStr;
              return(<div key={day} style={{minHeight:88,padding:4,border:'1px solid #161616',borderRadius:4,background:isToday?'rgba(141,198,63,0.04)':'transparent',cursor:'pointer'}} onClick={()=>openAdd(ds)}>
                <div style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?'#8DC63F':'#555',width:22,height:22,borderRadius:'50%',background:isToday?'rgba(141,198,63,0.15)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:3}}>{day}</div>
                {de.slice(0,3).map(ev=>(
                  <div key={ev.id} style={{background:ev.color||'#8DC63F',borderRadius:3,padding:'2px 5px',fontSize:9,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'#000',fontWeight:600,cursor:'pointer'}} onClick={e=>{e.stopPropagation();openEdit(ev);}}>
                    {ev.all_day?'':((ev.start_time||'').substring(0,5)+' ')}{ev.title}
                  </div>
                ))}
                {de.length>3&&<div style={{fontSize:9,color:'#555'}}>+{de.length-3} more</div>}
              </div>);
            })}
          </div>
        </div>)}

        {view==='list'&&(<div>
          {upcoming.length>0&&(<div style={C.card}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Upcoming Events ({upcoming.length})</div>
            {upcoming.map(ev=>{
              const atty=profiles.find(p=>p.id===ev.user_id);
              return(<div key={ev.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid #161616',cursor:'pointer'}} onClick={()=>openEdit(ev)}>
                <div style={{width:4,height:42,borderRadius:2,background:ev.color||'#8DC63F',flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0'}}>{ev.title}{ev.location?<span style={{fontWeight:400,color:'#555',fontSize:11}}> · {ev.location}</span>:null}</div>
                  <div style={{fontSize:10,color:'#555'}}>{fdate(ev.start_date)}{!ev.all_day&&ev.start_time?` · ${ev.start_time.substring(0,5)}–${(ev.end_time||'').substring(0,5)}`:' · All day'}</div>
                  {ev.matter_id&&<div style={{fontSize:10,color:'#A78BFA',marginTop:2}}>{ev.matter_id}</div>}
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0,flexWrap:'wrap',justifyContent:'flex-end'}}>
                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:`${ev.color||'#8DC63F'}22`,color:ev.color||'#8DC63F',border:`1px solid ${ev.color||'#8DC63F'}44`,textTransform:'capitalize'}}>{ev.event_type}</span>
                  {ev.is_firm_wide&&<span style={{fontSize:9,padding:'2px 8px',borderRadius:20,background:'rgba(74,144,217,0.1)',color:'#4A90D9',border:'1px solid rgba(74,144,217,0.3)'}}>Firm-wide</span>}
                  {isMgr&&atty&&<span style={{fontSize:10,color:'#555'}}>{atty.full_name.split(' ')[0]}</span>}
                </div>
              </div>);
            })}
          </div>)}
          {past.length>0&&(<div style={{...C.card,opacity:0.55}}>
            <div style={{fontSize:12,fontWeight:600,color:'#D0D0D0',marginBottom:12}}>Past Events</div>
            {past.map(ev=>(
              <div key={ev.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid #161616',cursor:'pointer'}} onClick={()=>openEdit(ev)}>
                <div style={{width:4,height:32,borderRadius:2,background:'#333',flexShrink:0}}/>
                <div style={{flex:1}}><div style={{fontSize:11,color:'#666'}}>{ev.title}</div><div style={{fontSize:10,color:'#444'}}>{fdate(ev.start_date)}</div></div>
              </div>
            ))}
          </div>)}
          {!upcoming.length&&!past.length&&(<div style={{...C.card,textAlign:'center',padding:40,color:'#555'}}><div style={{fontSize:28,marginBottom:10}}>📅</div><div style={{fontSize:14}}>No events yet</div><button style={{...C.btn('p'),marginTop:14}} onClick={()=>openAdd()}>+ Create first event</button></div>)}
        </div>)}

        <div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:8}}>
          {Object.entries(EV_COLORS).map(([type,color])=>(<div key={type} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#444'}}><div style={{width:10,height:10,borderRadius:2,background:color}}/><span style={{textTransform:'capitalize'}}>{type}</span></div>))}
        </div>
      </div>

      {showForm&&(<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowForm(false)}>
        <div style={{background:'#111',border:'1px solid #2A2A2A',borderRadius:12,padding:28,width:'100%',maxWidth:500,maxHeight:'92vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:18}}>{editEv?'Edit Event':'New Event'}</div>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <label style={lbl}>Event Type</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {Object.entries(EV_COLORS).map(([type,color])=>(
                  <button key={type} style={{background:form.event_type===type?color:'transparent',border:`1px solid ${form.event_type===type?color:'#252525'}`,color:form.event_type===type?'#000':'#888',padding:'4px 12px',borderRadius:20,cursor:'pointer',fontSize:11,fontFamily:'inherit',textTransform:'capitalize'}} onClick={()=>setForm(f=>({...f,event_type:type}))}>{type}</button>
                ))}
              </div>
            </div>
            <div><label style={lbl}>Title *</label><input style={inp} type="text" placeholder="Event title" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Start Date *</label><input style={inp} type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/></div>
              <div><label style={lbl}>End Date</label><input style={inp} type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/></div>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#888',cursor:'pointer'}}><input type="checkbox" checked={form.all_day} onChange={e=>setForm(f=>({...f,all_day:e.target.checked}))}/> All-day event</label>
            {!form.all_day&&(<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><label style={lbl}>Start Time</label><input style={inp} type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))}/></div>
              <div><label style={lbl}>End Time</label><input style={inp} type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))}/></div>
            </div>)}
            <div><label style={lbl}>Location</label><input style={inp} type="text" placeholder="Courtroom 4B, Meeting room..." value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))}/></div>
            <div><label style={lbl}>Matter (optional)</label>
              <select style={inp} value={form.matter_id} onChange={e=>setForm(f=>({...f,matter_id:e.target.value}))}>
                <option value="">— No matter —</option>
                {matters.map(m=><option key={m.id} value={m.id}>{m.id} · {m.client}</option>)}
              </select>
            </div>
            {isMgr&&(<>
              <div><label style={lbl}>Assign to Attorney</label>
                <select style={inp} value={form.user_id} onChange={e=>setForm(f=>({...f,user_id:e.target.value}))}>
                  <option value="">— My own event —</option>
                  {profiles.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'#888',cursor:'pointer'}}><input type="checkbox" checked={form.is_firm_wide} onChange={e=>setForm(f=>({...f,is_firm_wide:e.target.checked}))}/> Firm-wide (visible to all staff)</label>
            </>)}
            <div><label style={lbl}>Notes</label><textarea style={{...inp,minHeight:72}} placeholder="Additional details..." value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/></div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:18}}>
            <div>{editEv&&<button style={C.btn('r')} onClick={()=>handleDelete(editEv.id)}>Delete</button>}</div>
            <div style={{display:'flex',gap:8}}>
              <button style={C.btn()} onClick={()=>setShowForm(false)}>Cancel</button>
              <button style={{...C.btn('p'),opacity:saving?.6:1}} disabled={saving} onClick={handleSave}>{saving?'Saving…':(editEv?'Update':'Create')}</button>
            </div>
          </div>
        </div>
      </div>)}

    </div>
  </>);
}

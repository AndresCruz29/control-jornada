import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LogIn, LogOut, Coffee, Droplets, History, Clock3,
  Undo2, ChevronDown, ChevronRight, CalendarDays, AlertTriangle
} from "lucide-react";
import "./style.css";

const EVENT_META = {
  entrada: { label: "Entrada", icon: LogIn, ramp: "amber" },
  salida: { label: "Salida", icon: LogOut, ramp: "teal" },
  pausa_inicio: { label: "Inicio descanso", icon: Coffee, ramp: "coral" },
  pausa_fin: { label: "Fin descanso", icon: Coffee, ramp: "amber" },
  bano_inicio: { label: "Inicio baño", icon: Droplets, ramp: "coral" },
  bano_fin: { label: "Fin baño", icon: Droplets, ramp: "amber" },
};

const RAMP = {
  amber: { fill:"#3D2E14", text:"#E8A33D", border:"#5C4420" },
  teal: { fill:"#12332F", text:"#4FB0A5", border:"#1F4F49" },
  coral: { fill:"#3A1E1B", text:"#E4685D", border:"#5C2E29" },
};

const STATUS_META = {
  fuera:{ label:"Fuera", ramp:"gray" },
  trabajando:{ label:"Trabajando", ramp:"amber" },
  pausa:{ label:"En descanso", ramp:"coral" },
  bano:{ label:"En el baño", ramp:"coral" },
};

const pad = n => String(n).padStart(2, "0");
const dateStrOf = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

function labelForDate(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  const dt = new Date(y,m-1,d);
  const dias=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const meses=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return { dow:dias[dt.getDay()], full:`${d} ${meses[dt.getMonth()]}`, dowShort:dias[dt.getDay()].slice(0,3), dt };
}

function endOfDayTs(dateStr) {
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y,m-1,d,23,59,59,999).getTime();
}

function getSchedule(dt) {
  const dow=dt.getDay();
  if(dow>=1 && dow<=4) return {start:"07:00",end:"17:00",hours:10};
  if(dow===5) return {start:"07:00",end:"15:00",hours:8};
  return null;
}

function formatClock(ts) {
  return new Date(ts).toLocaleTimeString("es-CR",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});
}

function formatDuration(ms) {
  ms=Math.max(0,ms||0);
  const sec=Math.floor(ms/1000), h=Math.floor(sec/3600), m=Math.floor(sec%3600/60);
  return `${h}h ${pad(m)}m`;
}

function computeStats(events, nowTs) {
  const sorted=[...events].sort((a,b)=>a.ts-b.ts);
  let state="fuera", lastTs=null, workedMs=0, breakMs=0, bathMs=0;
  let entradaTs=null, salidaTs=null;

  for(const ev of sorted){
    if(lastTs!==null){
      const delta=Math.max(0,ev.ts-lastTs);
      if(state==="trabajando") workedMs+=delta;
      else if(state==="pausa") breakMs+=delta;
      else if(state==="bano") bathMs+=delta;
    }
    if(ev.type==="entrada"){ state="trabajando"; if(entradaTs===null) entradaTs=ev.ts; }
    else if(ev.type==="salida"){ state="fuera"; salidaTs=ev.ts; }
    else if(ev.type==="pausa_inicio") state="pausa";
    else if(ev.type==="pausa_fin") state="trabajando";
    else if(ev.type==="bano_inicio") state="bano";
    else if(ev.type==="bano_fin") state="trabajando";
    lastTs=ev.ts;
  }
  if(state!=="fuera" && lastTs!==null){
    const delta=Math.max(0,nowTs-lastTs);
    if(state==="trabajando") workedMs+=delta;
    else if(state==="pausa") breakMs+=delta;
    else if(state==="bano") bathMs+=delta;
  }
  return {state,workedMs,breakMs,bathMs,entradaTs,salidaTs,events:sorted};
}

function feedback(type="normal"){
  if("vibrate" in navigator){
    const pattern = type==="undo" ? [40,35,80] : type==="salida" ? [45,25,45] : 55;
    navigator.vibrate(pattern);
  }
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx) return;
    const ctx=new Ctx(), osc=ctx.createOscillator(), gain=ctx.createGain();
    const freq={entrada:720,salida:420,pausa_inicio:520,pausa_fin:620,bano_inicio:500,bano_fin:600,undo:300,normal:560}[type]||560;
    osc.type="sine"; osc.frequency.setValueAtTime(freq,ctx.currentTime);
    gain.gain.setValueAtTime(.05,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.14);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime+.14);
    osc.addEventListener("ended",()=>ctx.close());
  }catch{}
}

function getEvents(dateStr){
  try{return JSON.parse(localStorage.getItem(`timeclock:${dateStr}`)||"[]")}catch{return []}
}
function getIndex(){
  try{return JSON.parse(localStorage.getItem("timeclock:index")||"[]")}catch{return []}
}

function App(){
  const [now,setNow]=useState(Date.now());
  const [tab,setTab]=useState("hoy");
  const [todayEvents,setTodayEvents]=useState([]);
  const [index,setIndex]=useState([]);
  const [historyCache,setHistoryCache]=useState({});
  const [expanded,setExpanded]=useState({});
  const [confirmUndo,setConfirmUndo]=useState(false);
  const saving=useRef(false);

  const todayStr=dateStrOf(new Date(now));
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
  useEffect(()=>{setTodayEvents(getEvents(dateStrOf(new Date())));setIndex(getIndex())},[]);

  const saveToday=useCallback((events)=>{
    const keyDate=dateStrOf(new Date());
    localStorage.setItem(`timeclock:${keyDate}`,JSON.stringify(events));
    let idx=getIndex();
    if(!idx.includes(keyDate)){idx=[keyDate,...idx];localStorage.setItem("timeclock:index",JSON.stringify(idx));setIndex(idx)}
    setTodayEvents(events);
  },[]);

  const punch=(type)=>{
    if(saving.current) return;
    saving.current=true;
    feedback(type);
    saveToday([...todayEvents,{type,ts:Date.now()}]);
    setTimeout(()=>saving.current=false,300);
  };

  const confirmUndoAction=()=>{
    if(!todayEvents.length) return;
    feedback("undo");
    saveToday(todayEvents.slice(0,-1));
    setConfirmUndo(false);
  };

  useEffect(()=>{
    if(tab!=="historial") return;
    const cache={};
    for(const d of index) cache[d]=getEvents(d);
    setHistoryCache(cache);
  },[tab,index]);

  const stats=computeStats(todayEvents,now);
  const status=STATUS_META[stats.state];
  const schedule=getSchedule(new Date(now));
  const dateLabel=labelForDate(todayStr);
  const clockStr=new Date(now).toLocaleTimeString("es-CR",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});
  const canEntrada=stats.state==="fuera";
  const canSalida=stats.state==="trabajando";
  const canPausaInicio=stats.state==="trabajando", canPausaFin=stats.state==="pausa";
  const canBanoInicio=stats.state==="trabajando", canBanoFin=stats.state==="bano";
  const scheduledMs=schedule?schedule.hours*3600000:null;
  const restanteMs=scheduledMs===null?null:Math.max(scheduledMs-stats.workedMs,0);
  const lastEvent=todayEvents.at(-1);

  return <div className="app">
    <header>
      <div><div className="date">{dateLabel.dow}, {dateLabel.full}</div></div>
      <div className="schedule">{schedule?`${schedule.start}–${schedule.end}`:"Sin jornada"}</div>
    </header>

    <div className="tabs">
      <button className={tab==="hoy"?"active":""} onClick={()=>setTab("hoy")}><Clock3 size={15}/> Hoy</button>
      <button className={tab==="historial"?"active":""} onClick={()=>setTab("historial")}><History size={15}/> Historial</button>
    </div>

    {tab==="hoy" ? <main>
      <section className="live">
        <div className={`clock mono ${status.ramp==="gray"?"":status.ramp}`}>{clockStr}</div>
        <div className={`status ${status.ramp}`}><i></i>{status.label}</div>
      </section>

      <button className={`primary ${canEntrada?"entry":canSalida?"exit":""}`} onClick={()=>punch(canEntrada?"entrada":"salida")} disabled={!canEntrada&&!canSalida}>
        {canEntrada?<LogIn size={20}/>:<LogOut size={20}/>}
        {canEntrada?"Marcar entrada":"Marcar salida"}
      </button>
      {!canEntrada&&!canSalida&&<p className="hint">Termina tu {stats.state==="pausa"?"descanso":"ida al baño"} antes de marcar salida</p>}

      <div className="secondary">
        <button onClick={()=>punch(canPausaFin?"pausa_fin":"pausa_inicio")} disabled={!canPausaInicio&&!canPausaFin}>
          <Coffee size={16}/>{canPausaFin?"Terminar descanso":"Iniciar descanso"}
        </button>
        <button onClick={()=>punch(canBanoFin?"bano_fin":"bano_inicio")} disabled={!canBanoInicio&&!canBanoFin}>
          <Droplets size={16}/>{canBanoFin?"Terminar baño":"Ir al baño"}
        </button>
      </div>

      <div className="summary">
        <Stat label="Trabajado hoy" value={formatDuration(stats.workedMs)}/>
        <Stat label={restanteMs!==null?"Restante de jornada":"Descansos + baño"} value={formatDuration(restanteMs!==null?restanteMs:stats.breakMs+stats.bathMs)}/>
        <Stat label="Descansos" value={formatDuration(stats.breakMs)} small/>
        <Stat label="Baño" value={formatDuration(stats.bathMs)} small/>
      </div>

      <section className="timeline-section">
        <div className="section-title"><span>Marcajes de hoy</span>
          {todayEvents.length>0&&<button className="undo" onClick={()=>setConfirmUndo(true)}><Undo2 size={14}/>Deshacer</button>}
        </div>
        {todayEvents.length===0?<EmptyToday/>:<TimelineList events={stats.events}/>}
      </section>
    </main>:
    <main className="history">
      {index.length===0?<EmptyHistory/>:index.map(d=><DayCard key={d} dateStr={d} events={d===todayStr?todayEvents:historyCache[d]} isToday={d===todayStr} now={now} expanded={!!expanded[d]} onToggle={()=>setExpanded(p=>({...p,[d]:!p[d]}))}/>)}
    </main>}

    {confirmUndo&&<div className="modal-backdrop" onClick={()=>setConfirmUndo(false)}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-icon"><Undo2 size={20}/></div>
        <h2>¿Deshacer último marcaje?</h2>
        <p>{lastEvent&&<>Se eliminará: <strong>{EVENT_META[lastEvent.type].label}</strong><br/><span className="mono">{formatClock(lastEvent.ts)}</span></>}</p>
        <div className="modal-actions">
          <button onClick={()=>setConfirmUndo(false)}>Cancelar</button>
          <button className="danger" onClick={confirmUndoAction}>Sí, deshacer</button>
        </div>
      </div>
    </div>}
  </div>
}

function Stat({label,value,small}) { return <div className="stat"><div>{label}</div><strong className={`mono ${small?"small":""}`}>{value}</strong></div> }

function EmptyToday(){return <div className="empty"><div>Aún no has marcado nada hoy.</div><small>Toca “Marcar entrada” para empezar tu jornada.</small></div>}
function EmptyHistory(){return <div className="empty history-empty"><CalendarDays size={24}/><div>Todavía no tienes días registrados.</div><small>Cuando marques tu primera entrada, aparecerá aquí.</small></div>}

function TimelineList({events}){
  return <div className="timeline">{[...events].reverse().map((ev,i)=>{
    const meta=EVENT_META[ev.type], Icon=meta.icon, ramp=RAMP[meta.ramp];
    return <div className="event" key={`${ev.ts}-${i}`}>
      <div className="event-icon" style={{background:ramp.fill,color:ramp.text}}><Icon size={14}/></div>
      <span>{meta.label}</span><time className="mono">{formatClock(ev.ts)}</time>
    </div>
  })}</div>
}

function DayCard({dateStr,events=[],isToday,now,expanded,onToggle}){
  const lbl=labelForDate(dateStr), schedule=getSchedule(lbl.dt);
  const stats=computeStats(events,isToday?now:endOfDayTs(dateStr));
  const missingExit=!isToday && events.length>0 && stats.state!=="fuera";

  return <article className={`day-card ${isToday?"today":""} ${missingExit?"incomplete":""}`}>
    <button className="day-head" onClick={onToggle}>
      <div className="day-left">{expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}<div>
        <strong>{lbl.dowShort} {lbl.full} {isToday&&<em>· hoy</em>}</strong>
        {schedule&&<small className="mono">{schedule.start}–{schedule.end}</small>}
      </div></div>
      <div className="day-total"><strong className="mono">{formatDuration(stats.workedMs)}</strong>
        {missingExit?<span className="warning"><AlertTriangle size={12}/> Sin marca de salida</span>:<small>{stats.state==="fuera"?"cerrado":"en curso"}</small>}
      </div>
    </button>
    {expanded&&<div className="day-detail">
      {missingExit&&<div className="notice"><AlertTriangle size={15}/> Este día quedó abierto. El cálculo se detuvo al finalizar ese día.</div>}
      <div className="detail-stats"><Stat label="Descansos" value={formatDuration(stats.breakMs)} small/><Stat label="Baño" value={formatDuration(stats.bathMs)} small/></div>
      {events.length?<TimelineList events={events}/>:<small>Sin marcajes.</small>}
    </div>}
  </article>
}

createRoot(document.getElementById("root")).render(<App/>);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/control-jornada/sw.js");
  });
}

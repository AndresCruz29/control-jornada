import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as XLSX from "xlsx";

import {
  LogIn,
  LogOut,
  Coffee,
  Droplets,
  History,
  Clock3,
  Undo2,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  AlertTriangle,
  Download
} from "lucide-react";

import "./style.css";


const EVENT_META = {
  entrada: {
    label: "Entrada",
    icon: LogIn,
    ramp: "amber"
  },

  salida: {
    label: "Salida",
    icon: LogOut,
    ramp: "teal"
  },

  pausa_inicio: {
    label: "Inicio descanso",
    icon: Coffee,
    ramp: "coral"
  },

  pausa_fin: {
    label: "Fin descanso",
    icon: Coffee,
    ramp: "amber"
  },

  bano_inicio: {
    label: "Inicio baño",
    icon: Droplets,
    ramp: "coral"
  },

  bano_fin: {
    label: "Fin baño",
    icon: Droplets,
    ramp: "amber"
  },

  otro_inicio: {
    label: "Inicio otro",
    icon: Clock3,
    ramp: "coral"
  },

  otro_fin: {
    label: "Fin otro",
    icon: Clock3,
    ramp: "amber"
  }
};


const RAMP = {
  amber: {
    fill: "#3D2E14",
    text: "#E8A33D",
    border: "#5C4420"
  },

  teal: {
    fill: "#12332F",
    text: "#4FB0A5",
    border: "#1F4F49"
  },

  coral: {
    fill: "#3A1E1B",
    text: "#E4685D",
    border: "#5C2E29"
  }
};


const STATUS_META = {
  fuera: {
    label: "Fuera",
    ramp: "gray"
  },

  trabajando: {
    label: "Trabajando",
    ramp: "amber"
  },

  pausa: {
    label: "En descanso",
    ramp: "coral"
  },

  bano: {
    label: "En el baño",
    ramp: "coral"
  },

  otro: {
    label: "En otra actividad",
    ramp: "coral"
  }
};


const pad = n => String(n).padStart(2, "0");


const dateStrOf = d =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;


function labelForDate(dateStr) {

  const [y, m, d] =
    dateStr.split("-").map(Number);

  const dt =
    new Date(y, m - 1, d);

  const dias = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado"
  ];

  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic"
  ];

  return {
    dow: dias[dt.getDay()],
    full: `${d} ${meses[dt.getMonth()]}`,
    dowShort: dias[dt.getDay()].slice(0, 3),
    dt
  };

}


function monthName(monthIndex) {

  return [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
  ][monthIndex];

}


function endOfDayTs(dateStr) {

  const [y, m, d] =
    dateStr.split("-").map(Number);

  return new Date(
    y,
    m - 1,
    d,
    23,
    59,
    59,
    999
  ).getTime();

}


function getSchedule(dt) {

  const dow =
    dt.getDay();

  if (dow >= 1 && dow <= 4) {

    return {
      start: "07:00",
      end: "17:00",
      hours: 10
    };

  }

  if (dow === 5) {

    return {
      start: "07:00",
      end: "15:00",
      hours: 8
    };

  }

  return null;

}


function formatClock(ts) {

  return new Date(ts).toLocaleTimeString(
    "es-CR",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }
  );

}


function formatClockShort(ts) {

  if (!ts) return "—";

  return new Date(ts).toLocaleTimeString(
    "es-CR",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }
  );

}


function formatDuration(ms) {

  ms =
    Math.max(0, ms || 0);

  const sec =
    Math.floor(ms / 1000);

  const h =
    Math.floor(sec / 3600);

  const m =
    Math.floor(
      (sec % 3600) / 60
    );

  return `${h}h ${pad(m)}m`;

}


function formatTimer(ms) {

  ms =
    Math.max(0, ms || 0);

  const totalSeconds =
    Math.floor(ms / 1000);

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const seconds =
    totalSeconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

}


function computeStats(events, nowTs, dateStr = null) {

  const sorted =
    [...events].sort(
      (a, b) => a.ts - b.ts
    );

  let state = "fuera";

  let lastTs = null;

  let breakMs = 0;
  let bathMs = 0;
  let otherMs = 0;

  let entradaTs = null;
  let salidaTs = null;


  for (const ev of sorted) {

    if (lastTs !== null) {

      const delta =
        Math.max(
          0,
          ev.ts - lastTs
        );


      if (state === "pausa") {

        breakMs += delta;

      }

      else if (state === "bano") {

        bathMs += delta;

      }

      else if (state === "otro") {

        otherMs += delta;

      }

    }


    if (ev.type === "entrada") {

      state = "trabajando";

      if (entradaTs === null) {
        entradaTs = ev.ts;
      }

    }

    else if (ev.type === "salida") {

      state = "fuera";
      salidaTs = ev.ts;

    }

    else if (ev.type === "pausa_inicio") {

      state = "pausa";

    }

    else if (ev.type === "pausa_fin") {

      state = "trabajando";

    }

    else if (ev.type === "bano_inicio") {

      state = "bano";

    }

    else if (ev.type === "bano_fin") {

      state = "trabajando";

    }

    else if (ev.type === "otro_inicio") {

      state = "otro";

    }

    else if (ev.type === "otro_fin") {

      state = "trabajando";

    }


    lastTs = ev.ts;

  }


  /*
    Si el día sigue activo, las actividades
    informativas continúan contando hasta nowTs.
  */

  if (
    state !== "fuera" &&
    lastTs !== null
  ) {

    const delta =
      Math.max(
        0,
        nowTs - lastTs
      );


    if (state === "pausa") {

      breakMs += delta;

    }

    else if (state === "bano") {

      bathMs += delta;

    }

    else if (state === "otro") {

      otherMs += delta;

    }

  }


  /*
    El tiempo trabajado es TODO el tiempo
    entre la primera entrada y la salida.

    Descanso, baño y otro NO descuentan.
  */

  let workedMs = 0;

  if (entradaTs !== null) {

    const endTs =
      salidaTs !== null
        ? salidaTs
        : nowTs;

    workedMs =
      Math.max(
        0,
        endTs - entradaTs
      );

  }


  let extraMs = 0;

  const isClosed =
    salidaTs !== null;


  /*
    Las horas extra solo se confirman
    cuando existe una salida.
  */

  if (
    isClosed &&
    entradaTs !== null &&
    dateStr
  ) {

    const [, month, day] =
      dateStr.split("-").map(Number);

    const [year] =
      dateStr.split("-").map(Number);

    const dt =
      new Date(
        year,
        month - 1,
        day
      );

    const schedule =
      getSchedule(dt);

    if (schedule) {

      extraMs =
        Math.max(
          workedMs -
          schedule.hours * 3600000,
          0
        );

    }

    else {

      /*
        Sábado y domingo:
        todo cuenta como extra.
      */

      extraMs =
        workedMs;

    }

  }


  return {
    state,
    workedMs,
    breakMs,
    bathMs,
    otherMs,
    extraMs,
    entradaTs,
    salidaTs,
    events: sorted
  };

}


function feedback(type = "normal") {

  if ("vibrate" in navigator) {

    const pattern =
      type === "undo"
        ? [40, 35, 80]
        : type === "salida"
        ? [45, 25, 45]
        : 55;

    navigator.vibrate(pattern);

  }


  try {

    const Ctx =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!Ctx) return;


    const ctx =
      new Ctx();

    const osc =
      ctx.createOscillator();

    const gain =
      ctx.createGain();


    const freq = {
      entrada: 720,
      salida: 420,
      pausa_inicio: 520,
      pausa_fin: 620,
      bano_inicio: 500,
      bano_fin: 600,
      otro_inicio: 540,
      otro_fin: 650,
      undo: 300,
      normal: 560
    }[type] || 560;


    osc.type = "sine";

    osc.frequency.setValueAtTime(
      freq,
      ctx.currentTime
    );


    gain.gain.setValueAtTime(
      0.05,
      ctx.currentTime
    );


    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.14
    );


    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    osc.stop(
      ctx.currentTime + 0.14
    );

    osc.addEventListener(
      "ended",
      () => ctx.close()
    );

  }

  catch {}

}


function getEvents(dateStr) {

  try {

    return JSON.parse(
      localStorage.getItem(
        `timeclock:${dateStr}`
      ) || "[]"
    );

  }

  catch {

    return [];

  }

}


function getIndex() {

  try {

    return JSON.parse(
      localStorage.getItem(
        "timeclock:index"
      ) || "[]"
    );

  }

  catch {

    return [];

  }

}


/*
  Genera todos los días entre start y end.
*/
function getDatesInRange(start, end) {

  const dates = [];

  const current =
    new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );

  while (current <= end) {

    dates.push(
      dateStrOf(current)
    );

    current.setDate(
      current.getDate() + 1
    );

  }

  return dates;

}


function exportQuincena(quincena) {

  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    now.getMonth();

  const lastDay =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  const startDay =
    quincena === 1
      ? 1
      : 16;

  const endDay =
    quincena === 1
      ? 15
      : lastDay;


  const start =
    new Date(
      year,
      month,
      startDay
    );

  const end =
    new Date(
      year,
      month,
      endDay
    );


  const dates =
    getDatesInRange(
      start,
      end
    );


  const resumenRows = [];

  const marcajesRows = [];


  let totalWorked = 0;
  let totalExtra = 0;
  let totalBreak = 0;


  for (const dateStr of dates) {

    const events =
      getEvents(dateStr);

    const lbl =
      labelForDate(dateStr);

    const schedule =
      getSchedule(lbl.dt);

const isToday =
  dateStr === dateStrOf(new Date());


const calculationEndTs =
  isToday
    ? Date.now()
    : endOfDayTs(dateStr);


const stats =
  computeStats(
    events,
    calculationEndTs,
    dateStr
  );

    const missingExit =
      events.length > 0 &&
      stats.entradaTs !== null &&
      stats.salidaTs === null;


    let estado;

    if (missingExit) {

      estado =
        "Sin marca de salida";

    }

    else if (!events.length) {

      estado =
        schedule
          ? "Sin marcajes"
          : "Sin jornada";

    }

    else {

      estado =
        "Cerrado";

    }


resumenRows.push({
  Fecha: `${pad(lbl.dt.getDate())}/${pad(lbl.dt.getMonth() + 1)}/${lbl.dt.getFullYear()}`,
  Día: lbl.dow,

  Entrada:
    stats.entradaTs !== null
      ? formatClockShort(stats.entradaTs)
      : "—",

  Salida:
    stats.salidaTs !== null
      ? formatClockShort(stats.salidaTs)
      : "—",

  "Total trabajado":
    missingExit
      ? "—"
      : events.length
      ? formatDuration(stats.workedMs)
      : "—",

  "Horas extras":
    missingExit
      ? "—"
      : events.length
      ? formatDuration(stats.extraMs)
      : "—",

  Descanso:
    missingExit
      ? "—"
      : events.length
      ? formatDuration(stats.breakMs)
      : "—",

  Baño:
    missingExit
      ? "—"
      : events.length
      ? formatDuration(stats.bathMs)
      : "—",

  Otro:
    missingExit
      ? "—"
      : events.length
      ? formatDuration(stats.otherMs)
      : "—",

  Estado: estado
});

if (!missingExit) {

  totalWorked +=
    stats.workedMs;

  totalExtra +=
    stats.extraMs;

  totalBreak +=
    stats.breakMs;

}

    for (const ev of stats.events) {

      marcajesRows.push({
        Fecha: `${pad(lbl.dt.getDate())}/${pad(lbl.dt.getMonth() + 1)}/${lbl.dt.getFullYear()}`,
        Día: lbl.dow,
        Hora: formatClock(ev.ts),
        Evento:
          EVENT_META[ev.type]?.label ||
          ev.type
      });

    }

  }


  resumenRows.push({
    Fecha: "TOTALES",
    Día: "",
    Entrada: "",
    Salida: "",
    "Total trabajado": formatDuration(totalWorked),
    "Horas extras": formatDuration(totalExtra),
    Descanso: formatDuration(totalBreak),
    Baño: "",
    Otro: "",
    Estado: ""
  });


  const workbook =
    XLSX.utils.book_new();


  const resumenSheet =
    XLSX.utils.json_to_sheet(
      resumenRows
    );

  const marcajesSheet =
    XLSX.utils.json_to_sheet(
      marcajesRows.length
        ? marcajesRows
        : [{
            Fecha: "",
            Día: "",
            Hora: "",
            Evento: "Sin marcajes en esta quincena"
          }]
    );


  resumenSheet["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 22 }
  ];


  marcajesSheet["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 }
  ];


  XLSX.utils.book_append_sheet(
    workbook,
    resumenSheet,
    "Resumen"
  );


  XLSX.utils.book_append_sheet(
    workbook,
    marcajesSheet,
    "Marcajes"
  );


  const fileName =
    `Control_Jornada_${year}-${pad(month + 1)}_Quincena_${quincena}.xlsx`;


  XLSX.writeFile(
    workbook,
    fileName
  );

}


function App() {

  const [now, setNow] =
    useState(Date.now());

  const [tab, setTab] =
    useState("hoy");

  const [todayEvents, setTodayEvents] =
    useState([]);

  const [index, setIndex] =
    useState([]);

  const [historyCache, setHistoryCache] =
    useState({});

  const [expanded, setExpanded] =
    useState({});

  const [confirmUndo, setConfirmUndo] =
    useState(false);


  const saving =
    useRef(false);


  const todayStr =
    dateStrOf(
      new Date(now)
    );


  useEffect(() => {

    const t =
      setInterval(
        () => setNow(Date.now()),
        1000
      );

    return () =>
      clearInterval(t);

  }, []);


  useEffect(() => {

    setTodayEvents(
      getEvents(
        dateStrOf(new Date())
      )
    );

    setIndex(
      getIndex()
    );

  }, []);


  const saveToday =
    useCallback((events) => {

      const keyDate =
        dateStrOf(new Date());


      localStorage.setItem(
        `timeclock:${keyDate}`,
        JSON.stringify(events)
      );


      let idx =
        getIndex();


      if (!idx.includes(keyDate)) {

        idx = [
          keyDate,
          ...idx
        ];


        localStorage.setItem(
          "timeclock:index",
          JSON.stringify(idx)
        );


        setIndex(idx);

      }


      setTodayEvents(events);

    }, []);


  const punch = (type) => {

    if (saving.current) return;

    saving.current = true;

    feedback(type);

    saveToday([
      ...todayEvents,
      {
        type,
        ts: Date.now()
      }
    ]);

    setTimeout(
      () => saving.current = false,
      300
    );

  };


  const confirmUndoAction = () => {

    if (!todayEvents.length) return;

    feedback("undo");

    saveToday(
      todayEvents.slice(0, -1)
    );

    setConfirmUndo(false);

  };


  useEffect(() => {

    if (tab !== "historial") return;

    const cache = {};

    for (const d of index) {

      cache[d] =
        getEvents(d);

    }

    setHistoryCache(cache);

  }, [tab, index]);


  const stats =
    computeStats(
      todayEvents,
      now,
      todayStr
    );


  const status =
    STATUS_META[
      stats.state
    ];


  const schedule =
    getSchedule(
      new Date(now)
    );


  const dateLabel =
    labelForDate(todayStr);


  const clockStr =
    new Date(now).toLocaleTimeString(
      "es-CR",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      }
    );


  const canEntrada =
    stats.state === "fuera";


  const canSalida =
    stats.state === "trabajando";


  const canPausaInicio =
    stats.state === "trabajando";


  const canPausaFin =
    stats.state === "pausa";


  const canBanoInicio =
    stats.state === "trabajando";


  const canBanoFin =
    stats.state === "bano";


  const canOtroInicio =
    stats.state === "trabajando";


  const canOtroFin =
    stats.state === "otro";


  const scheduledMs =
    schedule
      ? schedule.hours * 3600000
      : null;


  /*
    Descanso, baño y otro ya NO descuentan.
  */

  const restanteMs =
    scheduledMs === null

      ? null

      : Math.max(
          scheduledMs -
          stats.workedMs,
          0
        );


  const lastEvent =
    todayEvents.at(-1);


  const activeTimer =

    ["pausa", "bano", "otro"].includes(
      stats.state
    )

    &&

    lastEvent

      ? now - lastEvent.ts

      : null;


  const currentMonth =
    new Date(now).getMonth();

  const currentYear =
    new Date(now).getFullYear();

  const currentLastDay =
    new Date(
      currentYear,
      currentMonth + 1,
      0
    ).getDate();


  return (

    <div className="app">

      <header>

        <div>

          <div className="date">

            {dateLabel.dow},{" "}
            {dateLabel.full}

          </div>

        </div>

        <div className="schedule">

          {
            schedule
              ? `${schedule.start}–${schedule.end}`
              : "Sin jornada"
          }

        </div>

      </header>


      <div className="tabs">

        <button
          className={
            tab === "hoy"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("hoy")
          }
        >

          <Clock3 size={15}/>

          Hoy

        </button>


        <button
          className={
            tab === "historial"
              ? "active"
              : ""
          }
          onClick={() =>
            setTab("historial")
          }
        >

          <History size={15}/>

          Historial

        </button>

      </div>


      {
        tab === "hoy"

          ?

          <main>

            <section className="live">

              <div
                className={
                  `clock mono ${
                    status.ramp === "gray"
                      ? ""
                      : status.ramp
                  }`
                }
              >

                {clockStr}

              </div>


              <div
                className={
                  `status ${status.ramp}`
                }
              >

                <i></i>

                {status.label}

              </div>


              {
                activeTimer !== null && (

                  <div className="activity-timer">

                    <span>
                      Tiempo transcurrido
                    </span>

                    <strong className="mono">

                      {
                        formatTimer(
                          activeTimer
                        )
                      }

                    </strong>

                  </div>

                )
              }

            </section>


            <button

              className={
                `primary ${
                  canEntrada
                    ? "entry"
                    : canSalida
                    ? "exit"
                    : ""
                }`
              }

              onClick={() =>
                punch(
                  canEntrada
                    ? "entrada"
                    : "salida"
                )
              }

              disabled={
                !canEntrada &&
                !canSalida
              }
            >

              {
                canEntrada
                  ? <LogIn size={20}/>
                  : <LogOut size={20}/>
              }

              {
                canEntrada
                  ? "Marcar entrada"
                  : "Marcar salida"
              }

            </button>


            {
              !canEntrada &&
              !canSalida && (

                <p className="hint">

                  Termina tu{" "}

                  {
                    stats.state === "pausa"

                      ? "descanso"

                      : stats.state === "bano"

                      ? "ida al baño"

                      : "actividad"
                  }

                  {" "}antes de marcar salida

                </p>

              )
            }


            <div className="secondary">

              <button

                onClick={() =>

                  punch(

                    canPausaFin
                      ? "pausa_fin"
                      : "pausa_inicio"

                  )

                }

                disabled={
                  !canPausaInicio &&
                  !canPausaFin
                }

              >

                <Coffee size={16}/>

                {
                  canPausaFin
                    ? "Terminar descanso"
                    : "Iniciar descanso"
                }

              </button>


              <button

                onClick={() =>

                  punch(

                    canBanoFin
                      ? "bano_fin"
                      : "bano_inicio"

                  )

                }

                disabled={
                  !canBanoInicio &&
                  !canBanoFin
                }

              >

                <Droplets size={16}/>

                {
                  canBanoFin
                    ? "Terminar baño"
                    : "Ir al baño"
                }

              </button>


              <button

                onClick={() =>

                  punch(

                    canOtroFin
                      ? "otro_fin"
                      : "otro_inicio"

                  )

                }

                disabled={
                  !canOtroInicio &&
                  !canOtroFin
                }

              >

                <Clock3 size={16}/>

                {
                  canOtroFin
                    ? "Terminar otro"
                    : "Otro"
                }

              </button>

            </div>


            <div className="summary">

              <Stat
                label="Trabajado hoy"
                value={
                  formatDuration(
                    stats.workedMs
                  )
                }
              />


              <Stat
                label={
                  restanteMs !== null
                    ? "Restante de jornada"
                    : "Sin jornada programada"
                }
                value={
                  restanteMs !== null
                    ? formatDuration(restanteMs)
                    : "—"
                }
              />


              <Stat
                label="Horas extras"
                value={
                  stats.salidaTs !== null
                    ? formatDuration(stats.extraMs)
                    : "—"
                }
              />


              <Stat
                label="Descansos"
                value={
                  formatDuration(
                    stats.breakMs
                  )
                }
                small
              />


              <Stat
                label="Baño"
                value={
                  formatDuration(
                    stats.bathMs
                  )
                }
                small
              />


              <Stat
                label="Otro"
                value={
                  formatDuration(
                    stats.otherMs
                  )
                }
                small
              />

            </div>


            <section className="timeline-section">

              <div className="section-title">

                <span>
                  Marcajes de hoy
                </span>

                {
                  todayEvents.length > 0 && (

                    <button
                      className="undo"
                      onClick={() =>
                        setConfirmUndo(true)
                      }
                    >

                      <Undo2 size={14}/>

                      Deshacer

                    </button>

                  )
                }

              </div>


              {
                todayEvents.length === 0

                  ? <EmptyToday/>

                  :

                  <TimelineList
                    events={stats.events}
                  />
              }

            </section>

          </main>


          :

          <main className="history">

            <section className="export-section">

              <div className="export-title">

                <Download size={18}/>

                <div>

                  <strong>
                    Exportar Excel
                  </strong>

                  <small>
                    {monthName(currentMonth)} {currentYear}
                  </small>

                </div>

              </div>


              <div className="export-buttons">

                <button
                  onClick={() =>
                    exportQuincena(1)
                  }
                >
                  1 – 15
                </button>


                <button
                  onClick={() =>
                    exportQuincena(2)
                  }
                >
                  16 – {currentLastDay}
                </button>

              </div>

            </section>


            {
              index.length === 0

                ? <EmptyHistory/>

                :

                index.map(d => (

                  <DayCard

                    key={d}

                    dateStr={d}

                    events={
                      d === todayStr
                        ? todayEvents
                        : historyCache[d]
                    }

                    isToday={
                      d === todayStr
                    }

                    now={now}

                    expanded={
                      !!expanded[d]
                    }

                    onToggle={() =>

                      setExpanded(p => ({
                        ...p,
                        [d]: !p[d]
                      }))

                    }

                  />

                ))
            }

          </main>
      }


      {
        confirmUndo && (

          <div

            className="modal-backdrop"

            onClick={() =>
              setConfirmUndo(false)
            }
          >

            <div

              className="modal"

              onClick={e =>
                e.stopPropagation()
              }
            >

              <div className="modal-icon">

                <Undo2 size={20}/>

              </div>


              <h2>
                ¿Deshacer último marcaje?
              </h2>


              <p>

                {
                  lastEvent && (

                    <>

                      Se eliminará:{" "}

                      <strong>

                        {
                          EVENT_META[
                            lastEvent.type
                          ].label
                        }

                      </strong>

                      <br/>

                      <span className="mono">

                        {
                          formatClock(
                            lastEvent.ts
                          )
                        }

                      </span>

                    </>

                  )
                }

              </p>


              <div className="modal-actions">

                <button

                  onClick={() =>
                    setConfirmUndo(false)
                  }
                >
                  Cancelar
                </button>


                <button

                  className="danger"

                  onClick={
                    confirmUndoAction
                  }
                >
                  Sí, deshacer
                </button>

              </div>

            </div>

          </div>

        )
      }

    </div>

  );

}


function Stat({
  label,
  value,
  small
}) {

  return (

    <div className="stat">

      <div>
        {label}
      </div>

      <strong
        className={
          `mono ${
            small
              ? "small"
              : ""
          }`
        }
      >
        {value}
      </strong>

    </div>

  );

}


function EmptyToday() {

  return (

    <div className="empty">

      <div>
        Aún no has marcado nada hoy.
      </div>

      <small>
        Toca “Marcar entrada” para empezar tu jornada.
      </small>

    </div>

  );

}


function EmptyHistory() {

  return (

    <div className="empty history-empty">

      <CalendarDays size={24}/>

      <div>
        Todavía no tienes días registrados.
      </div>

      <small>
        Cuando marques tu primera entrada,
        aparecerá aquí.
      </small>

    </div>

  );

}


function TimelineList({ events }) {

  return (

    <div className="timeline">

      {
        [...events]
          .reverse()
          .map((ev, i) => {

            const meta =
              EVENT_META[ev.type];

            const Icon =
              meta.icon;

            const ramp =
              RAMP[meta.ramp];


            return (

              <div

                className="event"

                key={`${ev.ts}-${i}`}
              >

                <div

                  className="event-icon"

                  style={{
                    background:
                      ramp.fill,

                    color:
                      ramp.text
                  }}
                >

                  <Icon size={14}/>

                </div>


                <span>
                  {meta.label}
                </span>


                <time className="mono">

                  {
                    formatClock(
                      ev.ts
                    )
                  }

                </time>

              </div>

            );

          })
      }

    </div>

  );

}


function DayCard({
  dateStr,
  events = [],
  isToday,
  now,
  expanded,
  onToggle
}) {

  const lbl =
    labelForDate(dateStr);

  const schedule =
    getSchedule(lbl.dt);

  const stats =
    computeStats(
      events,
      isToday
        ? now
        : endOfDayTs(dateStr),
      dateStr
    );


  const missingExit =

    !isToday

    &&

    events.length > 0

    &&

    stats.entradaTs !== null

    &&

    stats.salidaTs === null;


  const displayExtra =
    missingExit
      ? null
      : stats.extraMs;


  return (

    <article

      className={
        `day-card ${
          isToday
            ? "today"
            : ""
        } ${
          missingExit
            ? "incomplete"
            : ""
        }`
      }
    >

      <button

        className="day-head"

        onClick={onToggle}
      >

        <div className="day-left">

          {
            expanded
              ? <ChevronDown size={16}/>
              : <ChevronRight size={16}/>
          }

          <div>

            <strong>

              {lbl.dowShort}
              {" "}
              {lbl.full}

              {
                isToday && (

                  <em>
                    {" "}· hoy
                  </em>

                )
              }

            </strong>


            {
              schedule && (

                <small className="mono">

                  {schedule.start}
                  –
                  {schedule.end}

                </small>

              )
            }

          </div>

        </div>


        <div className="day-total">

          <strong className="mono">

            {
              formatDuration(
                stats.workedMs
              )
            }

          </strong>


          {
            missingExit

              ?

              <span className="warning">

                <AlertTriangle size={12}/>

                Sin marca de salida

              </span>

              :

              <small>

                {
                  stats.salidaTs !== null
                    ? `Extra: ${formatDuration(displayExtra)}`
                    : stats.state === "fuera"
                    ? "cerrado"
                    : "en curso"
                }

              </small>

          }

        </div>

      </button>


      {
        expanded && (

          <div className="day-detail">

            {
              missingExit && (

                <div className="notice">

                  <AlertTriangle size={15}/>

                  Este día quedó abierto.
                  El cálculo se detuvo al finalizar ese día.

                </div>

              )
            }


            <div className="detail-stats">

              <Stat
                label="Total trabajado"
                value={
                  formatDuration(
                    stats.workedMs
                  )
                }
                small
              />


              <Stat
                label="Horas extras"
                value={
                  displayExtra === null
                    ? "—"
                    : formatDuration(
                        displayExtra
                      )
                }
                small
              />


              <Stat
                label="Descansos"
                value={
                  formatDuration(
                    stats.breakMs
                  )
                }
                small
              />


              <Stat
                label="Baño"
                value={
                  formatDuration(
                    stats.bathMs
                  )
                }
                small
              />


              <Stat
                label="Otro"
                value={
                  formatDuration(
                    stats.otherMs
                  )
                }
                small
              />

            </div>


            {
              events.length

                ?

                <TimelineList
                  events={events}
                />

                :

                <small>
                  Sin marcajes.
                </small>
            }

          </div>

        )
      }

    </article>

  );

}


createRoot(
  document.getElementById("root")
).render(
  <App/>
);


if ("serviceWorker" in navigator) {

  window.addEventListener("load", async () => {

    try {

      const registration =
        await navigator.serviceWorker.register(
          "/control-jornada/sw.js"
        );

      await registration.update();

      registration.addEventListener(
        "updatefound",
        () => {

          const newWorker =
            registration.installing;

          if (!newWorker) return;

          newWorker.addEventListener(
            "statechange",
            () => {

              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {

                window.location.reload();

              }

            }
          );

        }
      );

    }

    catch (error) {

      console.error(
        "Error actualizando la aplicación:",
        error
      );

    }

  });

}

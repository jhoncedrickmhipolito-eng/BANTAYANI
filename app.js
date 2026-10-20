/* ============================================================
   BantayAni — main application
   Flow: sensor reading → saved to system → if out of safe range
         → SMS alert to owner's phone → shown in dashboard
   ============================================================ */

/* ---------- storage helpers ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

const KEYS = {
  readings: "bantayani.readings",
  owner: "bantayani.owner",
  alerts: "bantayani.alerts",
  sms: "bantayani.smsLog",
  lastSms: "bantayani.lastSmsAt",
};

/* ---------- state ---------- */
const state = {
  readings: store.get(KEYS.readings, []),
  owner: store.get(KEYS.owner, { name: "", contact: "" }),
  alerts: store.get(KEYS.alerts, []),
  smsLog: store.get(KEYS.sms, []),
  sensor: "ph",
  year: "all",
  month: "all",
  basis: "all",
  simTimer: null,
};

const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // min gap between SMS for same sensor

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const els = {
  sensorSelect: $("sensorSelect"), yearSelect: $("yearSelect"), monthSelect: $("monthSelect"),
  basisSelect: $("basisSelect"), ownerContact: $("ownerContact"), ownerName: $("ownerName"),
  recentValue: $("recentValue"), recentStatus: $("recentStatus"),
  statusChips: $("statusChips"), cropRec: $("cropRecommendation"), fertRec: $("fertRecommendation"),
  phValue: $("phValue"), phClass: $("phClass"), phBarFill: $("phBarFill"),
  metricCards: $("metricCards"), chartTitle: $("chartTitle"), chartHint: $("chartHint"),
  alertList: $("alertList"), smsList: $("smsList"),
  manualForm: $("manualForm"), manualSensor: $("manualSensor"), manualValue: $("manualValue"),
  simToggle: $("simToggle"), toastContainer: $("toastContainer"), analysisSubtitle: $("analysisSubtitle"),
};

/* ---------- init ---------- */
function init() {
  // fill sensor dropdowns
  SENSOR_KEYS.forEach((k) => {
    const label = `${SENSORS[k].name}${SENSORS[k].unit ? " (" + SENSORS[k].unit + ")" : ""}`;
    els.sensorSelect.add(new Option(label, k));
    els.manualSensor.add(new Option(label, k));
  });

  // restore owner
  els.ownerName.value = state.owner.name;
  els.ownerContact.value = state.owner.contact;

  // seed demo data if empty (30 days of readings)
  if (state.readings.length === 0) {
    seedDemoData();
  }

  rebuildTimeFilters();
  renderAll();

  /* ---------- events ---------- */
  els.sensorSelect.addEventListener("change", (e) => { state.sensor = e.target.value; renderAll(); });
  els.yearSelect.addEventListener("change", (e) => { state.year = e.target.value; renderAll(); });
  els.monthSelect.addEventListener("change", (e) => { state.month = e.target.value; renderAll(); });
  els.basisSelect.addEventListener("change", (e) => { state.basis = e.target.value; renderAll(); });

  const saveOwner = () => {
    state.owner = { name: els.ownerName.value.trim(), contact: els.ownerContact.value.trim() };
    store.set(KEYS.owner, state.owner);
  };
  els.ownerName.addEventListener("input", saveOwner);
  els.ownerContact.addEventListener("input", saveOwner);

  els.manualForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = parseFloat(els.manualValue.value);
    if (Number.isNaN(value)) return;
    addReading(els.manualSensor.value, value, "manual");
    els.manualValue.value = "";
    toast("Reading saved", `${SENSORS[els.manualSensor.value].name}: ${value} added to system.`, "ok");
  });

  els.simToggle.addEventListener("click", toggleSimulation);
}

/* ---------- demo data ---------- */
function seedDemoData() {
  const now = Date.now();
  const readings = [];
  const last = {};
  SENSOR_KEYS.forEach((k) => (last[k] = SENSORS[k].base));

  for (let d = 30; d >= 0; d--) {
    for (let h = 0; h < 24; h += 6) {
      const ts = now - d * 86400000 + h * 3600000;
      if (ts > now) continue;
      SENSOR_KEYS.forEach((k) => {
        const cfg = SENSORS[k];
        // random walk around the base value
        last[k] += (Math.random() - 0.5) * cfg.drift * 2;
        last[k] += (cfg.base - last[k]) * 0.15;             // pull back to baseline
        // occasional drift outside safe range to demo alerts
        if (Math.random() < 0.02) last[k] += (Math.random() < 0.5 ? -1 : 1) * cfg.drift * 2.5;
        const v = Math.max(0, round(last[k], cfg.decimals));
        readings.push({ sensor: k, value: v, ts, source: "sensor" });
      });
    }
  }
  state.readings = readings;
  store.set(KEYS.readings, readings);
}

/* ---------- readings ---------- */
function addReading(sensor, value, source) {
  const reading = { sensor, value, ts: Date.now(), source };
  state.readings.push(reading);
  store.set(KEYS.readings, state.readings);
  rebuildTimeFilters();
  checkAlert(reading);
  renderAll();
}

/* filtered readings by selected sensor / year / month / basis */
function filteredReadings(sensorKey = state.sensor) {
  return state.readings
    .filter((r) => r.sensor === sensorKey)
    .filter((r) => state.basis === "all" || r.source === state.basis)
    .filter((r) => {
      const d = new Date(r.ts);
      if (state.year !== "all" && d.getFullYear() !== +state.year) return false;
      if (state.month !== "all" && d.getMonth() !== +state.month) return false;
      return true;
    })
    .sort((a, b) => a.ts - b.ts);
}

/* latest reading for a sensor (respecting basis filter) */
function latest(sensorKey) {
  const list = filteredReadings(sensorKey);
  return list[list.length - 1] || null;
}

/* value status vs safe range */
function valueStatus(sensorKey, value) {
  const { min, max } = SENSORS[sensorKey];
  if (value < min) return { level: "low", cls: "bad", text: `below safe range (${min}–${max})` };
  if (value > max) return { level: "high", cls: "bad", text: `above safe range (${min}–${max})` };
  return { level: "ok", cls: "ok", text: `within safe range (${min}–${max})` };
}

/* ---------- alert + SMS ---------- */
function checkAlert(reading) {
  const cfg = SENSORS[reading.sensor];
  if (reading.value < cfg.min || reading.value > cfg.max) {
    const st = valueStatus(reading.sensor, reading.value);
    const alert = {
      sensor: reading.sensor,
      value: reading.value,
      level: st.level,
      ts: reading.ts,
      message: `${cfg.name} is ${reading.value}${cfg.unit ? " " + cfg.unit : ""} — ${st.text}.`,
    };
    state.alerts.unshift(alert);
    state.alerts = state.alerts.slice(0, 100);
    store.set(KEYS.alerts, state.alerts);

    // rate-limit SMS per sensor (cooldown)
    const lastSms = store.get(KEYS.lastSms, {});
    const now = Date.now();
    if (!lastSms[reading.sensor] || now - lastSms[reading.sensor] > ALERT_COOLDOWN_MS) {
      lastSms[reading.sensor] = now;
      store.set(KEYS.lastSms, lastSms);
      sendSMS(alert);
    }
  }
}

/* Send SMS to owner's phone.
   NOTE: browsers cannot send SMS directly — this logs the message to the
   system (SMS log + popup). To send real texts, point this function at a
   small backend (e.g. Twilio): POST /api/sms { to, message }. */
function sendSMS(alert) {
  const cfg = SENSORS[alert.sensor];
  const to = state.owner.contact || "no contact no. set";
  const who = state.owner.name ? ` (Owner: ${state.owner.name})` : "";
  const message = `[BantayAni] ⚠ ALERT${who}: ${cfg.name} = ${alert.value}${cfg.unit ? " " + cfg.unit : ""}. ` +
                  `${alert.level === "low" ? "Low reading" : "High reading"} — recommended action: ` +
                  `${alert.sensor === "ph" ? phAdjustAdvice(alert.value) : fertilizerAdviceShort(alert.sensor, alert.value)}.`;

  const entry = { to, message, ts: Date.now(), status: "sent (simulated)" };
  state.smsLog.unshift(entry);
  state.smsLog = state.smsLog.slice(0, 50);
  store.set(KEYS.sms, state.smsLog);

  toast(`SMS → ${to}`, message, "bad");
  renderLogs();

  // >>> REAL SMS HOOK (Twilio example) >>>
  // fetch("/api/sms", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ to, message }),
  // });
}

/* ---------- recommendations ---------- */
/* Crop type: match current soil pH against the reference pH table */
function recommendCrops(ph) {
  const suitable = CROPS.filter((c) => ph >= c.min && ph <= c.max);
  // rank: closest to the crop's ideal center first
  suitable.sort((a, b) =>
    Math.abs(ph - (a.min + a.max) / 2) - Math.abs(ph - (b.min + a.max) / 2)
  );
  return suitable;
}

function phAdjustAdvice(ph) {
  if (ph < 6.5) return `soil is acidic — apply agricultural lime (dolomite) to raise pH toward 6.5–7.5`;
  if (ph > 7.5) return `soil is alkaline — apply elemental sulfur or organic matter to lower pH toward 6.5–7.5`;
  return `soil pH is ideal — no adjustment needed`;
}

function fertilizerAdviceShort(sensorKey, value) {
  const std = NPK_STANDARDS[sensorKey];
  const fert = FERTILIZERS[sensorKey];
  if (!std || !fert) return "check the dashboard for recommendations";
  if (value < std.min) return `apply ${fert.product} to raise ${sensorKey} into ${std.min}–${std.max} mg/kg`;
  if (value > std.max) return `reduce fertilizer — ${sensorKey} exceeds ${std.max} mg/kg`;
  return `maintain current fertilization`;
}

/* Fertilizer amount: compute deficit vs standards → estimated kg/ha */
function fertilizerPlan() {
  const plan = [];
  ["nitrogen", "phosphorus", "potassium"].forEach((k) => {
    const r = latest(k);
    const std = NPK_STANDARDS[k];
    const fert = FERTILIZERS[k];
    const name = SENSORS[k].short;
    if (!r) { plan.push({ key: k, name, text: "no data yet", cls: "muted" }); return; }

    const v = r.value;
    if (v < std.min) {
      const deficit = std.min - v;
      const nutrientKgHa = deficit * 2;                       // mg/kg → kg/ha (0–15 cm topsoil)
      const productKgHa = Math.round(nutrientKgHa / fert.fraction);
      plan.push({
        key: k, name,
        value: `${v} mg/kg`,
        text: `DEFICIENT — apply ≈ ${productKgHa} kg/ha ${fert.product} (adds ${Math.round(nutrientKgHa)} kg/ha ${name})`,
        cls: "bad",
      });
    } else if (v > std.max) {
      plan.push({
        key: k, name, value: `${v} mg/kg`,
        text: `EXCESS — stop ${name} fertilizer; excess harms soil & yield`,
        cls: "bad",
      });
    } else {
      const [lo, hi] = std.ideal;
      const tip = v < lo ? `slightly low vs ideal (${lo}–${hi} mg/kg) — light top-dressing` : "ideal level";
      plan.push({ key: k, name, value: `${v} mg/kg`, text: `OK — ${tip}`, cls: "ok" });
    }
  });
  return plan;
}

/* ---------- rendering ---------- */
function renderAll() {
  renderRecent();
  renderChips();
  renderPhCard();
  renderMetrics();
  renderRecommendations();
  renderChart();
  renderLogs();
}

function renderRecent() {
  const cfg = SENSORS[state.sensor];
  const r = latest(state.sensor);
  if (!r) {
    els.recentValue.textContent = "—";
    els.recentStatus.textContent = "no data";
    els.recentStatus.className = "rr-status";
    return;
  }
  els.recentValue.textContent = `${r.value}${cfg.unit ? " " + cfg.unit : ""}`;
  const st = valueStatus(state.sensor, r.value);
  els.recentStatus.textContent = `${st.text} · ${new Date(r.ts).toLocaleString()}`;
  els.recentStatus.className = `rr-status ${st.cls}`;
}

function renderChips() {
  els.statusChips.innerHTML = "";
  SENSOR_KEYS.forEach((k) => {
    const r = latest(k);
    const chip = document.createElement("div");
    chip.className = "chip";
    let statusText = "no data";
    if (r) {
      const st = valueStatus(k, r.value);
      if (st.cls === "bad") chip.classList.add("bad");
      else if (r.value < SENSORS[k].min * 1.0 || r.value > SENSORS[k].max) chip.classList.add("warn");
      statusText = `${SENSORS[k].short} ${r.value}`;
    }
    chip.innerHTML = `<span class="dot"></span>${statusText}`;
    chip.title = `Show ${SENSORS[k].name} graph`;
    chip.addEventListener("click", () => {
      state.sensor = k;
      els.sensorSelect.value = k;
      renderAll();
    });
    els.statusChips.appendChild(chip);
  });
}

function renderPhCard() {
  const r = latest("ph");
  if (!r) return;
  const ph = r.value;
  els.phValue.textContent = ph.toFixed(2);
  const cls = PH_SCALE.find((p) => ph < p.max);
  els.phClass.textContent = `${cls.label} · ${cls.soil}`;
  // position marker on 4–10 scale (clamped)
  const pct = Math.min(100, Math.max(0, ((ph - 4) / 6) * 100));
  els.phBarFill.style.left = `${pct}%`;
}

function renderMetrics() {
  els.metricCards.innerHTML = "";
  const spark = (list) => {
    if (list.length < 2) return "–";
    const prev = list[list.length - 2].value;
    const now = list[list.length - 1].value;
    return now > prev ? "▲" : now < prev ? "▼" : "–";
  };

  SENSOR_KEYS.filter((k) => k !== "ph").forEach((k) => {
    const cfg = SENSORS[k];
    const list = filteredReadings(k);
    const r = list[list.length - 1];
    const card = document.createElement("article");
    card.className = "card metric-card" + (state.sensor === k ? " selected" : "");
    const st = r ? valueStatus(k, r.value) : null;
    card.innerHTML = `
      <span class="metric-spark">${spark(list)}</span>
      <div class="metric-name">${cfg.name}</div>
      <div class="metric-value">${r ? r.value : "—"}</div>
      <div class="metric-unit">${cfg.unit || "pH"} · safe ${cfg.min}–${cfg.max}</div>
      <div class="metric-status ${st ? st.cls : ""}">${st ? st.text : "no data"}</div>`;
    card.addEventListener("click", () => {
      state.sensor = k;
      els.sensorSelect.value = k;
      renderAll();
    });
    els.metricCards.appendChild(card);
  });
}

function renderRecommendations() {
  // --- crop type ---
  const phR = latest("ph");
  if (!phR) {
    els.cropRec.innerHTML = `<p class="muted">Waiting for pH reading…</p>`;
  } else {
    const ph = phR.value;
    const matches = recommendCrops(ph);
    if (matches.length === 0) {
      els.cropRec.innerHTML = `
        <p><b>No reference crop</b> matches pH ${ph}.</p>
        <p class="fert-note">Tip: ${phAdjustAdvice(ph)}</p>`;
    } else {
      const byCat = {};
      matches.forEach((c) => (byCat[c.category] = byCat[c.category] || []).push(c));
      let html = `<p>✅ <b>${matches.length} crops</b> suitable for current pH <b>${ph}</b>:</p>`;
      Object.keys(byCat).forEach((cat) => {
        html += `<div class="crop-cat">${cat}</div>`;
        html += byCat[cat].slice(0, 8).map((c) =>
          `<span class="crop-badge" title="suitable pH ${c.min}–${c.max}">${c.name} <small>(${c.min}–${c.max})</small></span>`
        ).join("");
        if (byCat[cat].length > 8) html += `<span class="crop-badge">+${byCat[cat].length - 8} more</span>`;
      });
      html += `<p class="fert-note" style="margin-top:6px">Top pick: <b>${matches[0].name}</b> — soil pH fits its ideal range.</p>`;
      els.cropRec.innerHTML = html;
    }
  }

  // --- fertilizer amount ---
  const plan = fertilizerPlan();
  els.fertRec.innerHTML = plan.map((p) => `
    <div class="fert-row">
      <div>
        <span class="fert-name">${p.name}</span>
        ${p.value ? `<span class="fert-val"> ${p.value}</span>` : ""}
        <div class="fert-note ${p.cls === "bad" ? "" : ""}" style="color:${p.cls === "bad" ? "#fecaca" : p.cls === "ok" ? "#bbf7d0" : ""}">${p.text}</div>
      </div>
    </div>`).join("");
}

/* ---------- chart with safe-range band ---------- */
let trendChart = null;

const safeBandPlugin = {
  id: "safeBand",
  beforeDatasetsDraw(chart, args, opts) {
    if (!opts || opts.min == null || opts.max == null) return;
    const { ctx, chartArea, scales } = chart;
    const yMin = scales.y.getPixelForValue(opts.max);
    const yMax = scales.y.getPixelForValue(opts.min);
    ctx.save();
    ctx.fillStyle = "rgba(126, 242, 157, 0.12)";
    ctx.fillRect(chartArea.left, yMin, chartArea.right - chartArea.left, yMax - yMin);
    ctx.restore();
  },
};

function renderChart() {
  const cfg = SENSORS[state.sensor];
  const list = filteredReadings(state.sensor);

  els.chartTitle.textContent = `${cfg.name} — trend line graph`;
  const period = `${state.year === "all" ? "all years" : state.year}${state.month === "all" ? "" : " / " + new Date(2000, state.month).toLocaleString("en", { month: "long" })}`;
  els.chartHint.textContent = `${list.length} readings · ${period} · green band = safe range (${cfg.min}–${cfg.max})`;

  const labels = list.map((r) => new Date(r.ts));
  const data = list.map((r) => r.value);

  const style = {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: cfg.name,
        data,
        borderColor: cfg.color,
        backgroundColor: cfg.color + "33",
        fill: true,
        tension: 0.35,
        pointRadius: data.length > 60 ? 0 : 2.5,
        pointHoverRadius: 5,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        safeBand: { min: cfg.min, max: cfg.max },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => `${cfg.name}: ${item.formattedValue}${cfg.unit ? " " + cfg.unit : ""}`,
          },
        },
      },
      scales: {
        x: {
          type: "category",
          labels: labels.map((d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit" })),
          ticks: { maxTicksLimit: 10, color: "#9fd8b4" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          ticks: { color: "#9fd8b4" },
          grid: { color: "rgba(255,255,255,0.08)" },
          suggestedMin: Math.min(cfg.min, ...(data.length ? data : [cfg.min])) * 0.9,
          suggestedMax: Math.max(cfg.max, ...(data.length ? data : [cfg.max])) * 1.1,
        },
      },
    },
    plugins: [safeBandPlugin],
  };

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById("trendChart"), style);
}

/* ---------- logs ---------- */
function renderLogs() {
  // alerts
  if (state.alerts.length === 0) {
    els.alertList.innerHTML = `<p class="muted">No alerts yet.</p>`;
  } else {
    els.alertList.innerHTML = state.alerts.slice(0, 20).map((a) => `
      <div class="log-item ${a.level === "low" || a.level === "high" ? "bad" : ""}">
        <span class="log-time">${new Date(a.ts).toLocaleString()}</span>
        ${SENSORS[a.sensor].name}: <b>${a.value}</b> ${a.level === "low" ? "▼ below" : "▲ above"} safe range
      </div>`).join("");
  }
  // sms
  if (state.smsLog.length === 0) {
    els.smsList.innerHTML = `<p class="muted">No SMS sent yet.</p>`;
  } else {
    els.smsList.innerHTML = state.smsLog.slice(0, 20).map((s) => `
      <div class="log-item bad">
        <span class="log-time">${new Date(s.ts).toLocaleString()} → ${s.to} · ${s.status}</span>
        ${s.message}
      </div>`).join("");
  }
}

/* ---------- time filters ---------- */
function rebuildTimeFilters() {
  const years = [...new Set(state.readings.map((r) => new Date(r.ts).getFullYear()))].sort((a, b) => b - a);
  const curYear = state.year, curMonth = state.month;

  els.yearSelect.innerHTML = `<option value="all">All years</option>` +
    years.map((y) => `<option value="${y}">${y}</option>`).join("");
  els.yearSelect.value = years.includes(+curYear) || curYear === "all" ? curYear : "all";
  state.year = els.yearSelect.value;

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  els.monthSelect.innerHTML = `<option value="all">All months</option>` +
    months.map((m, i) => `<option value="${i}">${m}</option>`).join("");
  els.monthSelect.value = curMonth === "all" || months[+curMonth] ? curMonth : "all";
  state.month = els.monthSelect.value;
}

/* ---------- live sensor feed (simulation) ---------- */
function toggleSimulation() {
  if (state.simTimer) {
    clearInterval(state.simTimer);
    state.simTimer = null;
    els.simToggle.textContent = "▶ Start sensor feed";
    els.simToggle.classList.remove("running");
    els.analysisSubtitle.textContent = "Sensor feed stopped — showing saved data";
    return;
  }
  els.simToggle.textContent = "⏸ Stop sensor feed";
  els.simToggle.classList.add("running");
  els.analysisSubtitle.textContent = "Live sensor feed running — readings auto-saved to system";

  const lastVals = {};
  SENSOR_KEYS.forEach((k) => {
    const r = latest(k);
    lastVals[k] = r ? r.value : SENSORS[k].base;
  });

  state.simTimer = setInterval(() => {
    SENSOR_KEYS.forEach((k) => {
      const cfg = SENSORS[k];
      lastVals[k] += (Math.random() - 0.5) * cfg.drift * 2;
      lastVals[k] += (cfg.base - lastVals[k]) * 0.1;
      if (Math.random() < 0.04) lastVals[k] += (Math.random() < 0.5 ? -1 : 1) * cfg.drift * 3; // spike
      const value = Math.max(0, round(lastVals[k], cfg.decimals));

      const reading = { sensor: k, value, ts: Date.now(), source: "sensor" };
      state.readings.push(reading);
      checkAlert(reading);
    });
    store.set(KEYS.readings, state.readings);
    renderAll();
  }, 8000);
}

/* ---------- utils ---------- */
function round(v, d) { const f = 10 ** d; return Math.round(v * f) / f; }

function toast(title, message, cls = "ok") {
  const t = document.createElement("div");
  t.className = `toast ${cls}`;
  t.innerHTML = `<b>${cls === "bad" ? "📩 SMS sent" : title}</b>${cls === "bad" ? message : ""}${cls === "bad" ? "" : message}`;
  els.toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 6000);
}

/* ---------- go ---------- */
init();

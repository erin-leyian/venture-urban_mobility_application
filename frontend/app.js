/* ============================================================
   NYC Urban Mobility Analytics — app.js
   Pure vanilla JS. Requires Leaflet 1.9, Chart.js 4.4 (CDN).
   Dataset: NYC TLC Yellow Taxi — January 2019
   ============================================================ */

const API = "http://localhost:5002/api";

/* ── State ──────────────────────────────────────────────────────────── */
let filters = {
  boroughs: [],
  minFare: 0,
  maxFare: 250,
  minDistance: 0,
  maxDistance: 50,
  date: null,   // "2019-01-XX" or null
  hour: null,   // 0-23 or null
};

let leafletMap    = null;
let geoLayer      = null;
let geoJsonCache  = null;
let allZones      = [];
let chartInstances = {};
let allTrendsData  = [];
let baselineStats  = null;   // Jan 2019 full totals for % change
let filterDebounce = null;   // debounce timer for slider changes

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fmt  = (n) => Number(n).toLocaleString();
const fmtM = (n) => "$" + (n / 1_000_000).toFixed(2) + "M";
const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n));

function hourLabel(h) {
  if (h == null) return "";
  return h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
}

async function get(path) {
  const res = await fetch(API + path);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${path}`);
  return res.json();
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

/* ── Progress bar (smooth CSS-animated) ─────────────────────────────── */
let _progressTarget = 0;
function setProgress(pct, msg) {
  _progressTarget = pct;
  const bar   = document.getElementById("progress-bar");
  const label = document.getElementById("progress-label");
  if (bar)   { bar.style.width = pct + "%"; }
  if (label) { label.textContent = msg || ""; }
}

/* ── Overlay ─────────────────────────────────────────────────────────── */
function showLoading(msg = "Loading…") {
  const ov = document.getElementById("overlay");
  ov.classList.remove("hidden");
  document.getElementById("spinner").style.display = "block";
  document.getElementById("overlay-msg").textContent = msg;
  document.getElementById("retry-btn").classList.add("hidden");
  setProgress(0, "");
}

function showError(msg) {
  const ov = document.getElementById("overlay");
  ov.classList.remove("hidden");
  document.getElementById("spinner").style.display = "none";
  document.getElementById("overlay-msg").textContent = msg;
  document.getElementById("retry-btn").classList.remove("hidden");
  setProgress(0, "");
}

function hideOverlay() {
  document.getElementById("overlay").classList.add("hidden");
  setProgress(0, "");
}

/* ── Filter-applying overlay (non-blocking mini-indicator) ───────────── */
let _filterOverlayTimer = null;
function showFilterBusy(on) {
  const btn = document.getElementById("apply-btn");
  if (on) {
    btn.textContent = "Updating…";
    btn.disabled = true;
    btn.classList.add("busy");
  } else {
    btn.textContent = "Apply Filters";
    btn.disabled = false;
    btn.classList.remove("busy");
  }
}

/* ── Build query string ──────────────────────────────────────────────── */
function buildQuery(f = filters) {
  const p = new URLSearchParams();
  if (f.date)              p.append("date", f.date);
  if (f.hour !== null)     p.append("hour", f.hour);
  if (f.minFare > 0)       p.append("min_fare", f.minFare);
  if (f.maxFare < 250)     p.append("max_fare", f.maxFare);
  if (f.minDistance > 0)   p.append("min_distance", f.minDistance);
  if (f.maxDistance < 50)  p.append("max_distance", f.maxDistance);
  const allB = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
  if (f.boroughs.length > 0 && f.boroughs.length < allB.length)
    f.boroughs.forEach((b) => p.append("borough", b));
  const s = p.toString();
  return s ? "?" + s : "";
}

/* ── KPI Cards ───────────────────────────────────────────────────────── */
function renderKPI(cards) {
  const grid = document.getElementById("kpi-grid");
  grid.innerHTML = "";
  cards.forEach(({ title, value, change, trend, sub }) => {
    const tc = trend === "up" ? "up" : trend === "down" ? "down" : "neutral";
    const icon =
      trend === "up"
        ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>`
        : trend === "down"
        ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>`
        : `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    const card = document.createElement("div");
    card.className = "kpi-card";
    card.innerHTML = `
      <div class="kpi-label">${title}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-footer">
        <span class="kpi-change ${tc}">${icon} ${change || "—"}</span>
        ${sub ? `<span class="kpi-sub">${sub}</span>` : ""}
      </div>`;
    grid.appendChild(card);
  });
}

function buildKPICards(stats) {
  const base = baselineStats || stats;
  const fareChg  = base.avg_fare  ? (((stats.avg_fare  - base.avg_fare)  / base.avg_fare)  * 100).toFixed(1) : "0.0";
  const distChg  = base.avg_distance ? (((stats.avg_distance - base.avg_distance) / base.avg_distance) * 100).toFixed(1) : "0.0";
  const tripChg  = base.total_trips ? (((stats.total_trips - base.total_trips) / base.total_trips) * 100).toFixed(1) : "0.0";

  const contextLabel = filters.date
    ? new Date(filters.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : filters.hour !== null
    ? `${hourLabel(filters.hour)} filter`
    : "January 2019";

  renderKPI([
    {
      title: "Total Trips",
      value: fmt(stats.total_trips),
      change: tripChg === "0.0" ? contextLabel : `${tripChg > 0 ? "+" : ""}${tripChg}% vs baseline`,
      trend: tripChg > 0 ? "up" : tripChg < 0 ? "down" : "neutral",
      sub: "pickup count",
    },
    {
      title: "Total Revenue",
      value: fmtM(stats.total_revenue),
      change: stats.total_trips > 0 ? `$${(stats.total_revenue / stats.total_trips).toFixed(2)}/trip` : "—",
      trend: "up",
    },
    {
      title: "Avg. Fare",
      value: `$${Number(stats.avg_fare).toFixed(2)}`,
      change: fareChg === "0.0" ? `$${Number(stats.avg_tip || 0).toFixed(2)} avg tip` : `${fareChg > 0 ? "+" : ""}${fareChg}% vs Jan avg`,
      trend: fareChg > 0 ? "up" : fareChg < 0 ? "down" : "neutral",
    },
    {
      title: "Avg. Distance",
      value: `${Number(stats.avg_distance).toFixed(1)} mi`,
      change: `${(stats.avg_speed_mph || 0).toFixed(1)} mph · ${Math.round(stats.avg_duration_minutes || 0)} min`,
      trend: distChg > 0 ? "up" : distChg < 0 ? "down" : "neutral",
      sub: distChg !== "0.0" ? `${distChg > 0 ? "+" : ""}${distChg}% vs Jan avg` : "",
    },
  ]);
}

/* ── Avg-distance stat card ──────────────────────────────────────────── */
function renderAvgStats(stats) {
  document.getElementById("avg-distance").innerHTML =
    `${(stats.avg_distance || 0).toFixed(1)}<span> miles</span>`;
  document.getElementById("avg-speed").textContent =
    `${(stats.avg_speed_mph || 0).toFixed(1)} mph`;
  document.getElementById("avg-duration").textContent =
    `${Math.round(stats.avg_duration_minutes || 0)} min`;
}

/* ── Trends chart ────────────────────────────────────────────────────── */
function renderTrends(rawData) {
  const sorted = [...rawData].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(({ date }) => {
    const d = new Date(date + "T12:00:00");
    return `Jan ${d.getDate()}`;
  });
  const values = sorted.map((r) => r.trips);

  const ctx = document.getElementById("trends-chart").getContext("2d");
  destroyChart("trends-chart");

  const grad = ctx.createLinearGradient(0, 0, 0, 220);
  grad.addColorStop(0, "rgba(255,215,0,0.3)");
  grad.addColorStop(1, "rgba(255,215,0,0)");

  chartInstances["trends-chart"] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Trips",
        data: values,
        borderColor: "#FFD700",
        borderWidth: 2.5,
        pointRadius: sorted.length <= 7 ? 4 : 3,
        pointBackgroundColor: "#FFD700",
        pointBorderColor: "#111",
        pointBorderWidth: 1,
        fill: true,
        backgroundColor: grad,
        tension: 0.35,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1a",
          borderColor: "#333",
          borderWidth: 1,
          titleColor: "#ccc",
          bodyColor: "#FFD700",
          callbacks: {
            title: (items) => items[0].label + ", 2019",
            label: (ctx) => `  ${fmt(ctx.raw)} trips`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "#222" },
          ticks: { color: "#666", font: { size: 9 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 16 },
        },
        y: {
          grid: { color: "#222" },
          ticks: { color: "#666", font: { size: 10 }, callback: (v) => fmtK(v) },
        },
      },
    },
  });

  // Update chart period label
  const label = filters.date
    ? `${new Date(filters.date + "T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`
    : "Jan 1–31, 2019";
  const periodEl = document.querySelector("#trends-chart")?.closest(".chart-card")?.querySelector(".chart-period");
  if (periodEl) periodEl.textContent = label;
}

/* ── Borough chart ───────────────────────────────────────────────────── */
function renderBorough(data) {
  const filtered = data
    .filter((b) => b.borough && !["", "Unknown", "N/A", "EWR"].includes(b.borough))
    .sort((a, b) => b.trip_count - a.trip_count);

  const ctx = document.getElementById("borough-chart").getContext("2d");
  destroyChart("borough-chart");

  const COLORS = ["#FFD700","#FFC300","#FFB300","#FFA000","#FF8F00","#FF6F00"];

  chartInstances["borough-chart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: filtered.map((b) => b.borough),
      datasets: [{
        label: "Trips",
        data: filtered.map((b) => b.trip_count),
        backgroundColor: filtered.map((b, i) => {
          // Dim boroughs not in current filter
          const active = filters.boroughs.length === 0 || filters.boroughs.includes(b.borough);
          return active ? (COLORS[i] || "#555") : "rgba(255,255,255,0.15)";
        }),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1a",
          borderColor: "#333",
          borderWidth: 1,
          titleColor: "#fff",
          bodyColor: "#FFD700",
          callbacks: {
            label: (ctx) => `  ${fmt(ctx.raw)} trips`,
            afterLabel: (ctx) => `  Revenue: ${fmtM(filtered[ctx.dataIndex].total_revenue)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "#222" },
          ticks: { color: "#666", font: { size: 10 }, callback: (v) => fmtK(v) },
        },
        y: {
          grid: { display: false },
          ticks: { color: "#aaa", font: { size: 11 } },
        },
      },
    },
  });
}

/* ── Fare distribution chart ─────────────────────────────────────────── */
function renderFare(data) {
  const order = { "$0-10":1,"$10-20":2,"$20-30":3,"$30-40":4,"$40-50":5,"$50+":6 };
  const sorted = [...data].sort((a, b) => (order[a.range]||9) - (order[b.range]||9));

  const ctx = document.getElementById("fare-chart").getContext("2d");
  destroyChart("fare-chart");

  chartInstances["fare-chart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map((d) => d.range),
      datasets: [{
        label: "Trips",
        data: sorted.map((d) => d.count),
        backgroundColor: sorted.map((d) => {
          // Highlight only bars within active fare filter
          const inRange = d.range !== undefined;
          return inRange ? "#FFD700" : "rgba(255,215,0,0.3)";
        }),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1a",
          borderColor: "#333",
          borderWidth: 1,
          titleColor: "#fff",
          bodyColor: "#FFD700",
          callbacks: { label: (ctx) => `  ${fmt(ctx.raw)} trips` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#666", font: { size: 10 } } },
        y: { grid: { color: "#222" }, ticks: { color: "#666", font: { size: 10 }, callback: (v) => fmtK(v) } },
      },
    },
  });
}

/* ── Peak hours ──────────────────────────────────────────────────────── */
function renderPeakHours(rows) {
  const list = document.getElementById("peak-list");
  list.innerHTML = "";
  const top5 = rows.slice(0, 5);
  const maxCnt = Math.max(...top5.map((r) => r.trip_count), 1);

  top5.forEach((r) => {
    const pct = Math.round((r.trip_count / maxCnt) * 100);
    const cnt = r.trip_count > 999 ? `${(r.trip_count/1000).toFixed(1)}K` : `${r.trip_count}`;
    const isSelected = filters.hour === r.hour;
    const row = document.createElement("div");
    row.className = "peak-row" + (isSelected ? " active" : "");
    row.innerHTML = `
      <span class="peak-label">${r.label}</span>
      <div class="peak-bar-wrap">
        <div class="peak-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="peak-count">${cnt}</span>`;
    // Click a peak row to set hour filter
    row.addEventListener("click", () => {
      if (filters.hour === r.hour) {
        filters.hour = null;
        syncHourFilter(null);
      } else {
        filters.hour = r.hour;
        syncHourFilter(r.hour);
      }
      triggerFilter();
    });
    list.appendChild(row);
  });
}

/* ── Leaflet Map ─────────────────────────────────────────────────────── */
const ZONE_GEOJSON_URL = "http://localhost:5002/api/zones/geojson";

const LEGEND_STEPS = [
  { min: 100000, color: "#67000d", label: "> 100K" },
  { min: 50000,  color: "#a50f15", label: "50K – 100K" },
  { min: 20000,  color: "#cb181d", label: "20K – 50K" },
  { min: 10000,  color: "#ef3b2c", label: "10K – 20K" },
  { min: 5000,   color: "#fb6a4a", label: "5K – 10K" },
  { min: 1000,   color: "#fc9272", label: "1K – 5K" },
  { min: 100,    color: "#fcbba1", label: "100 – 1K" },
  { min: 0,      color: "#2a1a1a", label: "< 100" },
];

function getZoneColor(count) {
  for (const { min, color } of LEGEND_STEPS) {
    if (count >= min) return color;
  }
  return "#2a1a1a";
}

function buildLegend() {
  const leg = document.getElementById("map-legend");
  const title = leg.querySelector(".legend-title");
  leg.innerHTML = "";
  if (title) leg.appendChild(title);
  LEGEND_STEPS.forEach(({ color, label }) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `<div class="legend-swatch" style="background:${color}"></div><span>${label}</span>`;
    leg.appendChild(row);
  });
}

async function initMap(zoneCounts) {
  if (!leafletMap) {
    leafletMap = L.map("map", {
      center: [40.73, -73.935],
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(leafletMap);
    buildLegend();
  }

  if (geoLayer) {
    leafletMap.removeLayer(geoLayer);
    geoLayer = null;
  }

  if (!geoJsonCache) {
    try {
      const res = await fetch(ZONE_GEOJSON_URL);
      if (!res.ok) throw new Error(`GeoJSON HTTP ${res.status}`);
      geoJsonCache = await res.json();
      allZones = geoJsonCache.features.map((f) => ({
        location_id: f.properties.location_id,
        zone: (f.properties.zone || "").trim(),
        borough: (f.properties.borough || "").trim(),
      }));
    } catch (e) {
      console.error("GeoJSON load failed:", e.message);
      return;
    }
  }

  // Determine active boroughs set for dimming
  const allB = ["Manhattan","Brooklyn","Queens","Bronx","Staten Island","EWR"];
  const activeBoroughs = new Set(
    filters.boroughs.length > 0 ? filters.boroughs : allB
  );

  geoLayer = L.geoJSON(geoJsonCache, {
    style: (feature) => {
      const id  = String(feature.properties.location_id || "");
      const cnt = zoneCounts[id] || 0;
      const boro = (feature.properties.borough || "").trim();
      const inFilter = activeBoroughs.has(boro) || filters.boroughs.length === 0;
      return {
        fillColor:   inFilter ? getZoneColor(cnt) : "#1a1a1a",
        weight:      0.7,
        opacity:     1,
        color:       "rgba(255,255,255,0.15)",
        fillOpacity: inFilter ? (cnt > 0 ? 0.85 : 0.2) : 0.08,
      };
    },
    onEachFeature: (feature, layer) => {
      const p    = feature.properties;
      const id   = String(p.location_id || "");
      const cnt  = zoneCounts[id] || 0;
      const zone = (p.zone || "Unknown").trim();
      const boro = (p.borough || "").trim();

      layer.bindTooltip(
        `<strong>${zone}</strong><br/>${boro}<br/>Pickups: <b>${fmt(cnt)}</b>`,
        { sticky: true, direction: "top", className: "map-tooltip" }
      );

      layer.on({
        mouseover(e) {
          e.target.setStyle({ weight: 2, color: "#FFD700", fillOpacity: 0.95 });
          e.target.bringToFront();
        },
        mouseout(e) { geoLayer.resetStyle(e.target); },
        click() {
          const input = document.getElementById("search-input");
          if (input) {
            input.value = zone;
            document.getElementById("search-dropdown").classList.add("hidden");
            document.getElementById("search-clear-btn").classList.remove("hidden");
          }
        },
      });
    },
  }).addTo(leafletMap);

  if (geoLayer.getBounds().isValid() && !leafletMap._hasFitBounds) {
    leafletMap.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });
    leafletMap._hasFitBounds = true;
  }
}

/* ── Redraw only zone colors (no full layer rebuild) ─────────────────── */
function refreshMapColors(zoneCounts) {
  if (!geoLayer) return;
  const allB = ["Manhattan","Brooklyn","Queens","Bronx","Staten Island","EWR"];
  const activeBoroughs = new Set(
    filters.boroughs.length > 0 ? filters.boroughs : allB
  );
  geoLayer.eachLayer((layer) => {
    const p    = layer.feature?.properties;
    if (!p) return;
    const id   = String(p.location_id || "");
    const cnt  = zoneCounts[id] || 0;
    const boro = (p.borough || "").trim();
    const inFilter = activeBoroughs.has(boro) || filters.boroughs.length === 0;
    layer.setStyle({
      fillColor:   inFilter ? getZoneColor(cnt) : "#1a1a1a",
      fillOpacity: inFilter ? (cnt > 0 ? 0.85 : 0.2) : 0.08,
      color:       "rgba(255,255,255,0.15)",
      weight:      0.7,
    });
    // Update tooltip to reflect new count
    if (layer.getTooltip && layer.getTooltip()) {
      const zone = (p.zone || "Unknown").trim();
      const boro2 = (p.borough || "").trim();
      layer.bindTooltip(
        `<strong>${zone}</strong><br/>${boro2}<br/>Pickups: <b>${fmt(cnt)}</b>`,
        { sticky: true, direction: "top", className: "map-tooltip" }
      );
    }
  });
}

/* ── Highlight zone from search ──────────────────────────────────────── */
function highlightZone(locationId) {
  if (!geoLayer) return;
  geoLayer.eachLayer((layer) => {
    const id = layer.feature?.properties?.location_id;
    if (id === locationId) {
      layer.setStyle({ weight: 3, color: "#FFD700", fillOpacity: 0.95 });
      layer.bringToFront();
      if (layer.getBounds) {
        leafletMap.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 14 });
      }
    } else {
      geoLayer.resetStyle(layer);
    }
  });
}

/* ── Time-of-day histogram ───────────────────────────────────────────── */
let hourDistData = [];  // cached raw data for current date filter

async function buildHistogram(data) {
  // data: [{hour:"00", trip_count:N}] or null to fetch fresh
  if (!data) {
    const qs = filters.date ? `?date=${filters.date}` : "";
    try {
      data = await get("/statistics/pickup-time-distribution" + qs);
    } catch {
      data = Array.from({ length: 24 }, (_, i) => ({
        hour: String(i).padStart(2, "0"),
        trip_count: 100,
      }));
    }
  }
  hourDistData = data;

  const byHour = {};
  data.forEach(({ hour, trip_count }) => {
    byHour[String(parseInt(hour)).padStart(2, "0")] = trip_count;
  });
  const maxCnt = Math.max(...Object.values(byHour), 1);

  const wrap = document.getElementById("histogram");
  wrap.innerHTML = "";

  for (let i = 0; i < 24; i++) {
    const h   = String(i).padStart(2, "0");
    const cnt = byHour[h] || 0;
    const pct = Math.max(4, Math.round((cnt / maxCnt) * 100));
    const isPeak = (i >= 7 && i <= 9) || (i >= 16 && i <= 18);
    const lbl = hourLabel(i);

    const bar = document.createElement("div");
    bar.className = "histogram-bar" + (isPeak ? " peak" : "") + (filters.hour === i ? " selected" : "");
    bar.style.height = `${pct}%`;
    bar.title = `${lbl}: ${fmt(cnt)} trips`;
    bar.dataset.hour = i;
    bar.addEventListener("click", () => setHourFilter(i));
    wrap.appendChild(bar);
  }
}

function syncHourFilter(hour) {
  // Sync histogram bar highlights
  document.querySelectorAll(".histogram-bar").forEach((b) => {
    b.classList.toggle("selected", hour !== null && parseInt(b.dataset.hour) === hour);
  });
  const clearBtn = document.getElementById("clear-hour-btn");
  const badge    = document.getElementById("hour-active-badge");
  if (hour !== null) {
    const lbl = hourLabel(hour);
    clearBtn.classList.remove("hidden");
    badge.classList.remove("hidden");
    badge.textContent = lbl;
  } else {
    clearBtn.classList.add("hidden");
    badge.classList.add("hidden");
    badge.textContent = "";
  }
}

function setHourFilter(hour) {
  if (filters.hour === hour) {
    filters.hour = null;
    syncHourFilter(null);
  } else {
    filters.hour = hour;
    syncHourFilter(hour);
  }
  triggerFilter();
}

/* ── Date picker ─────────────────────────────────────────────────────── */
function initDatePicker() {
  const picker  = document.getElementById("date-picker");
  const clearBtn = document.getElementById("clear-date-btn");

  picker.addEventListener("change", () => {
    const val = picker.value;
    if (val && val >= "2019-01-01" && val <= "2019-01-31") {
      filters.date = val;
      clearBtn.classList.remove("hidden");
      // Rebuild histogram for this date's distribution immediately
      buildHistogram(null).then(() => syncHourFilter(filters.hour));
      triggerFilter();
    }
  });

  clearBtn.addEventListener("click", () => {
    filters.date = null;
    picker.value = "";
    clearBtn.classList.add("hidden");
    buildHistogram(null).then(() => syncHourFilter(filters.hour));
    triggerFilter();
  });

  document.getElementById("clear-hour-btn").addEventListener("click", () => {
    filters.hour = null;
    syncHourFilter(null);
    triggerFilter();
  });
}

/* ── Borough checkboxes ──────────────────────────────────────────────── */
const BOROUGH_COLORS = {
  Manhattan:     "#FFD700",
  Brooklyn:      "#FFC300",
  Queens:        "#FFB300",
  Bronx:         "#FFA000",
  "Staten Island": "#FF8F00",
};

function buildBoroughs(boroughData) {
  const valid = boroughData.filter(
    (b) => b.borough && !["", "Unknown", "N/A", "EWR"].includes(b.borough)
  );
  filters.boroughs = valid.map((b) => b.borough);  // start all checked

  const list = document.getElementById("borough-list");
  list.innerHTML = "";
  valid.forEach(({ borough, trip_count }) => {
    const color = BOROUGH_COLORS[borough] || "#888";
    const item  = document.createElement("div");
    item.className  = "borough-item checked";
    item.dataset.borough = borough;
    item.innerHTML = `
      <div class="borough-checkbox checked" style="--chk-color:${color}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <span class="borough-label">${borough}</span>
      <span class="borough-count">${fmtK(trip_count)}</span>`;
    item.addEventListener("click", () => toggleBorough(borough, item));
    list.appendChild(item);
  });
}

function toggleBorough(b, item) {
  const checked = filters.boroughs.includes(b);
  // Keep at least one
  if (checked && filters.boroughs.length === 1) return;
  filters.boroughs = checked
    ? filters.boroughs.filter((x) => x !== b)
    : [...filters.boroughs, b];
  const box = item.querySelector(".borough-checkbox");
  if (filters.boroughs.includes(b)) {
    item.classList.add("checked");
    box.classList.add("checked");
  } else {
    item.classList.remove("checked");
    box.classList.remove("checked");
  }
  // Immediate visual feedback on map + all charts
  triggerFilter();
}

/* ── Range sliders ───────────────────────────────────────────────────── */
function initRangeSlider({ lowId, highId, fillId, thumbLowId, thumbHighId, valueId, min, max, unit, suffix, onChange }) {
  const lowEl  = document.getElementById(lowId);
  const highEl = document.getElementById(highId);
  const fillEl = document.getElementById(fillId);
  const thumbL = document.getElementById(thumbLowId);
  const thumbH = document.getElementById(thumbHighId);
  const valLbl = document.getElementById(valueId);

  function update() {
    const lo = Number(lowEl.value);
    const hi = Number(highEl.value);
    const pLo = ((lo - min) / (max - min)) * 100;
    const pHi = ((hi - min) / (max - min)) * 100;
    fillEl.style.left    = pLo + "%";
    fillEl.style.right   = (100 - pHi) + "%";
    fillEl.style.width   = "auto";
    thumbL.style.left    = `calc(${pLo}% - 8px)`;
    thumbH.style.left    = `calc(${pHi}% - 8px)`;
    const hiLbl = hi >= max ? `${unit}${hi}${suffix}+` : `${unit}${hi}${suffix}`;
    valLbl.textContent   = `${unit}${lo}${suffix} – ${hiLbl}`;
    if (onChange) onChange(lo, hi);
  }

  lowEl.addEventListener("input", () => {
    if (Number(lowEl.value) >= Number(highEl.value))
      lowEl.value = Number(highEl.value) - Number(lowEl.step);
    update();
  });
  highEl.addEventListener("input", () => {
    if (Number(highEl.value) <= Number(lowEl.value))
      highEl.value = Number(lowEl.value) + Number(highEl.step);
    update();
  });
  update();
}

/* ── Search with autocomplete ────────────────────────────────────────── */
function initSearch() {
  const input    = document.getElementById("search-input");
  const dropdown = document.getElementById("search-dropdown");
  const clearBtn = document.getElementById("search-clear-btn");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    clearBtn.classList.toggle("hidden", q.length === 0);
    if (q.length < 1) {
      dropdown.classList.add("hidden");
      if (geoLayer) geoLayer.eachLayer((l) => geoLayer.resetStyle(l));
      return;
    }

    const matches = allZones
      .filter((z) => z.zone.toLowerCase().includes(q) || z.borough.toLowerCase().includes(q))
      .slice(0, 10);

    if (!matches.length) { dropdown.classList.add("hidden"); return; }

    dropdown.innerHTML = "";
    matches.forEach((z) => {
      const li = document.createElement("li");
      li.className = "search-suggestion";
      const hl = (str) => {
        const idx = str.toLowerCase().indexOf(q);
        if (idx === -1) return str;
        return str.slice(0, idx) + `<mark>${str.slice(idx, idx + q.length)}</mark>` + str.slice(idx + q.length);
      };
      li.innerHTML = `<span class="sug-zone">${hl(z.zone)}</span><span class="sug-boro">${z.borough}</span>`;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = z.zone;
        dropdown.classList.add("hidden");
        clearBtn.classList.remove("hidden");
        highlightZone(z.location_id);
      });
      dropdown.appendChild(li);
    });
    dropdown.classList.remove("hidden");
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { dropdown.classList.add("hidden"); input.blur(); }
    if (e.key === "Enter") {
      const first = dropdown.querySelector("li");
      if (first) first.dispatchEvent(new MouseEvent("mousedown"));
    }
    if (e.key === "ArrowDown") {
      const items = dropdown.querySelectorAll("li");
      const active = dropdown.querySelector("li.keyboard-active");
      const next = active ? active.nextElementSibling : items[0];
      if (active) active.classList.remove("keyboard-active");
      if (next) next.classList.add("keyboard-active");
    }
    if (e.key === "ArrowUp") {
      const items = dropdown.querySelectorAll("li");
      const active = dropdown.querySelector("li.keyboard-active");
      const prev = active ? active.previousElementSibling : items[items.length - 1];
      if (active) active.classList.remove("keyboard-active");
      if (prev) prev.classList.add("keyboard-active");
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => dropdown.classList.add("hidden"), 160);
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    dropdown.classList.add("hidden");
    clearBtn.classList.add("hidden");
    if (geoLayer) geoLayer.eachLayer((l) => geoLayer.resetStyle(l));
    if (geoLayer?.getBounds().isValid()) {
      leafletMap.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });
    }
  });
}

/* ── Update header badge ─────────────────────────────────────────────── */
function updateBadge(stats) {
  const parts = [`${fmt(stats.total_trips)} trips`];
  if (filters.date) {
    parts.push(new Date(filters.date + "T12:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    }));
  } else {
    parts.push("January 2019");
  }
  if (filters.hour !== null) parts.push(hourLabel(filters.hour));
  if (filters.boroughs.length > 0 && filters.boroughs.length < 5)
    parts.push(filters.boroughs.join(", "));
  document.getElementById("trip-count-badge").textContent = parts.join(" · ");
}

/* ── Core: apply all filters, refresh every component ───────────────── */
let _filterInFlight = false;
async function applyFilters() {
  if (_filterInFlight) return;
  _filterInFlight = true;
  showFilterBusy(true);

  const qs = buildQuery();
  try {
    // Fetch all filtered data in parallel
    const [stats, peaks, zones, boroughs, fares] = await Promise.all([
      get("/statistics" + qs),
      get("/statistics/peak-hours" + qs),
      get("/statistics/by-zone" + qs),
      get("/statistics/by-borough" + qs),
      get("/statistics/fare-distribution" + qs),
    ]);

    // KPI + badge
    updateBadge(stats);
    buildKPICards(stats);
    renderAvgStats(stats);

    // Map — fast color refresh, no layer rebuild
    const counts = {};
    Object.entries(zones).forEach(([k, v]) => { counts[String(k)] = v; });
    refreshMapColors(counts);

    // Charts
    renderPeakHours(peaks);
    renderBorough(boroughs);
    renderFare(fares);

    // Trends: if date selected, re-fetch with borough filter only
    const trendsQs = filters.boroughs.length > 0 && filters.boroughs.length < 5
      ? "?" + filters.boroughs.map(b => `borough=${encodeURIComponent(b)}`).join("&")
      : "";
    const trends = await get("/statistics/trends" + trendsQs);
    renderTrends(trends);

  } catch (err) {
    console.error("Filter error:", err);
  } finally {
    _filterInFlight = false;
    showFilterBusy(false);
  }
}

/* ── Debounced filter trigger (for sliders) ──────────────────────────── */
function triggerFilter(immediate = false) {
  if (filterDebounce) clearTimeout(filterDebounce);
  if (immediate) {
    applyFilters();
  } else {
    filterDebounce = setTimeout(applyFilters, 350);
  }
}

/* ── Initial full load ───────────────────────────────────────────────── */
async function fetchAndRender() {
  setProgress(8, "Connecting…");

  const [stats, peaks, zones, boroughs] = await Promise.all([
    get("/statistics"),
    get("/statistics/peak-hours"),
    get("/statistics/by-zone"),
    get("/statistics/by-borough"),
  ]);
  baselineStats = stats;  // store for % change comparisons

  setProgress(35, "Rendering KPIs…");

  document.getElementById("trip-count-badge").textContent =
    `${fmt(stats.total_trips)} trips · January 2019`;

  buildBoroughs(boroughs);
  buildKPICards(stats);
  renderAvgStats(stats);
  renderPeakHours(peaks);

  setProgress(55, "Loading map…");

  const counts = {};
  Object.entries(zones).forEach(([k, v]) => { counts[String(k)] = v; });
  await initMap(counts);  // first load: builds the layer

  setProgress(72, "Map ready ✓");
  hideOverlay();   // Dashboard is usable NOW

  // Phase 2: background loading of charts + histogram
  (async () => {
    try {
      const [trends, fares, hourDist] = await Promise.all([
        get("/statistics/trends"),
        get("/statistics/fare-distribution"),
        get("/statistics/pickup-time-distribution"),
      ]);

      allTrendsData = trends;

      setProgress(85, "Rendering charts…");
      renderTrends(trends);
      renderBorough(boroughs);
      renderFare(fares);

      setProgress(95, "Building histogram…");
      await buildHistogram(hourDist);

      // Wire search after GeoJSON is cached
      initSearch();

      setProgress(100, "Ready ✓");
      setTimeout(() => setProgress(0, ""), 1800);
    } catch (err) {
      console.warn("Background load error:", err);
    }
  })();
}

/* ── Boot ────────────────────────────────────────────────────────────── */
async function initDashboard() {
  showLoading("Connecting to API…");
  setProgress(3, "Starting…");

  // Sliders — trigger filter on release
  initRangeSlider({
    lowId: "fare-low", highId: "fare-high", fillId: "fare-fill",
    thumbLowId: "fare-thumb-low", thumbHighId: "fare-thumb-high", valueId: "fare-value",
    min: 0, max: 250, unit: "$", suffix: "",
    onChange: (lo, hi) => { filters.minFare = lo; filters.maxFare = hi; },
  });
  initRangeSlider({
    lowId: "dist-low", highId: "dist-high", fillId: "dist-fill",
    thumbLowId: "dist-thumb-low", thumbHighId: "dist-thumb-high", valueId: "dist-value",
    min: 0, max: 50, unit: "", suffix: " mi",
    onChange: (lo, hi) => { filters.minDistance = lo; filters.maxDistance = hi; },
  });

  // Sliders trigger filter on mouseup/touchend (not on every drag tick)
  ["fare-low","fare-high","dist-low","dist-high"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("change", () => triggerFilter());
  });

  initDatePicker();

  // Apply button — explicit apply for fare/distance sliders
  document.getElementById("apply-btn").addEventListener("click", () => {
    triggerFilter(true);
  });

  document.getElementById("refresh-btn").addEventListener("click", async () => {
    showLoading("Refreshing data…");
    setProgress(5, "Refreshing…");
    try {
      // Reset filters to show full dataset
      filters.date = null;
      filters.hour = null;
      document.getElementById("date-picker").value = "";
      document.getElementById("clear-date-btn").classList.add("hidden");
      syncHourFilter(null);
      await fetchAndRender();
    } catch (err) {
      showError("Failed to refresh. Is the API running on port 5002?");
    }
  });

  try {
    await fetchAndRender();
  } catch (err) {
    console.error(err);
    showError("Could not connect to the API server on port 5002.");
  }
}

window.initDashboard = initDashboard;
initDashboard();

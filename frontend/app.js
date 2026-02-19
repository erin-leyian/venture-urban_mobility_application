/* ============================================================
   NYC Urban Mobility Analytics — app.js
   Pure vanilla JS. Requires Leaflet 1.9, Chart.js 4.4 (CDN).
   Dataset: NYC TLC Yellow Taxi — January 2019
   ============================================================ */

const API = "http://localhost:5002/api";

/* ── State ──────────────────────────────────────────────────────────── */
let filters = {
  boroughs: [],      // populated from API on boot
  minFare: 0,
  maxFare: 250,
  minDistance: 0,
  maxDistance: 50,
  date: null,        // "2019-01-XX" or null = all
  hour: null,        // 0-23 or null = all
};

let leafletMap = null;
let geoLayer = null;
let zoneStats = {};
let allZones = [];       // [{location_id, zone, borough}] from GeoJSON
let chartInstances = {};
let allTrendsData = [];  // cache of daily trend data

/* ── Helpers ─────────────────────────────────────────────────────────── */
const fmt = (n) => Number(n).toLocaleString();
const fmtM = (n) => "$" + (n / 1_000_000).toFixed(2) + "M";
const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n));

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

/* ── Overlay / progress ──────────────────────────────────────────────── */
function showLoading(msg = "Loading…") {
  const ov = document.getElementById("overlay");
  ov.classList.remove("hidden");
  document.getElementById("spinner").style.display = "block";
  document.getElementById("overlay-msg").textContent = msg;
  document.getElementById("retry-btn").classList.add("hidden");
  setProgress(0, "");
}

function setProgress(pct, msg) {
  const bar = document.getElementById("progress-bar");
  const label = document.getElementById("progress-label");
  if (bar) bar.style.width = pct + "%";
  if (label) label.textContent = msg || pct + "%";
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
}

/* ── KPI Cards (no sparkline charts) ────────────────────────────────── */
function renderKPI(cards) {
  const grid = document.getElementById("kpi-grid");
  grid.innerHTML = "";

  cards.forEach(({ title, value, change, trend, sub }) => {
    const trendClass = trend === "up" ? "up" : trend === "down" ? "down" : "neutral";
    const trendIcon =
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
        <span class="kpi-change ${trendClass}">${trendIcon} ${change || "—"}</span>
        ${sub ? `<span class="kpi-sub">${sub}</span>` : ""}
      </div>`;
    grid.appendChild(card);
  });
}

/* ── Trends chart (daily, Jan 1–31 2019) ─────────────────────────────── */
function renderTrends(rawData) {
  // rawData: [{date:"2019-01-01", trips:186154}, …]
  // Show every day as its own point; label as "Jan 1", "Jan 2", etc.
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
        pointRadius: 3,
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
          ticks: {
            color: "#666",
            font: { size: 9 },
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 16,
          },
        },
        y: {
          grid: { color: "#222" },
          ticks: { color: "#666", font: { size: 10 }, callback: (v) => fmtK(v) },
        },
      },
    },
  });
}

/* ── Borough chart ───────────────────────────────────────────────────── */
function renderBorough(data) {
  const filtered = data
    .filter((b) => b.borough && !["", "Unknown", "N/A", "EWR"].includes(b.borough))
    .sort((a, b) => b.trip_count - a.trip_count);

  const ctx = document.getElementById("borough-chart").getContext("2d");
  destroyChart("borough-chart");

  const colors = ["#FFD700", "#FFC300", "#FFB300", "#FFA000", "#FF8F00", "#FF6F00"];

  chartInstances["borough-chart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: filtered.map((b) => b.borough),
      datasets: [{
        label: "Trips",
        data: filtered.map((b) => b.trip_count),
        backgroundColor: filtered.map((_, i) => colors[i] || "#555"),
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
            afterLabel: (ctx) => {
              const r = filtered[ctx.dataIndex];
              return `  Revenue: ${fmtM(r.total_revenue)}`;
            },
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
  const order = { "$0-10": 1, "$10-20": 2, "$20-30": 3, "$30-40": 4, "$40-50": 5, "$50+": 6 };
  const sorted = [...data].sort((a, b) => (order[a.range] || 9) - (order[b.range] || 9));

  const ctx = document.getElementById("fare-chart").getContext("2d");
  destroyChart("fare-chart");

  chartInstances["fare-chart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map((d) => d.range),
      datasets: [{
        label: "Trips",
        data: sorted.map((d) => d.count),
        backgroundColor: "#FFD700",
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

/* ── Avg Distance stat card ──────────────────────────────────────────── */
function renderAvgStats(stats) {
  document.getElementById("avg-distance").innerHTML =
    `${(stats.avg_distance || 0).toFixed(1)}<span> miles</span>`;
  document.getElementById("avg-speed").textContent =
    `${(stats.avg_speed_mph || 0).toFixed(1)} mph`;
  document.getElementById("avg-duration").textContent =
    `${Math.round(stats.avg_duration_minutes || 0)} min`;
}

/* ── Peak Hours ──────────────────────────────────────────────────────── */
function renderPeakHours(rows) {
  const list = document.getElementById("peak-list");
  list.innerHTML = "";
  const top5 = rows.slice(0, 5);
  const maxCnt = Math.max(...top5.map((r) => r.trip_count), 1);

  top5.forEach((r) => {
    const pct = Math.round((r.trip_count / maxCnt) * 100);
    const cnt = r.trip_count > 999
      ? `${(r.trip_count / 1000).toFixed(1)}K`
      : `${r.trip_count}`;
    const row = document.createElement("div");
    row.className = "peak-row";
    row.innerHTML = `
      <span class="peak-label">${r.label}</span>
      <div class="peak-bar-wrap">
        <div class="peak-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="peak-count">${cnt}</span>`;
    list.appendChild(row);
  });
}

/* ── Leaflet Map ─────────────────────────────────────────────────────── */
const ZONE_GEOJSON_URL = "http://localhost:5002/api/zones/geojson";

const LEGEND_STEPS = [
  { min: 100000, color: "#67000d", label: "> 100,000" },
  { min: 50000,  color: "#a50f15", label: "50,000 – 100,000" },
  { min: 20000,  color: "#cb181d", label: "20,000 – 50,000" },
  { min: 10000,  color: "#ef3b2c", label: "10,000 – 20,000" },
  { min: 5000,   color: "#fb6a4a", label: "5,000 – 10,000" },
  { min: 1000,   color: "#fc9272", label: "1,000 – 5,000" },
  { min: 100,    color: "#fcbba1", label: "100 – 1,000" },
  { min: 0,      color: "#fff5f0", label: "< 100" },
];

function getZoneColor(count) {
  for (const { min, color } of LEGEND_STEPS) {
    if (count >= min) return color;
  }
  return "#fff5f0";
}

function buildLegend() {
  const leg = document.getElementById("map-legend");
  // Clear everything except the title div
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

let geoJsonCache = null; // cache GeoJSON so we don't re-fetch on filter

async function initMap(zoneCounts) {
  // Create map once
  if (!leafletMap) {
    leafletMap = L.map("map", {
      center: [40.73, -73.935],
      zoom: 11,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19 }
    ).addTo(leafletMap);
    buildLegend();
  }

  // Remove old layer
  if (geoLayer) {
    leafletMap.removeLayer(geoLayer);
    geoLayer = null;
  }

  // Fetch GeoJSON (only once — cached)
  if (!geoJsonCache) {
    try {
      const res = await fetch(ZONE_GEOJSON_URL);
      if (!res.ok) throw new Error(`GeoJSON HTTP ${res.status}`);
      geoJsonCache = await res.json();
      // Also populate allZones search index
      allZones = geoJsonCache.features.map((f) => ({
        location_id: f.properties.location_id,
        zone: f.properties.zone || "",
        borough: f.properties.borough || "",
      }));
    } catch (e) {
      console.warn("GeoJSON fetch failed:", e.message);
      return;
    }
  }

  geoLayer = L.geoJSON(geoJsonCache, {
    style: (feature) => {
      const id = String(feature.properties.location_id || "");
      const cnt = zoneCounts[id] || 0;
      return {
        fillColor: getZoneColor(cnt),
        weight: 0.7,
        opacity: 1,
        color: "rgba(255,255,255,0.2)",
        fillOpacity: cnt > 0 ? 0.8 : 0.3,
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const id = String(p.location_id || "");
      const cnt = zoneCounts[id] || 0;
      const zone = p.zone || "Unknown Zone";
      const boro = p.borough || "";

      layer.bindTooltip(
        `<strong>${zone}</strong><br/>${boro}<br/>Pickups: <b>${fmt(cnt)}</b>`,
        { sticky: true, direction: "top", className: "map-tooltip" }
      );

      layer.on({
        mouseover(e) {
          e.target.setStyle({ weight: 2, color: "#FFD700", fillOpacity: 0.95 });
          e.target.bringToFront();
        },
        mouseout(e) {
          geoLayer.resetStyle(e.target);
        },
        click() {
          // Push zone name into search box
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

  // Fit bounds on first load only
  if (geoLayer.getBounds().isValid() && !leafletMap._hasFitBounds) {
    leafletMap.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });
    leafletMap._hasFitBounds = true;
  }
}

/* ── Highlight a zone by location_id ─────────────────────────────────── */
function highlightZone(locationId) {
  if (!geoLayer) return;
  geoLayer.eachLayer((layer) => {
    const id = layer.feature && layer.feature.properties.location_id;
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

/* ── Sidebar — time-of-day histogram ──────────────────────────────────── */
let hourData = [];  // [{hour:"00", trip_count:N}, …]

async function buildHistogram() {
  const wrap = document.getElementById("histogram");
  wrap.innerHTML = "";

  try {
    hourData = await get("/statistics/pickup-time-distribution");
  } catch {
    hourData = Array.from({ length: 24 }, (_, i) => ({
      hour: String(i).padStart(2, "0"),
      trip_count: 100,
    }));
  }

  const byHour = {};
  hourData.forEach(({ hour, trip_count }) => {
    byHour[String(hour).padStart(2, "0")] = trip_count;
  });
  const maxCnt = Math.max(...Object.values(byHour), 1);

  for (let i = 0; i < 24; i++) {
    const h = String(i).padStart(2, "0");
    const cnt = byHour[h] || 0;
    const heightPct = Math.max(4, Math.round((cnt / maxCnt) * 100));
    const isPeak = (i >= 7 && i <= 9) || (i >= 16 && i <= 18);
    const label = i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`;

    const bar = document.createElement("div");
    bar.className = "histogram-bar" + (isPeak ? " peak" : "");
    bar.style.height = `${heightPct}%`;
    bar.title = `${label}: ${fmt(cnt)} trips`;
    bar.dataset.hour = i;

    bar.addEventListener("click", () => setHourFilter(i, bar));
    wrap.appendChild(bar);
  }
}

function setHourFilter(hour, clickedBar) {
  const clearBtn = document.getElementById("clear-hour-btn");
  const badge = document.getElementById("hour-active-badge");

  if (filters.hour === hour) {
    // Toggle off
    filters.hour = null;
    document.querySelectorAll(".histogram-bar").forEach((b) => b.classList.remove("selected"));
    clearBtn.classList.add("hidden");
    badge.classList.add("hidden");
    badge.textContent = "";
  } else {
    filters.hour = hour;
    document.querySelectorAll(".histogram-bar").forEach((b) => {
      b.classList.toggle("selected", parseInt(b.dataset.hour) === hour);
    });
    const label = hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`;
    clearBtn.classList.remove("hidden");
    badge.classList.remove("hidden");
    badge.textContent = label;
  }

  applyFilters();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("clear-hour-btn").addEventListener("click", () => {
    filters.hour = null;
    document.querySelectorAll(".histogram-bar").forEach((b) => b.classList.remove("selected"));
    document.getElementById("clear-hour-btn").classList.add("hidden");
    document.getElementById("hour-active-badge").classList.add("hidden");
    applyFilters();
  });
});

/* ── Date picker ─────────────────────────────────────────────────────── */
function initDatePicker() {
  const picker = document.getElementById("date-picker");
  const clearBtn = document.getElementById("clear-date-btn");

  picker.addEventListener("change", () => {
    const val = picker.value;
    if (val && val >= "2019-01-01" && val <= "2019-01-31") {
      filters.date = val;
      clearBtn.classList.remove("hidden");
      applyFilters();
    }
  });

  clearBtn.addEventListener("click", () => {
    filters.date = null;
    picker.value = "";
    clearBtn.classList.add("hidden");
    applyFilters();
  });
}

/* ── Borough checkboxes (populated from API response) ────────────────── */
const BOROUGH_COLORS = {
  Manhattan: "#FFD700",
  Brooklyn: "#FFC300",
  Queens: "#FFB300",
  Bronx: "#FFA000",
  "Staten Island": "#FF8F00",
};

function buildBoroughs(boroughData) {
  // boroughData: [{borough, trip_count, …}] from /api/statistics/by-borough
  const valid = boroughData.filter(
    (b) => b.borough && !["", "Unknown", "N/A", "EWR"].includes(b.borough)
  );
  filters.boroughs = valid.map((b) => b.borough);

  const list = document.getElementById("borough-list");
  list.innerHTML = "";

  valid.forEach(({ borough, trip_count }) => {
    const color = BOROUGH_COLORS[borough] || "#888";
    const item = document.createElement("div");
    item.className = "borough-item checked";
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
  if (checked && filters.boroughs.length === 1) return; // keep at least one
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
}

/* ── Range sliders ───────────────────────────────────────────────────── */
function initRangeSlider({ lowId, highId, fillId, thumbLowId, thumbHighId, valueId, min, max, unit, suffix, onChange }) {
  const lowEl = document.getElementById(lowId);
  const highEl = document.getElementById(highId);
  const fillEl = document.getElementById(fillId);
  const thumbLow = document.getElementById(thumbLowId);
  const thumbHigh = document.getElementById(thumbHighId);
  const valueLabel = document.getElementById(valueId);

  function update() {
    const lo = Number(lowEl.value);
    const hi = Number(highEl.value);
    const pctLo = ((lo - min) / (max - min)) * 100;
    const pctHi = ((hi - min) / (max - min)) * 100;

    fillEl.style.left = pctLo + "%";
    fillEl.style.right = 100 - pctHi + "%";
    fillEl.style.width = "auto";

    thumbLow.style.left = `calc(${pctLo}% - 8px)`;
    thumbHigh.style.left = `calc(${pctHi}% - 8px)`;

    const hiLabel = hi >= max ? `${unit}${hi}${suffix}+` : `${unit}${hi}${suffix}`;
    valueLabel.textContent = `${unit}${lo}${suffix} – ${hiLabel}`;

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

/* ── Search with suggestions ─────────────────────────────────────────── */
function initSearch() {
  const input = document.getElementById("search-input");
  const dropdown = document.getElementById("search-dropdown");
  const clearBtn = document.getElementById("search-clear-btn");

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    clearBtn.classList.toggle("hidden", q.length === 0);
    if (q.length < 1) {
      dropdown.classList.add("hidden");
      // Reset map styles on clear
      if (geoLayer) geoLayer.eachLayer((l) => geoLayer.resetStyle(l));
      return;
    }

    // Search allZones (populated after GeoJSON loads)
    const matches = allZones
      .filter((z) =>
        z.zone.toLowerCase().includes(q) || z.borough.toLowerCase().includes(q)
      )
      .slice(0, 10);

    if (matches.length === 0) {
      dropdown.classList.add("hidden");
      return;
    }

    dropdown.innerHTML = "";
    matches.forEach((z) => {
      const li = document.createElement("li");
      li.className = "search-suggestion";
      // Highlight matching text
      const highlight = (str) => {
        const idx = str.toLowerCase().indexOf(q);
        if (idx === -1) return str;
        return str.slice(0, idx) + `<mark>${str.slice(idx, idx + q.length)}</mark>` + str.slice(idx + q.length);
      };
      li.innerHTML = `
        <span class="sug-zone">${highlight(z.zone)}</span>
        <span class="sug-boro">${z.borough}</span>`;
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
    if (e.key === "Escape") {
      dropdown.classList.add("hidden");
      input.blur();
    }
    if (e.key === "Enter") {
      const first = dropdown.querySelector("li");
      if (first) first.dispatchEvent(new MouseEvent("mousedown"));
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => dropdown.classList.add("hidden"), 150);
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    dropdown.classList.add("hidden");
    clearBtn.classList.add("hidden");
    if (geoLayer) geoLayer.eachLayer((l) => geoLayer.resetStyle(l));
    // Re-fit map
    if (geoLayer && geoLayer.getBounds().isValid()) {
      leafletMap.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });
    }
  });
}

/* ── Build query string for filtered endpoints ───────────────────────── */
function buildQuery(f = filters) {
  const p = new URLSearchParams();
  if (f.date) p.append("date", f.date);
  if (f.hour !== null) p.append("hour", f.hour);
  if (f.minFare > 0) p.append("min_fare", f.minFare);
  if (f.maxFare < 250) p.append("max_fare", f.maxFare);
  if (f.minDistance > 0) p.append("min_distance", f.minDistance);
  if (f.maxDistance < 50) p.append("max_distance", f.maxDistance);
  // Borough filter — only send if not all selected
  const allB = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
  if (f.boroughs.length > 0 && f.boroughs.length < allB.length)
    f.boroughs.forEach((b) => p.append("borough", b));
  const s = p.toString();
  return s ? "?" + s : "";
}

/* ── Apply filters (re-render with current filter state) ─────────────── */
async function applyFilters() {
  const qs = buildQuery();
  try {
    const [stats, peaks, zones] = await Promise.all([
      get("/statistics" + qs),
      get("/statistics/peak-hours"),
      get("/statistics/by-zone"),
    ]);

    // Update badge with context
    const dateLabel = filters.date
      ? new Date(filters.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "January 2019";
    const hourLabel = filters.hour !== null
      ? ` · ${filters.hour < 12 ? (filters.hour || 12) + (filters.hour === 0 ? " AM" : " AM") : (filters.hour === 12 ? "12 PM" : (filters.hour - 12) + " PM")}`
      : "";
    document.getElementById("trip-count-badge").textContent =
      `${fmt(stats.total_trips)} trips · ${dateLabel}${hourLabel}`;

    // KPI cards with change context
    const prevAvgFare = 15.51; // Jan 2019 baseline
    const fareChg = (((stats.avg_fare - prevAvgFare) / prevAvgFare) * 100).toFixed(1);
    renderKPI([
      { title: "Total Trips", value: fmt(stats.total_trips), change: dateLabel, trend: "neutral", sub: "pickup count" },
      { title: "Total Revenue", value: fmtM(stats.total_revenue), change: `$${(stats.total_revenue / stats.total_trips).toFixed(2)}/trip`, trend: "up" },
      { title: "Avg. Fare", value: `$${Number(stats.avg_fare).toFixed(2)}`, change: `${fareChg > 0 ? "+" : ""}${fareChg}% vs avg`, trend: fareChg > 0 ? "up" : fareChg < 0 ? "down" : "neutral" },
      { title: "Avg. Distance", value: `${Number(stats.avg_distance).toFixed(1)} mi`, change: `${(stats.avg_duration_minutes || 0).toFixed(0)} min avg`, trend: "neutral", sub: `${(stats.avg_speed_mph || 0).toFixed(1)} mph avg` },
    ]);

    renderAvgStats(stats);
    renderPeakHours(peaks);

    // Update map
    const counts = {};
    Object.entries(zones).forEach(([k, v]) => { counts[String(k)] = v; });
    zoneStats = counts;
    await initMap(counts);

    // Update trends for selected date if applicable
    if (filters.date && allTrendsData.length) {
      const dayData = allTrendsData.filter((r) => r.date === filters.date);
      if (dayData.length) renderTrends(dayData.length > 1 ? dayData : allTrendsData);
    }
  } catch (err) {
    console.warn("Filter apply error:", err);
  }
}

/* ── Main fetch and render ───────────────────────────────────────────── */
async function fetchAndRender() {
  setProgress(10, "Fetching statistics…");

  // Phase 1: fast data for immediate render
  const [stats, peaks, zones, boroughs] = await Promise.all([
    get("/statistics"),
    get("/statistics/peak-hours"),
    get("/statistics/by-zone"),
    get("/statistics/by-borough"),
  ]);

  setProgress(45, "Rendering dashboard…");

  // Badge
  document.getElementById("trip-count-badge").textContent =
    `${fmt(stats.total_trips)} trips · January 2019`;

  // Build borough filter from real API data
  buildBoroughs(boroughs);

  // KPI cards (no sparklines)
  renderKPI([
    { title: "Total Trips", value: fmt(stats.total_trips), change: "January 2019", trend: "neutral", sub: "7.5M total records" },
    { title: "Total Revenue", value: fmtM(stats.total_revenue), change: `$${(stats.total_revenue / stats.total_trips).toFixed(2)}/trip avg`, trend: "up" },
    { title: "Avg. Fare", value: `$${Number(stats.avg_fare).toFixed(2)}`, change: `$${Number(stats.avg_tip).toFixed(2)} avg tip`, trend: "neutral" },
    { title: "Avg. Distance", value: `${Number(stats.avg_distance).toFixed(1)} mi`, change: `${(stats.avg_speed_mph || 0).toFixed(1)} mph · ${Math.round(stats.avg_duration_minutes || 0)} min`, trend: "neutral" },
  ]);

  renderAvgStats(stats);
  renderPeakHours(peaks);

  // Build zone count map and load map
  const counts = {};
  Object.entries(zones).forEach(([k, v]) => { counts[String(k)] = v; });
  zoneStats = counts;

  setProgress(65, "Loading map…");
  await initMap(counts);

  // Dashboard is usable — hide overlay
  hideOverlay();

  // Phase 2: background chart loading
  (async () => {
    try {
      setProgress(75, "Loading charts…");

      const [trends, fares] = await Promise.all([
        get("/statistics/trends"),
        get("/statistics/fare-distribution"),
      ]);

      allTrendsData = trends;
      setProgress(88, "Rendering charts…");

      renderTrends(trends);
      renderBorough(boroughs);
      renderFare(fares);

      setProgress(95, "Loading histogram…");
      await buildHistogram();

      // Wire search (needs allZones which is now populated)
      initSearch();

      setProgress(100, "All data loaded ✓");
      setTimeout(() => setProgress(0, ""), 2000);
    } catch (err) {
      console.warn("Background load error:", err);
    }
  })();
}

/* ── Boot ────────────────────────────────────────────────────────────── */
async function initDashboard() {
  showLoading("Connecting to API…");

  // Static sidebar setup
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

  initDatePicker();

  document.getElementById("apply-btn").addEventListener("click", async () => {
    showLoading("Applying filters…");
    try {
      await applyFilters();
      hideOverlay();
    } catch (err) {
      showError("Failed to apply filters. Is the API running on port 5002?");
    }
  });

  document.getElementById("refresh-btn").addEventListener("click", async () => {
    showLoading("Refreshing…");
    try {
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

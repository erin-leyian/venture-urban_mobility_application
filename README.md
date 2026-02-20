# 🚕 NYC Urban Mobility Analytics

> **Full-stack data analytics dashboard** for exploring 6.5 million NYC Yellow Taxi trips from January 2019.  
> Built with a custom Python pipeline, SQLite, Flask API, and a vanilla JS dashboard.

📄 [Technical Documentation](https://docs.google.com/document/d/1SQwXaS7YuSznij4jZOHoLIxSB9jrr3ru4EGE_za8RT0/edit?tab=t.0) &nbsp;|&nbsp; 📊 [Team Sheet](https://docs.google.com/spreadsheets/d/1QJqkAyxRMrB263eiSfwBkgEmQOp3IDE967a9dt-lmQw/edit?gid=0#gid=0) &nbsp;|&nbsp; 📺 [Demo Video](https://youtu.be/1KrZdGuGXqE)

---

## 📺 Demo

**▶ [Watch the Demo on YouTube](https://youtu.be/1KrZdGuGXqE)**

[![Demo Video](https://img.youtube.com/vi/1KrZdGuGXqE/maxresdefault.jpg)](https://youtu.be/1KrZdGuGXqE)

---

## 🏗️ Architecture

```
Raw CSV (NYC TLC)
      ↓
pipeline/data_processing.py   — cleans data, derives features
      ↓
database/insert_data.py       — loads cleaned CSVs into SQLite
      ↓
api/data/taxi_mock.db         — queried by Flask API
      ↓
http://localhost:5002/api/*   — JSON responses
      ↓
frontend/ (Leaflet + Chart.js) — interactive dashboard at :8080
```

---

## 📁 Project Structure

```
venture-urban_mobility_application/
├── api/
│   ├── app.py                  — Flask app entry point (port 5002)
│   ├── requirements.txt
│   ├── data/
│   │   ├── taxi_mock.db        — SQLite database (7.6M rows)
│   │   └── taxi_zones.geojson  — NYC zone boundaries for the map
│   ├── routes/
│   │   ├── statistics.py       — /api/statistics/* endpoints
│   │   └── trips.py            — /api/trips endpoint
│   └── utils/
│       ├── db_connect.py       — SQLite connection helper
│       └── custom_sort.py      — custom merge sort (no built-in sort)
├── database/
│   ├── schema.sql              — DB schema definition
│   └── insert_data.py          — loads cleaned CSVs → SQLite
├── pipeline/
│   ├── data_processing.py      — clean, engineer features, output CSVs
│   ├── cleaning_log.md         — auto-generated cleaning report
│   └── requirements.txt
├── frontend/
│   ├── index.html              — single-page dashboard shell
│   ├── app.js                  — all JS: charts, map, filters, API calls
│   └── styles.css              — full dark-theme stylesheet
├── serve.py                    — static file server for frontend (port 8080)
└── README.md
```

---

## 🚀 How to Run

> You need **two terminals open at the same time** — one for the API, one for the frontend.

---

### Step 1 — Data Pipeline _(one-time setup)_

The pipeline reads the raw TLC CSV, cleans it, derives features, and writes CSVs to `database/cleaned/`.

```bash
cd pipeline
pip install -r requirements.txt
python3 data_processing.py
```

To process only a subset (e.g. for testing):

```bash
python3 data_processing.py 100000
```

Output: cleaned CSVs in `database/cleaned/` + a full report at `pipeline/cleaning_log.md`.

---

### Step 2 — Load the Database _(one-time setup)_

```bash
cd database
python3 insert_data.py
```

This loads `database/cleaned/trips_cleaned.csv` and zone data into `api/data/taxi_mock.db`.

---

### Step 3 — Start the API (Terminal 1)

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 app.py
```

API is live at: **http://localhost:5002**  
Health check: http://localhost:5002/api/health

---

### Step 4 — Start the Frontend (Terminal 2)

From the project root:

```bash
python3 serve.py
```

Dashboard is live at: **http://localhost:8080**

---

### Quick-start _(after initial setup)_

```bash
# Terminal 1 — API
cd api && source .venv/bin/activate && python3 app.py

# Terminal 2 — Frontend
python3 serve.py
```

---

## 🔌 API Endpoints

All endpoints accept these optional query parameters:

| Parameter                       | Type                | Example                               |
| ------------------------------- | ------------------- | ------------------------------------- |
| `date`                          | `YYYY-MM-DD`        | `?date=2019-01-15`                    |
| `hour`                          | `0–23`              | `?hour=8`                             |
| `min_fare` / `max_fare`         | number              | `?min_fare=5&max_fare=30`             |
| `min_distance` / `max_distance` | number              | `?min_distance=1&max_distance=10`     |
| `borough`                       | string (repeatable) | `?borough=Manhattan&borough=Brooklyn` |

| Endpoint                                       | Description                                                    |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `GET /api/statistics`                          | Overall KPIs — total trips, revenue, avg fare, distance, speed |
| `GET /api/statistics/by-zone`                  | Trip counts per taxi zone (powers the choropleth map)          |
| `GET /api/statistics/by-borough`               | Stats grouped by borough                                       |
| `GET /api/statistics/peak-hours`               | Top 10 busiest hours of the day                                |
| `GET /api/statistics/fare-distribution`        | Trip counts bucketed by fare range                             |
| `GET /api/statistics/trends`                   | Daily trip counts Jan 1–31                                     |
| `GET /api/statistics/pickup-time-distribution` | Trips by each hour of the day (0–23)                           |
| `GET /api/statistics/peak-vs-offpeak`          | Rush hour vs. off-peak comparison                              |
| `GET /api/zones/geojson`                       | GeoJSON zone boundaries for the Leaflet map                    |
| `GET /api/trips`                               | Raw trip records (filterable, limited)                         |
| `GET /api/top-routes`                          | Most popular pickup → dropoff zone pairs                       |
| `GET /api/health`                              | Health check — confirms API is running                         |

Full endpoint documentation: [`api/API_DOCS.md`](api/API_DOCS.md)

---

## 🧠 Custom Algorithms

No built-in sorting functions are used anywhere in this project:

- **`pipeline/data_processing.py`** — custom merge sort used inside the IQR outlier detection step
- **`api/utils/custom_sort.py`** — custom merge sort for ranking top routes by trip count

---

## 📊 Dashboard Features

| Feature                  | Description                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| 🗺️ Choropleth Map        | Leaflet heatmap of pickup density across all 263 NYC taxi zones     |
| 📈 Trip Trends           | Daily line chart Jan 1–31, 2019                                     |
| 🏙️ Borough Comparison    | Horizontal bar chart — trips and revenue per borough                |
| 💰 Fare Distribution     | Bar chart grouped by fare bucket ($0–10, $10–20, etc.)              |
| ⏰ Time-of-Day Histogram | 24-hour pickup histogram — click any bar to filter by that hour     |
| 📊 KPI Cards             | Total trips, total revenue, avg fare, avg distance                  |
| 🔍 Zone Search           | Autocomplete search that highlights any of the 263 zones on the map |

**Sidebar filters (all applied on button click):**

- Date picker (Jan 1–31, 2019)
- Hour of day (click histogram bar)
- Borough checkboxes (Manhattan, Brooklyn, Queens, Bronx, Staten Island)
- Fare range slider ($0–$250)
- Distance range slider (0–50 mi)
- **Apply Filters** — runs all queries with current selections
- **Clear All** — resets every filter and reloads the full dataset

---

## 👥 Team

| Name                          | Role                                                           |
| ----------------------------- | -------------------------------------------------------------- |
| **Belyse Intwaza**            | Data engineering, pipeline, custom algorithms, database schema |
| **Erin Wanjiru Leyian**       | Backend Flask API, business logic, all endpoints               |
| **Kenny Gael Ishimwe Gatete** | Frontend dashboard, visualisations, interactive map            |

---

## 📎 Links

- 📺 [Demo Video](https://youtu.be/1KrZdGuGXqE)
- 📄 [Technical Documentation](https://docs.google.com/document/d/1SQwXaS7YuSznij4jZOHoLIxSB9jrr3ru4EGE_za8RT0/edit?tab=t.0)
- 📊 [Team Sheet](https://docs.google.com/spreadsheets/d/1QJqkAyxRMrB263eiSfwBkgEmQOp3IDE967a9dt-lmQw/edit?gid=0#gid=0)

---

_For course use only — ALU Software Engineering, 2024–2025._

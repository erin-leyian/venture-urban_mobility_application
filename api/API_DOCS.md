# 📡 API Documentation

**Base URL:** `http://localhost:5002/api`  
**Dataset:** NYC TLC Yellow Taxi — January 2019 · 6,552,645 trips after cleaning  
**Format:** All responses return `application/json`. CORS is enabled for all origins.

---

## 🔧 Common Query Parameters

All statistics endpoints accept the following optional filters. Omitting a parameter returns unfiltered data.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `date` | `YYYY-MM-DD` | — | Filter trips by pickup date (Jan 1–31, 2019) |
| `hour` | `0–23` | — | Filter by pickup hour of day |
| `min_fare` | `float` | — | Minimum total fare amount ($) |
| `max_fare` | `float` | — | Maximum total fare amount ($) |
| `min_distance` | `float` | — | Minimum trip distance (miles) |
| `max_distance` | `float` | — | Maximum trip distance (miles) |
| `borough` | `string` | — | Filter by pickup borough. Repeatable: `?borough=Manhattan&borough=Brooklyn` |

---

## 📋 Endpoints

---

### `GET /api/statistics`

Overall KPIs across all trips matching the active filters.

**Example request:**
```
GET /api/statistics
GET /api/statistics?date=2019-01-15&borough=Manhattan
```

**Response:**
```json
{
  "total_trips": 6552645,
  "total_revenue": 73258642.14,
  "avg_fare": 11.18,
  "avg_tip": 1.31,
  "avg_distance": 1.63,
  "avg_duration_minutes": 13.37,
  "avg_speed_mph": 10.25,
  "avg_fare_per_mile": 6.59,
  "avg_passengers": 1.57
}
```

---

### `GET /api/statistics/by-borough`

Trip statistics grouped by pickup borough. Excludes unknown/empty boroughs.

**Example request:**
```
GET /api/statistics/by-borough
GET /api/statistics/by-borough?date=2019-01-10
```

**Response:**
```json
[
  {
    "borough": "Manhattan",
    "trip_count": 6278659,
    "avg_distance": 1.62,
    "avg_fare": 11.16,
    "avg_duration": 13.4,
    "avg_speed": 10.16,
    "total_revenue": 70065094.35
  },
  {
    "borough": "Queens",
    "trip_count": 198441,
    "avg_distance": 3.12,
    "avg_fare": 14.22,
    "avg_duration": 17.8,
    "avg_speed": 12.43,
    "total_revenue": 2821763.10
  }
]
```

> Ordered by `trip_count` descending.

---

### `GET /api/statistics/by-zone`

Trip count per taxi zone (LocationID). Powers the choropleth map.

**Example request:**
```
GET /api/statistics/by-zone
GET /api/statistics/by-zone?date=2019-01-15&borough=Brooklyn
```

**Response:**
```json
{
  "161": 542341,
  "237": 498120,
  "236": 401887,
  "48":  312004
}
```

> Keys are `LocationID` strings. Values are pickup trip counts.

---

### `GET /api/statistics/peak-hours`

Top 10 busiest pickup hours across the dataset.

**Example request:**
```
GET /api/statistics/peak-hours
GET /api/statistics/peak-hours?borough=Manhattan
```

**Response:**
```json
[
  { "hour": 18, "label": "6:00 PM", "trip_count": 412803 },
  { "hour": 17, "label": "5:00 PM", "trip_count": 398241 },
  { "hour": 19, "label": "7:00 PM", "trip_count": 381092 }
]
```

> Ordered by `trip_count` descending. Returns up to 10 rows.

---

### `GET /api/statistics/pickup-time-distribution`

Trip counts for all 24 hours of the day. Used to render the time-of-day histogram in the dashboard.

**Example request:**
```
GET /api/statistics/pickup-time-distribution
GET /api/statistics/pickup-time-distribution?date=2019-01-20
```

**Response:**
```json
[
  { "hour": "00", "trip_count": 98241 },
  { "hour": "01", "trip_count": 72183 },
  { "hour": "06", "trip_count": 142031 },
  { "hour": "18", "trip_count": 412803 }
]
```

> Returns all 24 hours ordered `00`–`23`.

---

### `GET /api/statistics/trends`

Daily trip counts for January 1–31, 2019. Always returns the full month view; borough filter is supported.

**Example request:**
```
GET /api/statistics/trends
GET /api/statistics/trends?borough=Queens
```

**Response:**
```json
[
  { "date": "2019-01-01", "trips": 189203 },
  { "date": "2019-01-02", "trips": 241832 },
  { "date": "2019-01-31", "trips": 228741 }
]
```

---

### `GET /api/statistics/fare-distribution`

Trip counts bucketed by total fare range.

**Example request:**
```
GET /api/statistics/fare-distribution
GET /api/statistics/fare-distribution?borough=Manhattan&date=2019-01-15
```

**Response:**
```json
[
  { "range": "$0-10",  "count": 2841203 },
  { "range": "$10-20", "count": 2103841 },
  { "range": "$20-30", "count": 892341 },
  { "range": "$30-40", "count": 412831 },
  { "range": "$40-50", "count": 198241 },
  { "range": "$50+",   "count": 104188 }
]
```

> Ordered from lowest to highest fare bucket.

---

### `GET /api/statistics/peak-vs-offpeak`

Comparison of rush hour vs. off-peak trips.  
Peak hours are defined as **7–9 AM** and **4–6 PM**.

**Example request:**
```
GET /api/statistics/peak-vs-offpeak
```

**Response:**
```json
{
  "peak_hour": {
    "trip_count": 2527704,
    "avg_fare": 11.33,
    "avg_distance": 1.56,
    "avg_duration": 13.71
  },
  "off_peak": {
    "trip_count": 4024941,
    "avg_fare": 11.09,
    "avg_distance": 1.68,
    "avg_duration": 13.16
  }
}
```

---

### `GET /api/insights`

Four pre-computed key insights derived from the full dataset.

**Example request:**
```
GET /api/insights
```

**Response:**
```json
{
  "insights": [
    {
      "title": "Busiest Pickup Borough",
      "value": "Manhattan",
      "metric": "6,278,659 trips"
    },
    {
      "title": "Average Trip Speed",
      "value": "10.2 mph",
      "metric": "across all trips"
    },
    {
      "title": "Peak Hour Trips",
      "value": "38.6%",
      "metric": "of all trips during rush hour"
    },
    {
      "title": "Average Fare Per Mile",
      "value": "$6.59",
      "metric": "revenue per mile driven"
    }
  ]
}
```

---

### `GET /api/trips`

Raw trip records with optional filters. Paginated via `limit`.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `int` | `100` | Max number of results to return |
| `borough` | `string` | — | Filter by pickup borough |
| `min_fare` | `float` | — | Minimum fare amount |
| `max_fare` | `float` | — | Maximum fare amount |
| `min_distance` | `float` | — | Minimum trip distance |
| `max_distance` | `float` | — | Maximum trip distance |
| `is_peak_hour` | `0` or `1` | — | Filter by peak hour flag |

**Example request:**
```
GET /api/trips?borough=Manhattan&min_fare=10&limit=25
```

**Response:**
```json
[
  {
    "trip_id": 1,
    "tpep_pickup_datetime": "2019-01-01 00:46:40",
    "tpep_dropoff_datetime": "2019-01-01 00:53:20",
    "passenger_count": 1,
    "trip_distance": 1.5,
    "fare_amount": 7.0,
    "tip_amount": 1.65,
    "total_amount": 9.95,
    "pickup_borough": "Manhattan",
    "pickup_zone": "Midtown Center",
    "dropoff_borough": "Manhattan",
    "dropoff_zone": "Upper East Side North"
  }
]
```

---

### `GET /api/top-routes`

Most popular pickup → dropoff zone pairs, ranked by trip count.  
Uses a **custom merge sort** implementation (`api/utils/custom_sort.py`) — no built-in sort.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | `int` | `10` | Number of routes to return |

**Example request:**
```
GET /api/top-routes?limit=5
```

**Response:**
```json
[
  {
    "pickup_zone": "Midtown Center",
    "dropoff_zone": "Midtown Center",
    "pickup_borough": "Manhattan",
    "dropoff_borough": "Manhattan",
    "trip_count": 48203
  },
  {
    "pickup_zone": "Upper East Side North",
    "dropoff_zone": "Upper East Side South",
    "pickup_borough": "Manhattan",
    "dropoff_borough": "Manhattan",
    "trip_count": 31042
  }
]
```

---

### `GET /api/zones/geojson`

GeoJSON FeatureCollection of all 263 NYC taxi zone boundaries. Used by Leaflet to render the choropleth map.

**Example request:**
```
GET /api/zones/geojson
```

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "location_id": 161,
        "zone": "Midtown Center",
        "borough": "Manhattan"
      },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [ ... ]
      }
    }
  ]
}
```

---

### `GET /api/health`

Health check endpoint. Confirms the API is running.

**Example request:**
```
GET /api/health
```

**Response:**
```json
{ "status": "healthy" }
```

---

## ⚠️ Error Responses

| Status | Meaning |
|---|---|
| `200 OK` | Successful response |
| `404 Not Found` | Endpoint does not exist |
| `500 Internal Server Error` | Query or server-side failure |

---

## 🗄️ Database Notes

- **Engine:** SQLite (`api/data/taxi_mock.db`)
- **Rows:** 6,552,645 cleaned trips (from 7,667,792 raw — 1,115,147 excluded)
- **Exclusions:** duplicates (4), invalid bounds (60,793), distance outliers (872,116), fare outliers (182,234)
- **Peak hours:** 7–9 AM and 4–6 PM (flagged as `is_peak_hour = 1` on every row)
- **Derived fields stored per row:** `trip_duration_minutes`, `speed_mph`, `fare_per_mile`, `tip_percentage`, `is_peak_hour`

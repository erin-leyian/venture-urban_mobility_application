"""
build_db.py — Build taxi_mock.db from yellow_tripdata_2019-01.csv
Run from: api/data/
    python3 build_db.py

Loads all clean rows from the full Jan 2019 TLC dataset (~7.6 M rows).
Writes to: api/data/taxi_mock.db
Also loads taxi_zone_lookup.csv into the zones table.
"""

import csv
import sqlite3
import os
import time
from datetime import datetime

HERE      = os.path.dirname(os.path.abspath(__file__))
TRIPS_CSV = os.path.join(HERE, "yellow_tripdata_2019-01.csv")
ZONES_CSV = os.path.join(HERE, "taxi_zone_lookup.csv")
DB_PATH   = os.path.join(HERE, "taxi_mock.db")

BATCH = 50_000   # rows per INSERT batch

# ── helpers ──────────────────────────────────────────────────────────────
def duration_minutes(pickup, dropoff):
    try:
        fmt = "%Y-%m-%d %H:%M:%S"
        diff = datetime.strptime(dropoff, fmt) - datetime.strptime(pickup, fmt)
        return diff.total_seconds() / 60.0
    except Exception:
        return None

def speed_mph(dist, pickup, dropoff):
    dur = duration_minutes(pickup, dropoff)
    if dur and dur > 0 and float(dist) > 0:
        return float(dist) / (dur / 60.0)
    return None

def safe_float(v):
    try:
        f = float(v)
        return f if f == f else None   # NaN check
    except (ValueError, TypeError):
        return None

def safe_int(v):
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None

# ── connect & create schema ───────────────────────────────────────────────
print(f"Building DB at: {DB_PATH}")
if os.path.exists(DB_PATH):
    os.remove(DB_PATH)
    print("Removed old taxi_mock.db")

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA journal_mode = WAL")
conn.execute("PRAGMA synchronous  = NORMAL")

conn.executescript("""
    CREATE TABLE trips (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        VendorID              INTEGER,
        tpep_pickup_datetime  TEXT    NOT NULL,
        tpep_dropoff_datetime TEXT    NOT NULL,
        passenger_count       INTEGER,
        trip_distance         REAL    NOT NULL,
        RatecodeID            INTEGER,
        store_and_fwd_flag    TEXT,
        PULocationID          INTEGER NOT NULL,
        DOLocationID          INTEGER NOT NULL,
        payment_type          INTEGER,
        fare_amount           REAL    NOT NULL,
        extra                 REAL,
        mta_tax               REAL,
        tip_amount            REAL,
        tolls_amount          REAL,
        improvement_surcharge REAL,
        total_amount          REAL    NOT NULL,
        congestion_surcharge  REAL,
        trip_duration_minutes REAL,
        speed_mph             REAL
    );

    CREATE TABLE zones (
        LocationID   INTEGER PRIMARY KEY,
        Borough      TEXT,
        Zone         TEXT,
        service_zone TEXT
    );

    CREATE INDEX idx_trips_pickup  ON trips(tpep_pickup_datetime);
    CREATE INDEX idx_trips_puzone  ON trips(PULocationID);
    CREATE INDEX idx_trips_borough ON trips(PULocationID);
""")

# ── load zones ────────────────────────────────────────────────────────────
print("Loading zones…", end=" ", flush=True)
with open(ZONES_CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    zones = [(safe_int(r["LocationID"]), r["Borough"], r["Zone"], r.get("service_zone",""))
             for r in reader]
conn.executemany("INSERT OR IGNORE INTO zones VALUES (?,?,?,?)", zones)
conn.commit()
print(f"{len(zones)} zones loaded")

# ── load trips ────────────────────────────────────────────────────────────
print("Loading trips (this may take ~30–60 seconds)…")
t0       = time.time()
total    = 0
skipped  = 0
batch    = []

INSERT_SQL = """
    INSERT INTO trips (
        VendorID, tpep_pickup_datetime, tpep_dropoff_datetime, passenger_count,
        trip_distance, RatecodeID, store_and_fwd_flag, PULocationID, DOLocationID,
        payment_type, fare_amount, extra, mta_tax, tip_amount, tolls_amount,
        improvement_surcharge, total_amount, congestion_surcharge,
        trip_duration_minutes, speed_mph
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
"""

with open(TRIPS_CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        pu   = row.get("tpep_pickup_datetime", "")
        do   = row.get("tpep_dropoff_datetime", "")
        dist = safe_float(row.get("trip_distance", 0))
        fare = safe_float(row.get("fare_amount", 0))
        tot  = safe_float(row.get("total_amount", 0))
        pu_loc = safe_int(row.get("PULocationID"))
        do_loc = safe_int(row.get("DOLocationID"))

        # Quality filter: valid location, distance, fare, realistic duration
        if not pu or not do or not dist or dist <= 0 or dist > 200:
            skipped += 1; continue
        if fare is None or fare <= 0 or tot is None or tot <= 0:
            skipped += 1; continue
        if not pu_loc or not do_loc:
            skipped += 1; continue

        dur = duration_minutes(pu, do)
        if dur is None or dur <= 0 or dur > 300:
            skipped += 1; continue

        spd = speed_mph(dist, pu, do)
        if spd is not None and spd > 150:   # physically impossible
            skipped += 1; continue

        batch.append((
            safe_int(row.get("VendorID")),
            pu, do,
            safe_int(row.get("passenger_count")),
            dist,
            safe_int(row.get("RatecodeID")),
            row.get("store_and_fwd_flag"),
            pu_loc, do_loc,
            safe_int(row.get("payment_type")),
            fare,
            safe_float(row.get("extra")),
            safe_float(row.get("mta_tax")),
            safe_float(row.get("tip_amount")),
            safe_float(row.get("tolls_amount")),
            safe_float(row.get("improvement_surcharge")),
            tot,
            safe_float(row.get("congestion_surcharge")),
            round(dur, 2),
            round(spd, 2) if spd is not None else None,
        ))

        if len(batch) >= BATCH:
            conn.executemany(INSERT_SQL, batch)
            conn.commit()
            total += len(batch)
            batch = []
            elapsed = time.time() - t0
            print(f"  {total:,} rows inserted ({elapsed:.0f}s)…", flush=True)

# flush remainder
if batch:
    conn.executemany(INSERT_SQL, batch)
    conn.commit()
    total += len(batch)

conn.close()
elapsed = time.time() - t0
print(f"\nDone! {total:,} trips loaded, {skipped:,} skipped in {elapsed:.1f}s")
print(f"DB size: {os.path.getsize(DB_PATH) / 1e6:.1f} MB")

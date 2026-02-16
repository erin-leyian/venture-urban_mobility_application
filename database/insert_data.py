# Load cleaned CSVs into SQLite. Run: cd database && python insert_data.py
# Pipeline must be run first (trips_cleaned.csv, taxi_zones.csv in database/cleaned/)
# If data/taxi_zones.geojson exists we fill zone_geometry.

import csv
import json
import sqlite3
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DB_DIR.parent
DATA_DIR = PROJECT_ROOT / "data"
CLEANED_DIR = DB_DIR / "cleaned"
SCHEMA_PATH = DB_DIR / "schema.sql"
DB_PATH = DB_DIR / "mobility.db"


TRIP_COLUMNS = (
    "vendor_id", "tpep_pickup_datetime", "tpep_dropoff_datetime", "passenger_count",
    "trip_distance", "rate_code_id", "store_and_fwd_flag", "pu_location_id", "do_location_id",
    "payment_type_id", "fare_amount", "extra", "mta_tax", "tip_amount", "tolls_amount",
    "improvement_surcharge", "total_amount", "congestion_surcharge",
    "trip_duration_minutes", "speed_mph", "fare_per_mile", "tip_percentage", "is_peak_hour",
)


def run_schema(conn):
    with open(SCHEMA_PATH) as f:
        conn.executescript(f.read())


def load_zones(conn):
    path = CLEANED_DIR / "taxi_zones.csv"
    if not path.exists():
        raise FileNotFoundError(f"Run the pipeline first. Missing: {path}")
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        conn.executemany(
            "INSERT OR IGNORE INTO taxi_zones (location_id, borough, zone_name, service_zone) VALUES (?, ?, ?, ?)",
            [
                (int(row["location_id"]), row["borough"], row["zone_name"], row.get("service_zone") or "")
                for row in r
            ],
        )
    print(f"Loaded taxi_zones from {path}")


def load_zone_geometry(conn):
    path = DATA_DIR / "taxi_zones.geojson"
    if not path.exists():
        print(f"Optional taxi_zones.geojson not found at {path}; skipping zone_geometry.")
        return
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("type") != "FeatureCollection" or "features" not in data:
        print("taxi_zones.geojson not a FeatureCollection; skipping.")
        return
    count = 0
    for feature in data["features"]:
        props = feature.get("properties") or {}
        location_id = props.get("LocationID") or props.get("locationid") or props.get("location_id")
        if location_id is None:
            continue
        try:
            location_id = int(location_id)
        except (TypeError, ValueError):
            continue
        geometry = feature.get("geometry")
        if not geometry:
            continue
        geojson_text = json.dumps(geometry)
        conn.execute(
            "INSERT OR REPLACE INTO zone_geometry (location_id, geojson_text) VALUES (?, ?)",
            (location_id, geojson_text),
        )
        count += 1
    print(f"Loaded {count} zone geometries from {path}")


def load_trips(conn):
    path = CLEANED_DIR / "trips_cleaned.csv"
    if not path.exists():
        raise FileNotFoundError(f"Run the pipeline first. Missing: {path}")
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        cols = [k for k in r.fieldnames if k in TRIP_COLUMNS]
        if not cols:
            print("No trip columns to insert.")
            return
        placeholders = ", ".join("?" for _ in cols)
        col_list = ", ".join(cols)
        sql = f"INSERT INTO trips ({col_list}) VALUES ({placeholders})"

        def value(v, key):
            if v == "" or v is None or (isinstance(v, str) and v.lower() == "nan"):
                return None
            if key in ("pu_location_id", "do_location_id", "vendor_id", "rate_code_id", "payment_type_id", "passenger_count", "is_peak_hour"):
                try:
                    return int(float(v))
                except (ValueError, TypeError):
                    return None
            try:
                return float(v)
            except (ValueError, TypeError):
                return v

        chunk_size = 100_000
        total = 0
        chunk = []
        for row in r:
            chunk.append(tuple(value(row.get(c), c) for c in cols))
            if len(chunk) >= chunk_size:
                conn.executemany(sql, chunk)
                total += len(chunk)
                print(f"  inserted {total} trips...", flush=True)
                chunk = []
        if chunk:
            conn.executemany(sql, chunk)
            total += len(chunk)
        print(f"Inserted {total} trips from {path}")


def main():
    CLEANED_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        run_schema(conn)
        load_zones(conn)
        load_zone_geometry(conn)
        load_trips(conn)
        conn.commit()
        print(f"Database ready: {DB_PATH}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()

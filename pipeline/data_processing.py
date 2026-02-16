# NYC taxi data pipeline: load, clean, derive features, output to database/cleaned

import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
OUTPUT_DIR = PROJECT_ROOT / "database" / "cleaned"
CLEANING_LOG_PATH = Path(__file__).resolve().parent / "cleaning_log.md"


# custom merge sort
def _merge_sort(arr):
    n = len(arr)
    if n <= 1:
        return list(arr)
    mid = n // 2
    left = _merge_sort(arr[:mid])
    right = _merge_sort(arr[mid:])
    out = []
    i, j = 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1
    out.extend(left[i:])
    out.extend(right[j:])
    return out


def _get_quartiles(ordered_list):
    n = len(ordered_list)
    if n == 0:
        return None, None
    q1_idx = (n - 1) // 4
    q3_idx = (3 * (n - 1)) // 4
    q1 = ordered_list[q1_idx]
    q3 = ordered_list[q3_idx]
    return q1, q3


def custom_iqr_outlier_mask(values, lower_coef=1.5, upper_coef=1.5):
    # sort with our merge sort, get Q1/Q3, mark rows outside 1.5*IQR
    clean = [float(v) for v in values if v is not None and str(v) != "nan" and (isinstance(v, (int, float)) and v == v)]
    if len(clean) < 4:
        return [False] * len(values)

    sorted_copy = _merge_sort(clean)
    q1, q3 = _get_quartiles(sorted_copy)
    iqr = q3 - q1
    if iqr <= 0:
        iqr = 1e-9
    low = q1 - lower_coef * iqr
    high = q3 + upper_coef * iqr

    result = []
    for v in values:
        if v is None or (isinstance(v, float) and v != v):
            result.append(True)
        else:
            try:
                f = float(v)
                result.append(f < low or f > high)
            except (TypeError, ValueError):
                result.append(True)
    return result


def load_trip_data():
    # parquet first (TLC spec), fallback to csv
    parquet_files = sorted(DATA_DIR.glob("yellow_tripdata_*.parquet"))
    if parquet_files:
        try:
            df = pd.read_parquet(parquet_files[0])
            print(f"Loaded parquet: {parquet_files[0].name}")
            return df
        except Exception as e:
            print(f"Parquet read failed ({e}), trying CSV...")
    csv_files = sorted(DATA_DIR.glob("yellow_tripdata_*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No yellow_tripdata_*.parquet or *.csv in {DATA_DIR}")
    df = pd.read_csv(csv_files[0])
    print(f"Loaded CSV: {csv_files[0].name}")
    return df


def load_zone_lookup():
    path = DATA_DIR / "taxi_zone_lookup.csv"
    if not path.exists():
        raise FileNotFoundError(f"Missing {path}. Need taxi_zone_lookup.csv in data/.")
    return pd.read_csv(path)


def standardize_columns(df):
    df = df.copy()
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    return df


def clean_trips(raw_df, zone_lookup_df):
    df = raw_df.copy()
    df = standardize_columns(df)
    zone_lookup_df = standardize_columns(zone_lookup_df)

    valid_location_ids = set(zone_lookup_df["locationid"].astype(int))

    # rename cols that come in with different names from TLC
    col_map = {
        "vendorid": "vendor_id",
        "ratecodeid": "rate_code_id",
        "pulocationid": "pu_location_id",
        "dolocationid": "do_location_id",
        "payment_type": "payment_type_id",
    }
    for old, new in col_map.items():
        if old in df.columns and new not in df.columns:
            df = df.rename(columns={old: new})

    initial_count = len(df)
    log = {"steps": [], "excluded_count": 0, "excluded_reasons": {}}

    required = ["tpep_pickup_datetime", "tpep_dropoff_datetime", "trip_distance", "total_amount", "pu_location_id", "do_location_id"]
    present = [c for c in required if c in df.columns]
    before = len(df)
    df = df.dropna(subset=present)
    dropped = before - len(df)
    log["steps"].append(f"Drop missing in {present}: {dropped} rows")
    log["excluded_count"] += dropped
    log["excluded_reasons"]["missing_required"] = dropped
    print("  - drop missing done")

    key_cols = [c for c in ["tpep_pickup_datetime", "tpep_dropoff_datetime", "pu_location_id", "do_location_id", "total_amount"] if c in df.columns]
    if key_cols:
        before = len(df)
        df = df.drop_duplicates(subset=key_cols)
        dup = before - len(df)
        log["steps"].append(f"Drop duplicates on {key_cols}: {dup} rows")
        log["excluded_count"] += dup
        log["excluded_reasons"]["duplicates"] = dup
        print("  - drop duplicates done")

    if "pu_location_id" in df.columns and "do_location_id" in df.columns:
        before = len(df)
        df = df[
            df["pu_location_id"].astype(int).isin(valid_location_ids)
            & df["do_location_id"].astype(int).isin(valid_location_ids)
        ]
        inv = before - len(df)
        log["steps"].append(f"Drop invalid PULocationID/DOLocationID: {inv} rows")
        log["excluded_count"] += inv
        log["excluded_reasons"]["invalid_locations"] = inv
        print("  - invalid locations done")

    before = len(df)
    if "trip_distance" in df.columns:
        df = df[df["trip_distance"] > 0]
    if "total_amount" in df.columns:
        df = df[df["total_amount"] >= 0]
    if "fare_amount" in df.columns:
        df = df[df["fare_amount"] >= 0]
    if "tpep_pickup_datetime" in df.columns and "tpep_dropoff_datetime" in df.columns:
        df["_pickup_ts"] = pd.to_datetime(df["tpep_pickup_datetime"], errors="coerce")
        df["_dropoff_ts"] = pd.to_datetime(df["tpep_dropoff_datetime"], errors="coerce")
        df = df.dropna(subset=["_pickup_ts", "_dropoff_ts"])
        df = df[df["_dropoff_ts"] > df["_pickup_ts"]]
        df = df.drop(columns=["_pickup_ts", "_dropoff_ts"])
    bound = before - len(df)
    log["steps"].append(f"Drop invalid bounds (distance/fare/time): {bound} rows")
    log["excluded_count"] += bound
    log["excluded_reasons"]["invalid_bounds"] = bound
    print("  - bounds check done")

    for col, name in [("trip_distance", "trip_distance"), ("total_amount", "total_amount")]:
        if col not in df.columns:
            continue
        print(f"  - IQR outliers ({name})...", flush=True)
        mask = custom_iqr_outlier_mask(df[col].tolist())
        before = len(df)
        df = df[[not m for m in mask]]
        out = before - len(df)
        log["steps"].append(f"Custom IQR outliers ({name}): {out} rows")
        log["excluded_count"] += out
        log["excluded_reasons"][f"outlier_{name}"] = out

    log["final_count"] = len(df)
    log["initial_count"] = initial_count
    return df, log


def normalize_timestamps(df):
    for col in ["tpep_pickup_datetime", "tpep_dropoff_datetime"]:
        if col not in df.columns:
            continue
        df[col] = pd.to_datetime(df[col], errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")
    return df


def normalize_numerics(df):
    numeric_optional = ["extra", "mta_tax", "tip_amount", "tolls_amount", "improvement_surcharge", "congestion_surcharge", "passenger_count"]
    for col in numeric_optional:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    for col in ["trip_distance", "fare_amount", "total_amount"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def add_derived_features(df):
    # 5 derived: duration, speed, fare/mile, tip%, peak hour (7-9, 16-19)
    df = df.copy()
    pickup = pd.to_datetime(df["tpep_pickup_datetime"], errors="coerce")
    dropoff = pd.to_datetime(df["tpep_dropoff_datetime"], errors="coerce")
    duration = (dropoff - pickup).dt.total_seconds() / 60.0
    df["trip_duration_minutes"] = duration.round(2)

    hours = duration / 60.0
    hours = hours.replace(0, float("nan"))
    df["speed_mph"] = (df["trip_distance"] / hours).round(2)
    df["speed_mph"] = df["speed_mph"].fillna(0).clip(upper=100)

    dist = df["trip_distance"].replace(0, float("nan"))
    df["fare_per_mile"] = (df["fare_amount"] / dist).round(2)
    df["fare_per_mile"] = df["fare_per_mile"].fillna(0)

    total = df["total_amount"].replace(0, float("nan"))
    df["tip_percentage"] = (100.0 * df["tip_amount"] / total).round(2)
    df["tip_percentage"] = df["tip_percentage"].fillna(0)

    hour = pickup.dt.hour
    df["is_peak_hour"] = ((hour >= 7) & (hour <= 9) | (hour >= 16) & (hour <= 19)).astype(int)

    return df


def write_cleaning_log(log, path=CLEANING_LOG_PATH):
    lines = [
        "# Data Cleaning Log",
        "",
        "## Summary",
        f"- Initial row count: {log.get('initial_count', 'N/A')}",
        f"- Final row count: {log.get('final_count', 'N/A')}",
        f"- Total excluded: {log.get('excluded_count', 'N/A')}",
        "",
        "## Steps",
    ]
    for step in log.get("steps", []):
        lines.append(f"- {step}")
    lines.extend(["", "## Excluded by reason", ""])
    for reason, count in log.get("excluded_reasons", {}).items():
        lines.append(f"- {reason}: {count}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


def run_pipeline(sample_rows=None):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading trip data...")
    trips = load_trip_data()
    print("Loading zone lookup...")
    zones = load_zone_lookup()

    if sample_rows:
        trips = trips.head(sample_rows)
        print(f"Using sample of {sample_rows} rows.")

    print("Cleaning...")
    trips_clean, cleaning_log = clean_trips(trips, zones)
    print("Normalizing timestamps and numerics...")
    trips_clean = normalize_timestamps(trips_clean)
    trips_clean = normalize_numerics(trips_clean)
    print("Adding derived features...")
    trips_clean = add_derived_features(trips_clean)

    out_cols = [
        "vendor_id", "tpep_pickup_datetime", "tpep_dropoff_datetime", "passenger_count",
        "trip_distance", "rate_code_id", "store_and_fwd_flag", "pu_location_id", "do_location_id",
        "payment_type_id", "fare_amount", "extra", "mta_tax", "tip_amount", "tolls_amount",
        "improvement_surcharge", "total_amount", "congestion_surcharge",
        "trip_duration_minutes", "speed_mph", "fare_per_mile", "tip_percentage", "is_peak_hour",
    ]
    out_cols = [c for c in out_cols if c in trips_clean.columns]
    trips_clean = trips_clean[out_cols]

    out_csv = OUTPUT_DIR / "trips_cleaned.csv"
    trips_clean.to_csv(out_csv, index=False)
    print(f"Wrote {trips_clean.shape[0]} rows to {out_csv}")

    zones_out = standardize_columns(zones).rename(columns={"locationid": "location_id", "zone": "zone_name"})
    zones_out = zones_out[["location_id", "borough", "zone_name", "service_zone"]]
    zones_out.to_csv(OUTPUT_DIR / "taxi_zones.csv", index=False)
    print(f"Wrote taxi_zones to {OUTPUT_DIR / 'taxi_zones.csv'}")

    write_cleaning_log(cleaning_log)
    print(f"Wrote cleaning log to {CLEANING_LOG_PATH}")
    return trips_clean, zones_out, cleaning_log


if __name__ == "__main__":
    sample = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run_pipeline(sample_rows=sample)

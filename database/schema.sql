-- NYC taxi trip schema (SQLite)
-- zones from lookup csv, trips from cleaned pipeline output

CREATE TABLE IF NOT EXISTS taxi_zones (
    location_id INTEGER PRIMARY KEY,
    borough TEXT NOT NULL,
    zone_name TEXT NOT NULL,
    service_zone TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_taxi_zones_borough ON taxi_zones(borough);
CREATE INDEX idx_taxi_zones_service_zone ON taxi_zones(service_zone);

-- rate codes from TLC data dictionary
CREATE TABLE IF NOT EXISTS rate_codes (
    rate_code_id INTEGER PRIMARY KEY,
    description TEXT NOT NULL
);

INSERT OR IGNORE INTO rate_codes (rate_code_id, description) VALUES
(1, 'Standard rate'),
(2, 'JFK'),
(3, 'Newark'),
(4, 'Nassau or Westchester'),
(5, 'Negotiated fare'),
(6, 'Group ride');

CREATE TABLE IF NOT EXISTS payment_types (
    payment_type_id INTEGER PRIMARY KEY,
    description TEXT NOT NULL
);

INSERT OR IGNORE INTO payment_types (payment_type_id, description) VALUES
(1, 'Credit card'),
(2, 'Cash'),
(3, 'No charge'),
(4, 'Dispute'),
(5, 'Unknown'),
(6, 'Voided trip');

-- main trip table (raw cols + derived features from pipeline)
CREATE TABLE IF NOT EXISTS trips (
    trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER,
    tpep_pickup_datetime TEXT NOT NULL,
    tpep_dropoff_datetime TEXT NOT NULL,
    passenger_count INTEGER,
    trip_distance REAL NOT NULL,
    rate_code_id INTEGER,
    store_and_fwd_flag TEXT,
    pu_location_id INTEGER NOT NULL,
    do_location_id INTEGER NOT NULL,
    payment_type_id INTEGER,
    fare_amount REAL NOT NULL,
    extra REAL,
    mta_tax REAL,
    tip_amount REAL,
    tolls_amount REAL,
    improvement_surcharge REAL,
    total_amount REAL NOT NULL,
    congestion_surcharge REAL,
    trip_duration_minutes REAL,
    speed_mph REAL,
    fare_per_mile REAL,
    tip_percentage REAL,
    is_peak_hour INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (pu_location_id) REFERENCES taxi_zones(location_id),
    FOREIGN KEY (do_location_id) REFERENCES taxi_zones(location_id),
    FOREIGN KEY (rate_code_id) REFERENCES rate_codes(rate_code_id),
    FOREIGN KEY (payment_type_id) REFERENCES payment_types(payment_type_id)
);

CREATE INDEX idx_trips_pickup_datetime ON trips(tpep_pickup_datetime);
CREATE INDEX idx_trips_dropoff_datetime ON trips(tpep_dropoff_datetime);
CREATE INDEX idx_trips_pu_location ON trips(pu_location_id);
CREATE INDEX idx_trips_do_location ON trips(do_location_id);
CREATE INDEX idx_trips_total_amount ON trips(total_amount);
CREATE INDEX idx_trips_trip_distance ON trips(trip_distance);
CREATE INDEX idx_trips_duration ON trips(trip_duration_minutes);
CREATE INDEX idx_trips_peak_hour ON trips(is_peak_hour);

-- optional: zone shapes (geojson text)
CREATE TABLE IF NOT EXISTS zone_geometry (
    location_id INTEGER PRIMARY KEY,
    geojson_text TEXT,
    FOREIGN KEY (location_id) REFERENCES taxi_zones(location_id)
);

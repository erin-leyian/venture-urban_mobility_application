import sqlite3
import pandas as pd
import os

print("Creating mock database...")

#load sample data

df = pd.read_parquet('data/sample_trips.parquet')

print(f"Loaded {len(df)} rows")

#create sqlite database 

conn = sqlite3.connect('data/taxi_mock.db')

#clean data 

df_clean = df.dropna(subset=['tpep_pickup_datetime', 'trip_distance', 'total_amount'])

#cleaning

count_before = len(df_clean)

df_clean = df_clean[
    (df_clean['trip_distance'] > 0) &
    (df_clean['trip_distance'] < 100) &
    (df_clean['total_amount'] > 0) &
    (df_clean['total_amount'] < 500)
]

count_after = len(df_clean)

print(f"Cleaned data: {count_before} rows before, {count_after} rows after")

#create trips table

df_clean.to_sql('trips', conn, if_exists='replace', index=False)

print(f"Created trips table with {len(df_clean)} rows")

#create zones table

zones_path = 'data/taxi_zone_lookup.csv'

if not os.path.exists(zones_path):
    print("taxi_zone_lookup.csv not found in data/ folder!")
    exit()

zones_df = pd.read_csv(zones_path)
print(f"Zones columns: {list(zones_df.columns)}")

zones_df.to_sql('zones', conn, if_exists='replace', index=False)

print(f"Created zones table with {len(zones_df)} rows")

#show sample data
print("\nSample trips data:")
cursor = conn.cursor()
cursor.execute("SELECT * FROM trips LIMIT 1")
row = cursor.fetchone()
print(row)

#test query
cursor.execute("SELECT COUNT(*) FROM trips")
count = cursor.fetchone()[0]
print(f"\nTotal trips in database: {count}")

#show columns

cursor.execute("PRAGMA table_info(trips)")
columns = cursor.fetchall()
print("\nTrips table columns:")
for col in columns:
    print(f" - {col[1]} ({col[2]})")

conn.close()
print("\nMock database created at data/taxi_mock.db")


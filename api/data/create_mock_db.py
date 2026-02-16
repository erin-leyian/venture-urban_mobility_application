import sqlite3
import pandas as pd

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

zones_data = {
    'LocationID': [1, 4, 12, 13, 24, 41, 42, 43, 45, 48, 79, 87, 88, 90, 100, 107, 113, 114, 116, 125, 127, 128, 130, 137, 140, 141, 142, 143, 144, 148, 151, 152, 161, 162, 163, 164, 166, 170, 186, 194, 202, 209, 211, 224, 229, 230, 231, 232, 233, 234, 236, 237, 238, 239, 243, 244, 246, 249, 261, 262, 263],
    'Borough': ['Manhattan', 'Manhattan', 'Queens', 'Queens', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Queens', 'Queens', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Queens', 'Queens', 'Queens', 'Queens', 'Queens', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Queens', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Queens', 'Queens', 'Brooklyn', 'Brooklyn', 'Brooklyn', 'Brooklyn', 'Brooklyn', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Manhattan', 'Bronx', 'Bronx', 'Bronx'],
    'Zone': ['Newark Airport', 'Alphabet City', 'JFK Airport', 'Jamaica', 'Alphabet City', 'Central Park', 'Central Harlem', 'Central Harlem North', 'Chinatown', 'Clinton East', 'East Village', 'Jackson Heights', 'Jamaica', 'Lenox Hill West', 'Lincoln Square East', 'Lower East Side', 'Midtown Center', 'Midtown East', 'Murray Hill-Queens', 'Sunnyside', 'Steinway', 'Astoria', 'Astoria Park', 'Penn Station/Madison Sq West', 'Morningside Heights', 'Marble Hill', 'Manhattanville', 'Marcus Garvey Park', 'Meatpacking/West Village West', 'Midtown South', 'Murray Hill', 'Murray Hill', 'Park Slope', 'Park Slope', 'Park Slope', 'Park Slope', 'Penn Station/Madison Sq West', 'Prospect Heights', 'Rockaway Park', 'Soundview/Bruckner', 'Stuyvesant Heights', 'Times Sq/Theatre District', 'Two Bridges/Seward Park', 'Upper East Side North', 'Whitestone', 'Willets Point', 'Williamsburg (North Side)', 'Williamsburg (South Side)', 'Windsor Terrace', 'Woodlawn/Wakefield', 'Woodside', 'World Trade Center', 'Yorkville East', 'Yorkville West', 'Union Sq', 'Upper East Side South', 'Upper West Side North', 'West Chelsea/Hudson Yards', 'Fordham/Bronx Park', 'Highbridge Park', 'Hunts Point']
}

zones_df = pd.DataFrame(zones_data)
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


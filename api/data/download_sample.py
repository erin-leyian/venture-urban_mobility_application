import pandas as pd
import os

print("Downloading sample data...")

#Recent month (November 2025) sample data

file_path = 'data/yellow_tripdata_2019-01.csv'

#Check file exists

if not os.path.exists(file_path):
    print(f" File not found at: {file_path}")
    exit()

#read first 10000 rows

df = pd.read_csv(file_path)
sample = df.head(10000)

print(f"Dowloaded {len(sample)} rows")
print(f"Columns: {list(sample.columns)}")

#save as csv
sample.to_csv('data/sample_trips.csv', index=False)

#save as parquet
sample.to_parquet('data/sample_trips.parquet', index=False)

print("Sample data saved to data/sample_trips.csv and data/sample_trips.parquet")

print("\nSample columns:")
print(sample.columns.tolist())

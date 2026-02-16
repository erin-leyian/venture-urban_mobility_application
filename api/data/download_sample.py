import pandas as pd
import os

print("Downloading sample data...")

#Recent month (November 2025) sample data

url = "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2025-11.parquet"

#read first 10000 rows

df = pd.read_parquet(url, engine='pyarrow')
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

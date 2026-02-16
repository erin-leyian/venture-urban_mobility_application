# Data Cleaning Log

## Summary
- Initial row count: 7667792
- Final row count: 6552645
- Total excluded: 1115147

## Steps
- Drop missing in ['tpep_pickup_datetime', 'tpep_dropoff_datetime', 'trip_distance', 'total_amount', 'pu_location_id', 'do_location_id']: 0 rows
- Drop duplicates on ['tpep_pickup_datetime', 'tpep_dropoff_datetime', 'pu_location_id', 'do_location_id', 'total_amount']: 4 rows
- Drop invalid PULocationID/DOLocationID: 0 rows
- Drop invalid bounds (distance/fare/time): 60793 rows
- Custom IQR outliers (trip_distance): 872116 rows
- Custom IQR outliers (total_amount): 182234 rows

## Excluded by reason

- missing_required: 0
- duplicates: 4
- invalid_locations: 0
- invalid_bounds: 60793
- outlier_trip_distance: 872116
- outlier_total_amount: 182234
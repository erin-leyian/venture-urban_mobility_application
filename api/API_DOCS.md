# API DOCUMENTATION

Base URL : `http://localhost:5000`

The Database has 6,552,645 NYC taxi trips fron January 2019


#Endpoints

1. GET/api/trips
Get the trips with optional filters

Query Parameters:
- `limit` (int, default: 100) - Number of results
- `borough` (string) - Filter by borough (Manhattan, Queens, Brooklyn, Bronx)
- `min_fare` (float) - Minimum fare amount
- `max_fare` (float) - Maximum fare amount
- `min_distance` (float) - Minimum trip distance
- `max_distance` (float) - Maximum trip distance
- `is_peak_hour` (0 or 1) - Filter by rush hour

Example: 
'''
GET /api/trips?borough=Manhattan&limit=50
'''

2. GET /api/statistics

For overall statistics across all trips

Response:
{
  "avg_distance": 1.63,
  "avg_duration_minutes": 13.37,
  "avg_fare": 11.18,
  "avg_fare_per_mile": 6.59,
  "avg_passengers": 1.57,
  "avg_speed_mph": 10.25,
  "avg_tip": 1.31,
  "total_revenue": 73258642.14,
  "total_trips": 6552645
}

3. GET /api/insights
Key insights from the data
 
Response:
{
  "insights": [
    {
      "metric": "6,278,659 trips",
      "title": "Busiest Pickup Borough",
      "value": "Manhattan"
    },
    {
      "metric": "across all trips",
      "title": "Average Trip Speed",
      "value": "10.2 mph"
    },
    {
      "metric": "of all trips happen during rush hour",
      "title": "Peak Hour Trips",
      "value": "38.6%"
    },
    {
      "metric": "revenue per mile driven",
      "title": "Average Fare Per Mile",
      "value": "$6.59"
    }
  ]
}

4. GET /api/zones
All taxi and boroughts

Response: 

  "boroughs": [
    "",
    "Bronx",
    "Brooklyn",
    "EWR",
    "Manhattan",
    "Queens",
    "Staten Island",
    "Unknown"
  ],
  "zones": [
    {
      "borough": "",
      "location_id": 265,
      "zone_name": "Outside of NYC"
    },
  ]
5. GET /api/top-routes
Most popular pickup-dropoff routes (sorted using custom merge sort algorithm).

Query Parameters:
`limit` (int, default: 10) - Number of routes

Example:
'''
GET /api/top-routed?limit=5
'''

6. GET /api/statistics/by-borough
Statistics grouped by borough.

Response:
{
  "by_borough": [
    {
      "avg_distance": 1.62,
      "avg_duration": 13.4,
      "avg_fare": 11.16,
      "avg_speed": 10.16,
      "borough": "Manhattan",
      "total_revenue": 70065094.35,
      "trip_count": 6278659
    }
  ]
}

7. GET /api/statistics/peak-vs-offpeak
Compare rush hour vs off-peak trips

Response:
{
  "off_peak": {
    "avg_distance": 1.68,
    "avg_duration": 13.16,
    "avg_fare": 11.09,
    "avg_tip_percentage": 10.95,
    "trip_count": 4024941
  },
  "peak_hour": {
    "avg_distance": 1.56,
    "avg_duration": 13.71,
    "avg_fare": 11.33,
    "avg_tip_percentage": 11.37,
    "trip_count": 2527704
  }
}

#NOTES
-All responses return JSON.
-CORS enabled for frontend integration
-Peak hours have been defined as: 7-9 AM and 5-7 PM weekdays
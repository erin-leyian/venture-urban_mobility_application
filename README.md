# venture urban mobility application

We built this for the summative: it uses NYC TLC taxi trip data. You clean and load the data into a database, run a backend to query it, and a frontend dashboard to explore and visualise it.

## Dataset

- **yellow_tripdata** (fact table): trip records — timestamps, distances, fares, PULocationID, DOLocationID.
- **taxi_zone_lookup** (dimension): maps LocationID to Borough, Zone, and service_zone.
- **taxi_zones** (spatial): GeoJSON boundaries for the taxi zones.

## Project Structure

```
urban-mobility-data-explorer/
├── data/                    # Raw data (put your files here)
│   ├── yellow_tripdata_*.csv
│   ├── taxi_zone_lookup.csv
│   └── taxi_zones.geojson
├── backend/                 # Person 2: Flask/Node API
├── frontend/                # Person 3: Dashboard
├── database/                # Person 1: Schema & scripts
│   ├── schema.sql
│   └── insert_data.py
├── pipeline/                # Person 1: Data engineering
│   ├── data_processing.py
│   ├── cleaning_log.md
│   └── requirements.txt
└── docs/                    # Technical report, team sheet
```

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+ (if you use the Node backend)
- SQLite (we use it by default), or PostgreSQL/MySQL if you change the schema.

### 1. Data

1. Download from [NYC TLC Trip Record Data](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page):
   - One month of yellow_tripdata as **.parquet** (preferred) or `.csv` (e.g. `yellow_tripdata_2019-01.parquet` or `yellow_tripdata_2019-01.csv`)
   - `taxi_zone_lookup.csv`
   - `taxi_zones.geojson` (optional; if present, zone boundaries are loaded into the database for map use)
2. Put the files in `data/`.
3. Set up and run the pipeline:

   ```bash
   cd pipeline && python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. Run the pipeline (it cleans the data, adds features, writes CSVs):

   ```bash
   python data_processing.py
   ```

   You can pass a number to only process that many rows, e.g. `python data_processing.py 100000`.

5. Load the data into the database:

   ```bash
   cd ../database && python insert_data.py
   ```

### 2. Backend (Person 2)

### Prerequisites
- Python 3.8+
- pip

### Installation
```bash
cd api
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Backend
```bash
python app.py
```

The API will run on **http://localhost:5000**

### API Endpoints
- `GET /api/trips` - Get trips with filters
- `GET /api/statistics` - Overall statistics
- `GET /api/insights` - Key insights
- `GET /api/zones` - All taxi zones
- `GET /api/top-routes` - Most popular routes
- `GET /api/statistics/by-borough` - Stats by borough
- `GET /api/statistics/peak-vs-offpeak` - Rush hour analysis

See `API_DOCS.md` for detailed endpoint documentation.

### 3. Frontend (Person 3)

*Person 3 to add: how to run/serve the frontend, any install steps.*

## Video Walkthrough

[Add your 5-minute video link here]

## Team

- **Belyse Intwaza**: Data engineering & database (cleaning, feature engineering, schema, insert script, custom algorithm).
- **Erin Wanjiru Leyian**: Backend API and business logic.
- **Kenny Gael Ishimwe Gatete**: Frontend and visualisations.

## License

For course use only.

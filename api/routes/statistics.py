from flask import Blueprint, jsonify
from utils.db_connect import get_db_connection, dict_from_row

stats_bp = Blueprint('statistics', __name__)

@stats_bp.route('/api/statistics', methods=['GET'])
def get_statistics():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COUNT(*) as total_trips,
            AVG(trip_distance) as avg_distance,
            AVG(total_amount) as avg_fare,
            AVG(tip_amount) as avg_tip,
            AVG(passenger_count) as avg_passengers,
            AVG(trip_duration_minutes) as avg_duration_minutes,
            AVG(speed_mph) as avg_speed_mph,
            AVG(fare_per_mile) as avg_fare_per_mile,
            SUM(total_amount) as total_revenue
        FROM trips
    """)

    stats = dict_from_row(cursor.fetchone())
    conn.close()

    stats = {k: round(v, 2) if isinstance(v, float) else v 
             for k, v in stats.items()}

    return jsonify(stats)


@stats_bp.route('/api/statistics/by-borough', methods=['GET'])
def get_stats_by_borough():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            z.borough,
            COUNT(*) as trip_count,
            AVG(t.trip_distance) as avg_distance,
            AVG(t.total_amount) as avg_fare,
            AVG(t.trip_duration_minutes) as avg_duration,
            AVG(t.speed_mph) as avg_speed,
            SUM(t.total_amount) as total_revenue
        FROM trips t
        JOIN taxi_zones z ON t.pu_location_id = z.location_id
        GROUP BY z.borough
        ORDER BY trip_count DESC
    """)

    rows = cursor.fetchall()
    stats = []
    for row in rows:
        stats.append({
            "borough": row['borough'],
            "trip_count": row['trip_count'],
            "avg_distance": round(row['avg_distance'], 2),
            "avg_fare": round(row['avg_fare'], 2),
            "avg_duration": round(row['avg_duration'], 2),
            "avg_speed": round(row['avg_speed'], 2),
            "total_revenue": round(row['total_revenue'], 2)
        })

    conn.close()
    return jsonify({"by_borough": stats})


@stats_bp.route('/api/statistics/peak-vs-offpeak', methods=['GET'])
def get_peak_vs_offpeak():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            is_peak_hour,
            COUNT(*) as trip_count,
            AVG(total_amount) as avg_fare,
            AVG(trip_distance) as avg_distance,
            AVG(trip_duration_minutes) as avg_duration,
            AVG(tip_percentage) as avg_tip_percentage
        FROM trips
        GROUP BY is_peak_hour
    """)

    rows = cursor.fetchall()
    result = {}
    for row in rows:
        key = "peak_hour" if row['is_peak_hour'] == 1 else "off_peak"
        result[key] = {
            "trip_count": row['trip_count'],
            "avg_fare": round(row['avg_fare'], 2),
            "avg_distance": round(row['avg_distance'], 2),
            "avg_duration": round(row['avg_duration'], 2),
            "avg_tip_percentage": round(row['avg_tip_percentage'], 2)
        }

    conn.close()
    return jsonify(result)


@stats_bp.route('/api/insights', methods=['GET'])
def get_insights():
    conn = get_db_connection()
    cursor = conn.cursor()
    insights = []

    # Insight 1: Busiest borough
    cursor.execute("""
        SELECT z.borough, COUNT(*) as trip_count
        FROM trips t
        JOIN taxi_zones z ON t.pu_location_id = z.location_id
        GROUP BY z.borough
        ORDER BY trip_count DESC
        LIMIT 1
    """)
    row = cursor.fetchone()
    if row:
        insights.append({
            "title": "Busiest Pickup Borough",
            "value": row['borough'],
            "metric": f"{row['trip_count']:,} trips"
        })

    # Insight 2: Average speed
    cursor.execute("SELECT AVG(speed_mph) as avg_speed FROM trips WHERE speed_mph > 0")
    avg_speed = cursor.fetchone()['avg_speed']
    insights.append({
        "title": "Average Trip Speed",
        "value": f"{avg_speed:.1f} mph",
        "metric": "across all trips"
    })

    # Insight 3: Peak vs off-peak trips
    cursor.execute("SELECT COUNT(*) as cnt FROM trips WHERE is_peak_hour = 1")
    peak_count = cursor.fetchone()['cnt']
    cursor.execute("SELECT COUNT(*) as cnt FROM trips")
    total = cursor.fetchone()['cnt']
    peak_pct = (peak_count / total) * 100
    insights.append({
        "title": "Peak Hour Trips",
        "value": f"{peak_pct:.1f}%",
        "metric": "of all trips happen during rush hour"
    })

    # Insight 4: Average fare per mile
    cursor.execute("SELECT AVG(fare_per_mile) as avg_fpm FROM trips WHERE fare_per_mile > 0")
    avg_fpm = cursor.fetchone()['avg_fpm']
    insights.append({
        "title": "Average Fare Per Mile",
        "value": f"${avg_fpm:.2f}",
        "metric": "revenue per mile driven"
    })

    conn.close()
    return jsonify({"insights": insights})
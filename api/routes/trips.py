from flask import Blueprint, jsonify, request
from utils.db_connect import get_db_connection, dict_from_row
from utils.custom_sort import merge_sort

trips_bp = Blueprint('trips', __name__)

@trips_bp.route('/api/trips', methods=['GET'])
def get_trips():
    limit = request.args.get('limit', 100, type=int)
    borough = request.args.get('borough', None)
    min_fare = request.args.get('min_fare', None, type=float)
    max_fare = request.args.get('max_fare', None, type=float)
    min_distance = request.args.get('min_distance', None, type=float)
    max_distance = request.args.get('max_distance', None, type=float)
    is_peak = request.args.get('is_peak_hour', None, type=int)

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            t.trip_id,
            t.tpep_pickup_datetime,
            t.tpep_dropoff_datetime,
            t.passenger_count,
            t.trip_distance,
            t.fare_amount,
            t.tip_amount,
            t.total_amount,
            t.trip_duration_minutes,
            t.speed_mph,
            t.fare_per_mile,
            t.tip_percentage,
            t.is_peak_hour,
            z1.borough as pickup_borough,
            z1.zone_name as pickup_zone,
            z2.borough as dropoff_borough,
            z2.zone_name as dropoff_zone
        FROM trips t
        LEFT JOIN taxi_zones z1 ON t.pu_location_id = z1.location_id
        LEFT JOIN taxi_zones z2 ON t.do_location_id = z2.location_id
        WHERE 1=1
    """
    params = []

    if borough:
        query += " AND (z1.borough = ? OR z2.borough = ?)"
        params.extend([borough, borough])

    if min_fare is not None:
        query += " AND t.total_amount >= ?"
        params.append(min_fare)

    if max_fare is not None:
        query += " AND t.total_amount <= ?"
        params.append(max_fare)

    if min_distance is not None:
        query += " AND t.trip_distance >= ?"
        params.append(min_distance)

    if max_distance is not None:
        query += " AND t.trip_distance <= ?"
        params.append(max_distance)

    if is_peak is not None:
        query += " AND t.is_peak_hour = ?"
        params.append(is_peak)

    query += " LIMIT ?"
    params.append(limit)

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()
        trips = [dict_from_row(row) for row in rows]
        conn.close()
        return jsonify({"count": len(trips), "trips": trips})
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500


@trips_bp.route('/api/zones', methods=['GET'])
def get_zones():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT DISTINCT borough FROM taxi_zones ORDER BY borough")
    boroughs = [row['borough'] for row in cursor.fetchall()]

    cursor.execute("SELECT location_id, borough, zone_name FROM taxi_zones ORDER BY borough, zone_name")
    zones = [dict_from_row(row) for row in cursor.fetchall()]

    conn.close()
    return jsonify({"boroughs": boroughs, "zones": zones})


@trips_bp.route('/api/top-routes', methods=['GET'])
def get_top_routes():
    limit = request.args.get('limit', 10, type=int)

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            z1.borough as pickup_borough,
            z1.zone_name as pickup_zone,
            z2.borough as dropoff_borough,
            z2.zone_name as dropoff_zone,
            COUNT(*) as trip_count,
            AVG(t.trip_distance) as avg_distance,
            AVG(t.total_amount) as avg_fare,
            AVG(t.trip_duration_minutes) as avg_duration
        FROM trips t
        JOIN taxi_zones z1 ON t.pu_location_id = z1.location_id
        JOIN taxi_zones z2 ON t.do_location_id = z2.location_id
        WHERE z1.borough != 'Unknown' 
        AND z2.borough != 'Unknown'
        AND z1.borough != ''
        AND z2.borough != ''
        GROUP BY t.pu_location_id, t.do_location_id
    """

    cursor.execute(query)
    rows = cursor.fetchall()

    routes = []
    for row in rows:
        routes.append({
            "pickup_borough": row['pickup_borough'],
            "pickup_zone": row['pickup_zone'],
            "dropoff_borough": row['dropoff_borough'],
            "dropoff_zone": row['dropoff_zone'],
            "trip_count": row['trip_count'],
            "avg_distance": round(row['avg_distance'], 2),
            "avg_fare": round(row['avg_fare'], 2),
            "avg_duration": round(row['avg_duration'], 2)
        })

    conn.close()

    # Use YOUR custom merge sort (no built-in sort!)
    sorted_routes = merge_sort(routes, key='trip_count', reverse=True)

    return jsonify({
        "count": min(limit, len(sorted_routes)),
        "routes": sorted_routes[:limit]
    })
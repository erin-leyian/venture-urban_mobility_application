from flask import Blueprint, jsonify, request
from utils.db_connect import get_db_connection, dict_from_row

trips_bp = Blueprint('trips', __name__)

@trips_bp.route('/api/trips', methods=['GET'])
def get_trips():
    """
    Get trips with optional filters 
    Query parameters:
    - limit: number of results (default 100)
    -borough: filter by borough
    -min_distance: minimum trip distance
    -max_distance: maximum trip distance
    -min_fare: minimum fare amount
    -max_fare: maximum fare amount
    """

    #Get query parameters

    limit = request.args.get('limit', 100, type=int)
    borough = request.args.get('borough', None, )
    min_fare = request.args.get('min_fare', None, type=float)
    max_fare = request.args.get('max_fare', None, type=float)
    min_distance = request.args.get('min_distance', None, type=float)
    max_distance = request.args.get('max_distance', None, type=float)

    conn = get_db_connection()
    cursor = conn.cursor()

    #build query with real column names
    query = """
         SELECT 
                        t.VendorID,
            t.tpep_pickup_datetime,
            t.tpep_dropoff_datetime,
            t.passenger_count,
            t.trip_distance,
            t.PULocationID,
            t.DOLocationID,
            t.payment_type,
            t.fare_amount,
            t.tip_amount,
            t.total_amount,
            z1.Borough as pickup_borough,
            z1.Zone as pickup_zone,
            z2.Borough as dropoff_borough,
            z2.Zone as dropoff_zone
        FROM trips t
        LEFT JOIN zones z1 ON t.PULocationID = z1.LocationID
        LEFT JOIN zones z2 ON t.DOLocationID = z2.LocationID
        WHERE 1=1
"""
    params = []

    if borough:
        query += " AND (z1.Borough = ? OR z2.Borough = ?)"
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

    query += f" LIMIT ?"
    params.append(limit)

    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()

        trips = [dict_from_row(row) for row in rows]

        conn.close()

        return jsonify({
            "count": len(trips),
            "trips": trips
        })
    except Exception as e:
        conn.close()
        return jsonify({"error": str(e)}), 500
    
@trips_bp.route('/api/zones', methods=['GET'])
def get_zones():
    """
    Get all zones
    """
    conn = get_db_connection()
    cursor = conn.cursor()

     # Get unique boroughs
    cursor.execute("SELECT DISTINCT Borough FROM zones ORDER BY Borough")
    rows = cursor.fetchall()
    boroughs = [row['Borough'] for row in rows]
    
    # Get all zones
    cursor.execute("SELECT LocationID, Borough, Zone FROM zones ORDER BY Borough, Zone")
    zone_rows = cursor.fetchall()
    zones = [dict_from_row(row) for row in zone_rows]
    
    conn.close()

    return jsonify({
        "boroughs": boroughs,
        "zones": zones
    })

@trips_bp.route('/api/top-routes', methods=['GET'])
def get_top_routes():
    """Get most popular pickup-dropoff routes"""
    
    limit = request.args.get('limit', 10, type=int)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            z1.Borough as pickup_borough,
            z1.Zone as pickup_zone,
            z2.Borough as dropoff_borough,
            z2.Zone as dropoff_zone,
            COUNT(*) as trip_count,
            AVG(t.trip_distance) as avg_distance,
            AVG(t.total_amount) as avg_fare
        FROM trips t
        JOIN zones z1 ON t.PULocationID = z1.LocationID
        JOIN zones z2 ON t.DOLocationID = z2.LocationID
        GROUP BY t.PULocationID, t.DOLocationID
        ORDER BY trip_count DESC
        LIMIT ?
    """
    
    cursor.execute(query, (limit,))
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
            "avg_fare": round(row['avg_fare'], 2)
        })
    
    conn.close()
    
    return jsonify({
        "count": len(routes),
        "routes": routes
    })
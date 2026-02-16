from flask import Blueprint, jsonify, request
from utils.db_connect import get_db_connection, dict_from_row

stats_bp = Blueprint('statistics', __name__)

@stats_bp.route('/api/statistics', methods=['GET'])
def get_statistics():
    """Get aggregate statistics"""
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Basic statistics
    cursor.execute("""
        SELECT 
            COUNT(*) as total_trips,
            AVG(trip_distance) as avg_distance,
            AVG(total_amount) as avg_fare,
            AVG(tip_amount) as avg_tip,
            AVG(passenger_count) as avg_passengers,
            SUM(total_amount) as total_revenue,
            MAX(trip_distance) as max_distance,
            MAX(total_amount) as max_fare
        FROM trips
    """)
    
    stats = dict_from_row(cursor.fetchone())
    
    conn.close()
    
    # Round numbers
    stats = {k: round(v, 2) if v and isinstance(v, float) else v for k, v in stats.items()}
    
    return jsonify(stats)


@stats_bp.route('/api/statistics/by-borough', methods=['GET'])
def get_statistics_by_borough():
    """Get statistics grouped by borough"""
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            z.Borough,
            COUNT(*) as trip_count,
            AVG(t.trip_distance) as avg_distance,
            AVG(t.total_amount) as avg_fare,
            SUM(t.total_amount) as total_revenue
        FROM trips t
        JOIN zones z ON t.PULocationID = z.LocationID
        GROUP BY z.Borough
        ORDER BY trip_count DESC
    """
    
    cursor.execute(query)
    rows = cursor.fetchall()
    
    stats = []
    for row in rows:
        stats.append({
            "borough": row['Borough'],
            "trip_count": row['trip_count'],
            "avg_distance": round(row['avg_distance'], 2),
            "avg_fare": round(row['avg_fare'], 2),
            "total_revenue": round(row['total_revenue'], 2)
        })
    
    conn.close()
    
    return jsonify({"by_borough": stats})


@stats_bp.route('/api/insights', methods=['GET'])
def get_insights():
    """Get pre-calculated insights"""
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    insights = []
    
    # Insight 1: Busiest pickup borough
    cursor.execute("""
        SELECT 
            z.Borough,
            COUNT(*) as trip_count
        FROM trips t
        JOIN zones z ON t.PULocationID = z.LocationID
        GROUP BY z.Borough
        ORDER BY trip_count DESC
        LIMIT 1
    """)
    row = cursor.fetchone()
    if row:
        insights.append({
            "title": "Busiest Pickup Borough",
            "value": row['Borough'],
            "metric": f"{row['trip_count']:,} trips"
        })
    
    # Insight 2: Average trip distance
    cursor.execute("SELECT AVG(trip_distance) as avg_dist FROM trips")
    avg_dist = cursor.fetchone()['avg_dist']
    insights.append({
        "title": "Average Trip Distance",
        "value": f"{avg_dist:.2f} miles",
        "metric": "across all trips"
    })
    
    # Insight 3: Average tip percentage
    cursor.execute("""
        SELECT 
            AVG(tip_amount * 100.0 / NULLIF(fare_amount, 0)) as avg_tip_pct
        FROM trips
        WHERE fare_amount > 0 AND tip_amount > 0
    """)
    avg_tip = cursor.fetchone()['avg_tip_pct']
    if avg_tip:
        insights.append({
            "title": "Average Tip Percentage",
            "value": f"{avg_tip:.1f}%",
            "metric": "of fare amount"
        })
    
    # Insight 4: Most popular payment type
    cursor.execute("""
        SELECT 
            payment_type,
            COUNT(*) as count
        FROM trips
        GROUP BY payment_type
        ORDER BY count DESC
        LIMIT 1
    """)
    payment = cursor.fetchone()
    payment_types = {1: "Credit Card", 2: "Cash", 3: "No Charge", 4: "Dispute"}
    insights.append({
        "title": "Most Popular Payment Method",
        "value": payment_types.get(payment['payment_type'], "Unknown"),
        "metric": f"{payment['count']:,} trips"
    })
    
    conn.close()
    
    return jsonify({"insights": insights})
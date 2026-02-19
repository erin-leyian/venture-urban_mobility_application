from flask import Blueprint, jsonify, request
from utils.db_connect import get_db_connection, dict_from_row

stats_bp = Blueprint('statistics', __name__)

def _r(v, n=2):
    return round(v, n) if isinstance(v, float) else v

DUR = "(julianday(tpep_dropoff_datetime)-julianday(tpep_pickup_datetime))*1440"
SPD = ("CASE WHEN (julianday(tpep_dropoff_datetime)-julianday(tpep_pickup_datetime))*24>0 "
       "THEN trip_distance/((julianday(tpep_dropoff_datetime)-julianday(tpep_pickup_datetime))*24) "
       "ELSE 0 END")
PEAK = ("CASE WHEN CAST(strftime('%H',tpep_pickup_datetime) AS INTEGER) BETWEEN 7 AND 9 "
        "  OR CAST(strftime('%H',tpep_pickup_datetime) AS INTEGER) BETWEEN 16 AND 18 "
        "THEN 1 ELSE 0 END")

def _build_where(base="trip_distance>0"):
    """Build WHERE clause from common query params: date, hour, min_fare, max_fare, min_distance, max_distance, borough."""
    clauses = [base]
    params = []

    date = request.args.get('date')          # e.g. "2019-01-15"
    hour = request.args.get('hour')          # e.g. "18"
    min_fare = request.args.get('min_fare')
    max_fare = request.args.get('max_fare')
    min_dist = request.args.get('min_distance')
    max_dist = request.args.get('max_distance')
    boroughs = request.args.getlist('borough')

    if date:
        clauses.append("strftime('%Y-%m-%d', tpep_pickup_datetime) = ?")
        params.append(date)
    if hour is not None:
        clauses.append("CAST(strftime('%H', tpep_pickup_datetime) AS INTEGER) = ?")
        params.append(int(hour))
    if min_fare:
        clauses.append("total_amount >= ?"); params.append(float(min_fare))
    if max_fare and float(max_fare) < 250:
        clauses.append("total_amount <= ?"); params.append(float(max_fare))
    if min_dist:
        clauses.append("trip_distance >= ?"); params.append(float(min_dist))
    if max_dist and float(max_dist) < 50:
        clauses.append("trip_distance <= ?"); params.append(float(max_dist))
    if boroughs:
        placeholders = ','.join('?' * len(boroughs))
        clauses.append(f"PULocationID IN (SELECT LocationID FROM zones WHERE Borough IN ({placeholders}))")
        params.extend(boroughs)

    return " AND ".join(clauses), params

@stats_bp.route('/api/statistics')
def get_statistics():
    where, params = _build_where(f"trip_distance>0 AND ({DUR}) BETWEEN 1 AND 180")
    conn = get_db_connection(); c = conn.cursor()
    c.execute(f"""
        SELECT COUNT(*) AS total_trips, AVG(trip_distance) AS avg_distance,
               AVG(total_amount) AS avg_fare, AVG(tip_amount) AS avg_tip,
               AVG(passenger_count) AS avg_passengers,
               AVG({DUR}) AS avg_duration_minutes,
               AVG({SPD}) AS avg_speed_mph,
               AVG(CASE WHEN trip_distance>0 THEN fare_amount/trip_distance ELSE NULL END) AS avg_fare_per_mile,
               SUM(total_amount) AS total_revenue
        FROM trips WHERE {where}
    """, params)
    row = dict_from_row(c.fetchone()); conn.close()
    return jsonify({k: _r(v) for k,v in row.items()})

@stats_bp.route('/api/statistics/by-borough')
def get_stats_by_borough():
    where, params = _build_where("t.trip_distance>=0")
    conn = get_db_connection(); c = conn.cursor()
    c.execute(f"""
        SELECT z.Borough AS borough, COUNT(*) AS trip_count,
               AVG(t.trip_distance) AS avg_distance, AVG(t.total_amount) AS avg_fare,
               AVG({DUR}) AS avg_duration, AVG({SPD}) AS avg_speed,
               SUM(t.total_amount) AS total_revenue
        FROM trips t JOIN zones z ON t.PULocationID=z.LocationID
        WHERE {where} GROUP BY z.Borough ORDER BY trip_count DESC
    """, params)
    rows = c.fetchall(); conn.close()
    return jsonify([{"borough":r['borough'],"trip_count":r['trip_count'],
                     "avg_distance":_r(r['avg_distance']),"avg_fare":_r(r['avg_fare']),
                     "avg_duration":_r(r['avg_duration']),"avg_speed":_r(r['avg_speed']),
                     "total_revenue":_r(r['total_revenue'])}
                    for r in rows if r['borough'] and r['borough'] not in ('','Unknown','N/A')])

@stats_bp.route('/api/statistics/peak-hours')
def get_peak_hours():
    where, params = _build_where("trip_distance>=0")
    conn = get_db_connection(); c = conn.cursor()
    c.execute(f"SELECT strftime('%H',tpep_pickup_datetime) AS hour, COUNT(*) AS trip_count "
              f"FROM trips WHERE {where} GROUP BY hour ORDER BY trip_count DESC LIMIT 10", params)
    rows = c.fetchall(); conn.close()
    result = []
    for r in rows:
        h = int(r['hour'])
        label = "12:00 AM" if h==0 else (f"{h}:00 AM" if h<12 else ("12:00 PM" if h==12 else f"{h-12}:00 PM"))
        result.append({"hour":h,"label":label,"trip_count":r['trip_count']})
    return jsonify(result)

@stats_bp.route('/api/statistics/by-zone')
def get_stats_by_zone():
    where, params = _build_where("trip_distance>=0")
    conn = get_db_connection(); c = conn.cursor()
    c.execute(f"SELECT PULocationID AS location_id, COUNT(*) AS trip_count "
              f"FROM trips WHERE {where} GROUP BY PULocationID", params)
    stats = {str(r['location_id']): r['trip_count'] for r in c.fetchall()}
    conn.close(); return jsonify(stats)

@stats_bp.route('/api/statistics/trends')
def get_trip_trends():
    # Trends always show full Jan 2019 daily view; date filter scopes to borough if set
    boroughs = request.args.getlist('borough')
    conn = get_db_connection(); c = conn.cursor()
    if boroughs:
        placeholders = ','.join('?' * len(boroughs))
        c.execute(f"SELECT strftime('%Y-%m-%d',tpep_pickup_datetime) AS date, COUNT(*) AS trips "
                  f"FROM trips WHERE tpep_pickup_datetime LIKE '2019-01%' "
                  f"AND PULocationID IN (SELECT LocationID FROM zones WHERE Borough IN ({placeholders})) "
                  f"GROUP BY date ORDER BY date", boroughs)
    else:
        c.execute("SELECT strftime('%Y-%m-%d',tpep_pickup_datetime) AS date, COUNT(*) AS trips "
                  "FROM trips WHERE tpep_pickup_datetime LIKE '2019-01%' GROUP BY date ORDER BY date")
    trends = [dict_from_row(r) for r in c.fetchall()]; conn.close()
    return jsonify(trends)

@stats_bp.route('/api/statistics/fare-distribution')
def get_fare_distribution():
    where, params = _build_where("total_amount>0")
    conn = get_db_connection(); c = conn.cursor()
    c.execute(f"""
        SELECT CASE WHEN total_amount<10 THEN '$0-10' WHEN total_amount<20 THEN '$10-20'
                    WHEN total_amount<30 THEN '$20-30' WHEN total_amount<40 THEN '$30-40'
                    WHEN total_amount<50 THEN '$40-50' ELSE '$50+' END AS range,
               COUNT(*) AS count FROM trips WHERE {where} GROUP BY range
    """, params)
    dist = [dict_from_row(r) for r in c.fetchall()]; conn.close()
    order = {'$0-10':1,'$10-20':2,'$20-30':3,'$30-40':4,'$40-50':5,'$50+':6}
    dist.sort(key=lambda x: order.get(x['range'],7))
    return jsonify(dist)

@stats_bp.route('/api/statistics/peak-vs-offpeak')
def get_peak_vs_offpeak():
    conn = get_db_connection(); c = conn.cursor()
    c.execute(f"""
        SELECT ({PEAK}) AS is_peak, COUNT(*) AS trip_count,
               AVG(total_amount) AS avg_fare, AVG(trip_distance) AS avg_distance,
               AVG({DUR}) AS avg_duration
        FROM trips WHERE trip_distance>0 GROUP BY is_peak
    """)
    result = {}
    for r in c.fetchall():
        key = "peak_hour" if r['is_peak']==1 else "off_peak"
        result[key] = {"trip_count":r['trip_count'],"avg_fare":_r(r['avg_fare']),
                       "avg_distance":_r(r['avg_distance']),"avg_duration":_r(r['avg_duration'])}
    conn.close(); return jsonify(result)

@stats_bp.route('/api/insights')
def get_insights():
    conn = get_db_connection(); c = conn.cursor()
    insights = []
    c.execute("SELECT z.Borough AS borough, COUNT(*) AS trip_count FROM trips t "
              "JOIN zones z ON t.PULocationID=z.LocationID GROUP BY z.Borough ORDER BY trip_count DESC LIMIT 1")
    r = c.fetchone()
    if r: insights.append({"title":"Busiest Pickup Borough","value":r['borough'],"metric":f"{r['trip_count']:,} trips"})
    c.execute(f"SELECT AVG({SPD}) AS s FROM trips WHERE trip_distance>0")
    s = c.fetchone()['s'] or 0
    insights.append({"title":"Average Trip Speed","value":f"{s:.1f} mph","metric":"across all trips"})
    c.execute(f"SELECT SUM({PEAK}) AS p, COUNT(*) AS t FROM trips")
    r = c.fetchone(); pct = (r['p']/r['t']*100) if r['t'] else 0
    insights.append({"title":"Peak Hour Trips","value":f"{pct:.1f}%","metric":"of all trips during rush hour"})
    c.execute("SELECT AVG(fare_amount/trip_distance) AS f FROM trips WHERE trip_distance>0")
    f = c.fetchone()['f'] or 0
    insights.append({"title":"Average Fare Per Mile","value":f"${f:.2f}","metric":"revenue per mile driven"})
    conn.close(); return jsonify({"insights":insights})

@stats_bp.route('/api/statistics/pickup-time-distribution')
def get_pickup_time_distribution():
    where, params = _build_where("trip_distance>=0")
    conn = get_db_connection(); c = conn.cursor()
    c.execute(f"SELECT strftime('%H',tpep_pickup_datetime) AS hour, COUNT(*) AS trip_count "
              f"FROM trips WHERE {where} GROUP BY hour ORDER BY hour", params)
    stats = [dict_from_row(r) for r in c.fetchall()]; conn.close()
    return jsonify(stats)

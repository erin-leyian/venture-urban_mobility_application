from flask import Flask, jsonify, send_file
from flask_cors import CORS
from routes.trips import trips_bp
from routes.statistics import stats_bp
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

app.register_blueprint(trips_bp)
app.register_blueprint(stats_bp)

GEOJSON_PATH = os.path.join(os.path.dirname(__file__), 'data', 'taxi_zones.geojson')

@app.route('/api/zones/geojson')
def zones_geojson():
    return send_file(GEOJSON_PATH, mimetype='application/json')

@app.route('/')
def home():
    return jsonify({"message": "Urban Mobility API", "status": "running"})

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    print("\nStarting Urban Mobility API...")
    print(" Server: http://localhost:5002")
    app.run(debug=True, use_reloader=False, host="0.0.0.0", port=5002)

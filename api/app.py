from flask import Flask, jsonify
from flask_cors import CORS
from routes.trips import trips_bp
from routes.statistics import stats_bp

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Register blueprints
app.register_blueprint(trips_bp)
app.register_blueprint(stats_bp)

@app.route('/')
def home():
    return jsonify({
        "message": "Urban Mobility API",
        "status": "running",
        "endpoints": [
            "/api/trips",
            "/api/statistics",
            "/api/zones",
            "/api/insights"
        ]
    })

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy"})

if __name__ == '__main__':
    print("\nStarting Urban Mobility API...")
    print(" Server: http://localhost:5000")
    print(" Endpoints: http://localhost:5000/")
    app.run(debug=True, port=5000)
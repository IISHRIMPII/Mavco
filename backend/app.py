"""
app.py - Main Flask application entry point
"""

from flask import Flask
from flask_cors import CORS

from database import init_db
from routes.orders     import orders_bp
from routes.inventory  import inventory_bp
from routes.profit     import profit_bp
from routes.parse_order import parse_order_bp

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from React dev server

# ── Register blueprints ────────────────────────────────────────────────────
app.register_blueprint(orders_bp,      url_prefix="/api")
app.register_blueprint(inventory_bp,   url_prefix="/api")
app.register_blueprint(profit_bp,      url_prefix="/api")
app.register_blueprint(parse_order_bp, url_prefix="/api")


@app.route("/api/health")
def health():
    return {"status": "ok", "message": "Mavco API is running 🥤"}


if __name__ == "__main__":
    init_db()  # Create tables on first run
    app.run(host="0.0.0.0", port=5000, debug=True)

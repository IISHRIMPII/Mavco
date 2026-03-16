"""
app.py - Main Flask application entry point
"""

import os
from flask import Flask
from flask_cors import CORS

from database import init_db
from routes.orders      import orders_bp
from routes.inventory   import inventory_bp
from routes.profit      import profit_bp
from routes.parse_order import parse_order_bp
from routes.drinks      import drinks_bp
from routes.deduction_template import deduction_template_bp

app = Flask(__name__)
CORS(app)

# ── Register blueprints ────────────────────────────────────────────
app.register_blueprint(orders_bp,               url_prefix="/api")
app.register_blueprint(inventory_bp,            url_prefix="/api")
app.register_blueprint(profit_bp,               url_prefix="/api")
app.register_blueprint(parse_order_bp,          url_prefix="/api")
app.register_blueprint(drinks_bp,               url_prefix="/api")
app.register_blueprint(deduction_template_bp,   url_prefix="/api")


@app.route("/api/health")
def health():
    return {"status": "ok", "message": "Mavco API is running 🥤"}


if __name__ == "__main__":
    init_db()  # Create tables on first run
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)

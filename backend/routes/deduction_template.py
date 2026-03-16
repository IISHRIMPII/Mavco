"""
routes/deduction_template.py - Manage the base packaging deduction template
"""

from flask import Blueprint, request, jsonify
from database import get_db

deduction_template_bp = Blueprint("deduction_template", __name__)


# ── GET template ────────────────────────────────────────────────────────────
@deduction_template_bp.route("/deduction_template", methods=["GET"])
def get_template():
    db = get_db()
    rows = db.execute("SELECT * FROM deduction_template ORDER BY id ASC").fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


# ── PUT (full replace) template ─────────────────────────────────────────────
@deduction_template_bp.route("/deduction_template", methods=["PUT"])
def save_template():
    data = request.get_json()
    items = data.get("items", []) if data else []
    if not isinstance(items, list):
        return jsonify({"error": "items must be a list"}), 400

    db = get_db()
    try:
        db.execute("DELETE FROM deduction_template")
        for item in items:
            name   = str(item.get("name", "")).strip()
            amount = float(item.get("amount", 0))
            if name:
                db.execute(
                    "INSERT INTO deduction_template (name, amount) VALUES (?, ?)",
                    (name, amount)
                )
        db.commit()
        rows = db.execute("SELECT * FROM deduction_template ORDER BY id ASC").fetchall()
        db.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({"error": str(e)}), 500

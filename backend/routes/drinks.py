"""
routes/drinks.py - CRUD for drinks and their inventory recipes
"""

from flask import Blueprint, request, jsonify
from database import get_db

drinks_bp = Blueprint("drinks", __name__)


def drink_with_recipe(db, drink_id):
    drink = db.execute("SELECT * FROM drinks WHERE id = ?", (drink_id,)).fetchone()
    if not drink:
        return None
    d = dict(drink)
    rows = db.execute(
        "SELECT inventory_name, amount FROM drink_recipes WHERE drink_id = ? ORDER BY id",
        (drink_id,)
    ).fetchall()
    d["recipe"] = [dict(r) for r in rows]
    return d


# ── GET all drinks ──────────────────────────────────────────────────────────
@drinks_bp.route("/drinks", methods=["GET"])
def get_drinks():
    db = get_db()
    drinks = db.execute("SELECT * FROM drinks ORDER BY name").fetchall()
    result = []
    for d in drinks:
        rows = db.execute(
            "SELECT inventory_name, amount FROM drink_recipes WHERE drink_id = ? ORDER BY id",
            (d["id"],)
        ).fetchall()
        entry = dict(d)
        entry["recipe"] = [dict(r) for r in rows]
        result.append(entry)
    db.close()
    return jsonify(result)


# ── GET single drink ────────────────────────────────────────────────────────
@drinks_bp.route("/drinks/<int:drink_id>", methods=["GET"])
def get_drink(drink_id):
    db = get_db()
    d = drink_with_recipe(db, drink_id)
    db.close()
    if not d:
        return jsonify({"error": "Drink not found"}), 404
    return jsonify(d)


# ── POST create drink ───────────────────────────────────────────────────────
@drinks_bp.route("/drinks", methods=["POST"])
def create_drink():
    data = request.get_json()
    if not data or not data.get("name", "").strip():
        return jsonify({"error": "name is required"}), 400

    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO drinks (name, notes, active) VALUES (?, ?, 1)",
            (data["name"].strip(), data.get("notes", ""))
        )
        drink_id = cur.lastrowid
        _save_recipe(db, drink_id, data.get("recipe", []))
        db.commit()
        result = drink_with_recipe(db, drink_id)
        db.close()
        return jsonify(result), 201
    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({"error": str(e)}), 500


# ── PUT update drink ────────────────────────────────────────────────────────
@drinks_bp.route("/drinks/<int:drink_id>", methods=["PUT"])
def update_drink(drink_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM drinks WHERE id = ?", (drink_id,)).fetchone()
    if not existing:
        db.close()
        return jsonify({"error": "Drink not found"}), 404

    try:
        fields = {}
        if "name"   in data: fields["name"]   = data["name"].strip()
        if "notes"  in data: fields["notes"]  = data["notes"]
        if "active" in data: fields["active"] = 1 if data["active"] else 0

        if fields:
            set_clause = ", ".join(f"{k} = ?" for k in fields)
            db.execute(f"UPDATE drinks SET {set_clause} WHERE id = ?", list(fields.values()) + [drink_id])

        if "recipe" in data:
            db.execute("DELETE FROM drink_recipes WHERE drink_id = ?", (drink_id,))
            _save_recipe(db, drink_id, data["recipe"])

        db.commit()
        result = drink_with_recipe(db, drink_id)
        db.close()
        return jsonify(result)
    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({"error": str(e)}), 500


# ── DELETE drink ────────────────────────────────────────────────────────────
@drinks_bp.route("/drinks/<int:drink_id>", methods=["DELETE"])
def delete_drink(drink_id):
    db = get_db()
    existing = db.execute("SELECT id FROM drinks WHERE id = ?", (drink_id,)).fetchone()
    if not existing:
        db.close()
        return jsonify({"error": "Drink not found"}), 404
    db.execute("DELETE FROM drinks WHERE id = ?", (drink_id,))
    db.commit()
    db.close()
    return jsonify({"message": f"Drink {drink_id} deleted."})


# ── Helper ──────────────────────────────────────────────────────────────────
def _save_recipe(db, drink_id, recipe):
    for item in recipe:
        name   = str(item.get("inventory_name", "")).strip()
        amount = float(item.get("amount", 0))
        if name and amount > 0:
            db.execute(
                "INSERT INTO drink_recipes (drink_id, inventory_name, amount) VALUES (?, ?, ?)",
                (drink_id, name, amount)
            )

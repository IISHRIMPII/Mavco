"""
routes/inventory.py - CRUD endpoints for inventory items
"""

from flask import Blueprint, request, jsonify
from database import get_db

inventory_bp = Blueprint("inventory", __name__)


# ── GET all inventory ───────────────────────────────────────────────────────
@inventory_bp.route("/inventory", methods=["GET"])
def get_inventory():
    db = get_db()
    category = request.args.get("category", "").strip()
    if category and category.lower() not in ("all", ""):
        rows = db.execute(
            "SELECT * FROM inventory WHERE category = ? ORDER BY name ASC",
            (category,)
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM inventory ORDER BY category ASC, name ASC").fetchall()
    db.close()
    items = [dict(r) for r in rows]
    # Tag low-stock items
    for item in items:
        item["is_low_stock"] = item["quantity"] <= item["low_stock_threshold"]
    return jsonify(items)


# ── GET single inventory item ───────────────────────────────────────────────
@inventory_bp.route("/inventory/<int:item_id>", methods=["GET"])
def get_inventory_item(item_id):
    db = get_db()
    row = db.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone()
    db.close()
    if not row:
        return jsonify({"error": "Item not found"}), 404
    item = dict(row)
    item["is_low_stock"] = item["quantity"] <= item["low_stock_threshold"]
    return jsonify(item)


# ── POST add inventory item ─────────────────────────────────────────────────
@inventory_bp.route("/inventory", methods=["POST"])
def add_inventory_item():
    data = request.get_json()
    if not data or "name" not in data:
        return jsonify({"error": "name is required"}), 400

    db = get_db()
    try:
        cursor = db.execute("""
            INSERT INTO inventory (name, quantity, unit, cost_per_unit, low_stock_threshold, category)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            data["name"],
            float(data.get("quantity", 0)),
            data.get("unit", "pcs"),
            float(data.get("cost_per_unit", 0)),
            float(data.get("low_stock_threshold", 10)),
            data.get("category", "Other"),
        ))
        db.commit()
        row = db.execute("SELECT * FROM inventory WHERE id = ?", (cursor.lastrowid,)).fetchone()
        db.close()
        return jsonify(dict(row)), 201
    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({"error": str(e)}), 500


# ── PUT update inventory item ───────────────────────────────────────────────
@inventory_bp.route("/inventory/<int:item_id>", methods=["PUT"])
def update_inventory_item(item_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM inventory WHERE id = ?", (item_id,)).fetchone()
    if not existing:
        db.close()
        return jsonify({"error": "Item not found"}), 404

    allowed = ["name", "quantity", "unit", "cost_per_unit", "low_stock_threshold", "category"]
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        db.close()
        return jsonify({"error": "No valid fields to update"}), 400

    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [item_id]
    db.execute(f"UPDATE inventory SET {set_clause} WHERE id = ?", values)
    db.commit()
    updated = db.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone()
    db.close()
    item = dict(updated)
    item["is_low_stock"] = item["quantity"] <= item["low_stock_threshold"]
    return jsonify(item)


# ── PATCH add stock (restock) ───────────────────────────────────────────────
@inventory_bp.route("/inventory/<int:item_id>/restock", methods=["PATCH"])
def restock(item_id):
    data = request.get_json()
    amount = float(data.get("amount", 0)) if data else 0
    if amount <= 0:
        return jsonify({"error": "amount must be > 0"}), 400

    db = get_db()
    existing = db.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone()
    if not existing:
        db.close()
        return jsonify({"error": "Item not found"}), 404

    db.execute("UPDATE inventory SET quantity = quantity + ? WHERE id = ?", (amount, item_id))
    db.commit()
    updated = db.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone()
    db.close()
    item = dict(updated)
    item["is_low_stock"] = item["quantity"] <= item["low_stock_threshold"]
    return jsonify(item)


# ── POST batch deduct (called when order → Preparing) ──────────────────────
@inventory_bp.route("/inventory/deduct", methods=["POST"])
def deduct_inventory():
    """
    Body: { "items": [{"name": "Oat Milk", "amount": 1}, ...] }
    Deducts each named item by the given amount (floors at 0).
    Returns list of {name, old_qty, new_qty, is_low_stock}.
    """
    data = request.get_json()
    items = data.get("items", []) if data else []
    if not items:
        return jsonify({"error": "items list is required"}), 400

    db = get_db()
    results = []
    not_found = []

    for entry in items:
        name   = entry.get("name", "").strip()
        amount = float(entry.get("amount", 0))
        if not name or amount <= 0:
            continue
        row = db.execute("SELECT * FROM inventory WHERE name = ?", (name,)).fetchone()
        if not row:
            not_found.append(name)
            continue
        old_qty = row["quantity"]
        new_qty = max(0, old_qty - amount)
        db.execute("UPDATE inventory SET quantity = ? WHERE id = ?", (new_qty, row["id"]))
        results.append({
            "name":         name,
            "old_qty":      old_qty,
            "new_qty":      new_qty,
            "is_low_stock": new_qty <= row["low_stock_threshold"],
        })

    db.commit()
    db.close()
    return jsonify({"deducted": results, "not_found": not_found})


# ── DELETE inventory item ───────────────────────────────────────────────────
@inventory_bp.route("/inventory/<int:item_id>", methods=["DELETE"])
def delete_inventory_item(item_id):
    db = get_db()
    existing = db.execute("SELECT id FROM inventory WHERE id = ?", (item_id,)).fetchone()
    if not existing:
        db.close()
        return jsonify({"error": "Item not found"}), 404
    db.execute("DELETE FROM inventory WHERE id = ?", (item_id,))
    db.commit()
    db.close()
    return jsonify({"message": f"Item {item_id} deleted."})

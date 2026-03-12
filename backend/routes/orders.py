"""
routes/orders.py - CRUD endpoints for orders + inventory deduction
"""

from flask import Blueprint, request, jsonify
from database import get_db
from datetime import datetime

orders_bp = Blueprint("orders", __name__)


def row_to_dict(row):
    return dict(row) if row else None


def _next_order_id(db):
    """Return the smallest positive integer not already used as an order ID."""
    rows = db.execute("SELECT id FROM orders ORDER BY id").fetchall()
    existing = {row[0] for row in rows}
    candidate = 1
    while candidate in existing:
        candidate += 1
    return candidate


# ── GET all orders ──────────────────────────────────────────────────────────
@orders_bp.route("/orders", methods=["GET"])
def get_orders():
    status = request.args.get("status")
    db = get_db()
    order_clause = """
        ORDER BY
            CASE WHEN delivery_time IS NULL OR delivery_time = '' THEN 1 ELSE 0 END,
            delivery_time ASC
    """
    if status:
        rows = db.execute(
            f"SELECT * FROM orders WHERE status = ? {order_clause}", (status,)
        ).fetchall()
    else:
        rows = db.execute(
            f"SELECT * FROM orders {order_clause}"
        ).fetchall()
    db.close()
    return jsonify([dict(r) for r in rows])


# ── GET single order ────────────────────────────────────────────────────────
@orders_bp.route("/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    db = get_db()
    row = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not row:
        db.close()
        return jsonify({"error": "Order not found"}), 404
    order = dict(row)
    # Attach items
    items = db.execute(
        "SELECT * FROM order_items WHERE order_id = ?", (order_id,)
    ).fetchall()
    order["items"] = [dict(i) for i in items]
    db.close()
    return jsonify(order)


# ── POST create order ───────────────────────────────────────────────────────
@orders_bp.route("/orders", methods=["POST"])
def create_order():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["customer_name", "price"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    # Compute ingredient cost from order_items if provided
    items = data.get("items", [])  # [{"inventory_id": 1, "quantity_used": 2}, ...]
    total_cost = 0.0

    db = get_db()
    try:
        # Deduct inventory and calculate cost
        for item in items:
            inv = db.execute(
                "SELECT * FROM inventory WHERE id = ?", (item["inventory_id"],)
            ).fetchone()
            if not inv:
                return jsonify({"error": f"Inventory item {item['inventory_id']} not found"}), 404
            qty_used = float(item.get("quantity_used", 1))
            if inv["quantity"] < qty_used:
                return jsonify({
                    "error": f"Insufficient stock for '{inv['name']}'. Available: {inv['quantity']} {inv['unit']}"
                }), 400
            # Deduct stock
            db.execute(
                "UPDATE inventory SET quantity = quantity - ? WHERE id = ?",
                (qty_used, item["inventory_id"])
            )
            total_cost += qty_used * inv["cost_per_unit"]
            item["item_name"] = inv["name"]

        # If cost was explicitly passed, use it; otherwise use computed cost
        cost = float(data.get("cost", total_cost))
        price = float(data["price"])

        cursor = db.execute("""
            INSERT INTO orders
              (id, customer_name, phone, location, delivery_time, milk_type, pot,
               delivery_paid, notes, status, price, cost, drink_name, drink_id,
               created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))
        """, (
            _next_order_id(db),
            data.get("customer_name"),
            data.get("phone", ""),
            data.get("location", ""),
            data.get("delivery_time", ""),
            data.get("milk_type", ""),
            data.get("pot", "Plastic"),
            1 if data.get("delivery_paid") else 0,
            data.get("notes", ""),
            data.get("status", "New"),
            price,
            cost,
            data.get("drink_name", ""),
            data.get("drink_id") or None,
        ))
        order_id = cursor.lastrowid

        # Insert order items
        for item in items:
            db.execute("""
                INSERT INTO order_items (order_id, inventory_id, quantity_used, item_name)
                VALUES (?,?,?,?)
            """, (order_id, item["inventory_id"], item.get("quantity_used", 1), item.get("item_name", "")))

        db.commit()
        order = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        db.close()
        return jsonify(dict(order)), 201

    except Exception as e:
        db.rollback()
        db.close()
        return jsonify({"error": str(e)}), 500


# ── PUT update order ────────────────────────────────────────────────────────
@orders_bp.route("/orders/<int:order_id>", methods=["PUT"])
def update_order(order_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    db = get_db()
    existing = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        db.close()
        return jsonify({"error": "Order not found"}), 404

    # Build dynamic UPDATE
    allowed_fields = [
        "customer_name", "phone", "location", "delivery_time",
        "milk_type", "pot", "delivery_paid", "notes", "status", "price", "cost",
        "drink_name", "drink_id"
    ]
    updates = {k: v for k, v in data.items() if k in allowed_fields}
    if not updates:
        db.close()
        return jsonify({"error": "No valid fields to update"}), 400

    updates["updated_at"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [order_id]

    db.execute(f"UPDATE orders SET {set_clause} WHERE id = ?", values)
    db.commit()
    updated = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    db.close()
    return jsonify(dict(updated))


# ── DELETE order ────────────────────────────────────────────────────────────
@orders_bp.route("/orders/<int:order_id>", methods=["DELETE"])
def delete_order(order_id):
    db = get_db()
    existing = db.execute("SELECT id FROM orders WHERE id = ?", (order_id,)).fetchone()
    if not existing:
        db.close()
        return jsonify({"error": "Order not found"}), 404
    db.execute("DELETE FROM orders WHERE id = ?", (order_id,))
    db.commit()
    db.close()
    return jsonify({"message": f"Order {order_id} deleted."})


# ── POST reset all orders ───────────────────────────────────────────────────
@orders_bp.route("/orders/reset", methods=["POST"])
def reset_orders():
    db = get_db()
    db.execute("DELETE FROM order_items")
    db.execute("DELETE FROM orders")
    # Reset SQLite auto-increment counter
    db.execute("DELETE FROM sqlite_sequence WHERE name = 'orders'")
    db.commit()
    db.close()
    return jsonify({"message": "All orders deleted and counter reset."})

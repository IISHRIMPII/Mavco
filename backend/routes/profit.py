"""
routes/profit.py - Revenue, cost and profit analytics endpoint
"""

from flask import Blueprint, request, jsonify
from database import get_db

profit_bp = Blueprint("profit", __name__)


@profit_bp.route("/profit", methods=["GET"])
def get_profit():
    """
    Returns aggregated revenue / cost / profit.
    Optional query params:
      ?date=YYYY-MM-DD   → filter by single day
      ?period=today|week|month|all  (default: all)
    """
    db = get_db()
    date   = request.args.get("date")
    period = request.args.get("period", "all")

    base = """
        SELECT
            COUNT(*)            AS total_orders,
            SUM(price)          AS total_revenue,
            SUM(cost)           AS total_cost,
            SUM(price - cost)   AS total_profit
        FROM orders
        WHERE status != 'Cancelled'
    """

    params = []
    if date:
        base += " AND DATE(created_at) = ?"
        params.append(date)
    elif period == "today":
        base += " AND DATE(created_at) = DATE('now')"
    elif period == "week":
        base += " AND DATE(created_at) >= DATE('now', '-7 days')"
    elif period == "month":
        base += " AND DATE(created_at) >= DATE('now', '-30 days')"

    row = db.execute(base, params).fetchone()

    # Per-status breakdown
    statuses = ["New", "Preparing", "Ready", "Delivered"]
    breakdown = {}
    for s in statuses:
        r = db.execute(
            "SELECT COUNT(*) as cnt FROM orders WHERE status = ?", (s,)
        ).fetchone()
        breakdown[s] = r["cnt"]

    # Daily chart data (last 7 days)
    daily = db.execute("""
        SELECT
            DATE(created_at) AS day,
            SUM(price)        AS revenue,
            SUM(cost)         AS cost,
            SUM(price - cost) AS profit,
            COUNT(*)          AS orders
        FROM orders
        WHERE status != 'Cancelled'
          AND DATE(created_at) >= DATE('now', '-7 days')
        GROUP BY day
        ORDER BY day ASC
    """).fetchall()

    db.close()

    return jsonify({
        "total_orders":   row["total_orders"]  or 0,
        "total_revenue":  round(row["total_revenue"] or 0, 2),
        "total_cost":     round(row["total_cost"]    or 0, 2),
        "total_profit":   round(row["total_profit"]  or 0, 2),
        "by_status":      breakdown,
        "daily_chart":    [dict(d) for d in daily],
    })

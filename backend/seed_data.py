"""
seed_data.py - Populate database with REAL Mavco inventory and sample orders.
Run: python seed_data.py
To RESET the database: delete mavco.db first, then run again.
"""

from database import get_db, init_db

# ── Packaging & Materials ───────────────────────────────────────────────────
# "Package = N orders" means 1 pack covers N orders.
# low_stock_threshold is set to 1 pack's worth so you're alerted before running out.

INVENTORY = [
    # ── Product containers ──────────────────────────────────────────────────
    {"name": "1L Bottle",           "quantity": 24,  "unit": "pcs", "cost_per_unit": 2.00,  "low_stock_threshold": 12,  "category": "Containers"},   # pkg=12 orders
    {"name": "Foam 500ml Bottle",   "quantity": 24,  "unit": "pcs", "cost_per_unit": 1.50,  "low_stock_threshold": 12,  "category": "Containers"},   # pkg=12 orders
    {"name": "Pots Plastic",        "quantity": 30,  "unit": "pcs", "cost_per_unit": 1.20,  "low_stock_threshold": 10,  "category": "Containers"},   # for Vanilla milk
    {"name": "Pots Glass",          "quantity": 20,  "unit": "pcs", "cost_per_unit": 2.50,  "low_stock_threshold": 10,  "category": "Containers"},   # for Coconut milk

    # ── Add-ons / accessories ───────────────────────────────────────────────
    {"name": "Wooden Spoons",       "quantity": 100, "unit": "pcs", "cost_per_unit": 0.30,  "low_stock_threshold": 50,  "category": "Accessories"},  # pkg=50 orders
    {"name": "Cups",                "quantity": 35,  "unit": "pcs", "cost_per_unit": 0.50,  "low_stock_threshold": 7,   "category": "Accessories"},  # pkg=7 orders
    {"name": "Straws",              "quantity": 48,  "unit": "pcs", "cost_per_unit": 0.20,  "low_stock_threshold": 24,  "category": "Accessories"},  # pkg=24 orders
    {"name": "Pags (Bags)",         "quantity": 24,  "unit": "pcs", "cost_per_unit": 0.80,  "low_stock_threshold": 12,  "category": "Accessories"},  # pkg=12 orders

    # ── Stickers ────────────────────────────────────────────────────────────
    {"name": "Cups Sticker",        "quantity": 175, "unit": "pcs", "cost_per_unit": 0.15,  "low_stock_threshold": 35,  "category": "Stickers"},     # page=35, 5 orders/page
    {"name": "Foam Sticker",        "quantity": 105, "unit": "pcs", "cost_per_unit": 0.15,  "low_stock_threshold": 35,  "category": "Stickers"},     # page=35, 35 orders/page
    {"name": "1L Bottle Sticker",   "quantity": 48,  "unit": "pcs", "cost_per_unit": 0.20,  "low_stock_threshold": 24,  "category": "Stickers"},     # page=24, 24 orders/page
    {"name": "Givaway Sticker",     "quantity": 16,  "unit": "pcs", "cost_per_unit": 0.50,  "low_stock_threshold": 4,   "category": "Stickers"},     # A4/4, 4 orders/page
    {"name": "Packaging Sticker",   "quantity": 36,  "unit": "pcs", "cost_per_unit": 0.25,  "low_stock_threshold": 12,  "category": "Stickers"},     # L6×W5, 12 orders/page

    # ── Core ingredients ────────────────────────────────────────────────────
    {"name": "Matcha Powder",       "quantity": 500, "unit": "g",   "cost_per_unit": 0.18,  "low_stock_threshold": 100, "category": "Ingredients"},
    {"name": "Dream Web Mix",       "quantity": 300, "unit": "g",   "cost_per_unit": 0.20,  "low_stock_threshold": 60,  "category": "Ingredients"},
    {"name": "Normal Milk",         "quantity": 20,  "unit": "L",   "cost_per_unit": 4.00,  "low_stock_threshold": 5,   "category": "Ingredients"},
    {"name": "Vanilla Milk",        "quantity": 10,  "unit": "L",   "cost_per_unit": 5.50,  "low_stock_threshold": 3,   "category": "Ingredients"},
    {"name": "Coconut Milk",        "quantity": 8,   "unit": "L",   "cost_per_unit": 6.00,  "low_stock_threshold": 3,   "category": "Ingredients"},
    {"name": "Vanilla Soy Milk",    "quantity": 6,   "unit": "L",   "cost_per_unit": 7.50,  "low_stock_threshold": 2,   "category": "Ingredients"},
    {"name": "Oat Milk",            "quantity": 8,   "unit": "L",   "cost_per_unit": 8.00,  "low_stock_threshold": 2,   "category": "Ingredients"},
    {"name": "Almond Milk",         "quantity": 6,   "unit": "L",   "cost_per_unit": 9.50,  "low_stock_threshold": 2,   "category": "Ingredients"},
    {"name": "Coconut Water",       "quantity": 12,  "unit": "L",   "cost_per_unit": 5.00,  "low_stock_threshold": 3,   "category": "Ingredients"},
    {"name": "Water",               "quantity": 50,  "unit": "L",   "cost_per_unit": 0.50,  "low_stock_threshold": 10,  "category": "Ingredients"},
]

# No sample orders – start fresh
ORDERS = []


def seed():
    init_db()
    db = get_db()

    # Only seed if empty
    existing_inv = db.execute("SELECT COUNT(*) as c FROM inventory").fetchone()["c"]
    if existing_inv == 0:
        for item in INVENTORY:
            db.execute("""
                INSERT INTO inventory (name, quantity, unit, cost_per_unit, low_stock_threshold, category)
                VALUES (:name, :quantity, :unit, :cost_per_unit, :low_stock_threshold, :category)
            """, item)
        print(f"[Seed] Inserted {len(INVENTORY)} inventory items.")
    else:
        print("[Seed] Inventory already populated, skipping.")

    existing_ord = db.execute("SELECT COUNT(*) as c FROM orders").fetchone()["c"]
    if existing_ord == 0:
        for order in ORDERS:
            db.execute("""
                INSERT INTO orders
                  (customer_name, phone, location, delivery_time, milk_type, pot,
                   delivery_paid, notes, status, price, cost)
                VALUES (:customer_name, :phone, :location, :delivery_time, :milk_type,
                        :pot, :delivery_paid, :notes, :status, :price, :cost)
            """, order)
        print(f"[Seed] Inserted {len(ORDERS)} orders.")
    else:
        print("[Seed] Orders already populated, skipping.")

    db.commit()
    db.close()
    print("[Seed] Done! ✓")


if __name__ == "__main__":
    seed()

"""
database.py - SQLite database initialization and connection management
"""

import sqlite3
import os

# Path to SQLite database file
# On Railway: set DB_PATH env var to /data/mavco.db (persistent Volume mount)
# Locally: defaults to the backend folder
DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "mavco.db"))


def get_db():
    """Open a new database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Rows behave like dicts
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    """Create all tables if they don't already exist."""
    conn = get_db()
    cursor = conn.cursor()

    # ── Inventory ──────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS inventory (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL UNIQUE,
            quantity      REAL    NOT NULL DEFAULT 0,
            unit          TEXT    NOT NULL DEFAULT 'pcs',
            cost_per_unit REAL    NOT NULL DEFAULT 0,
            low_stock_threshold REAL NOT NULL DEFAULT 10,
            category      TEXT    NOT NULL DEFAULT 'Other',
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # ── Orders ─────────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name  TEXT    NOT NULL,
            phone          TEXT,
            location       TEXT,
            delivery_time  TEXT,
            milk_type      TEXT    DEFAULT 'Full Cream',
            pot            TEXT    DEFAULT 'Regular',
            delivery_paid  INTEGER DEFAULT 0,
            notes          TEXT,
            status         TEXT    NOT NULL DEFAULT 'New',
            price          REAL    NOT NULL DEFAULT 0,
            cost           REAL    NOT NULL DEFAULT 0,
            profit         REAL    GENERATED ALWAYS AS (price - cost) STORED,
            created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # ── Drinks ──────────────────────────────────────────────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS drinks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL UNIQUE,
            notes       TEXT    DEFAULT '',
            active      INTEGER DEFAULT 1,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # ── Drink Recipes (each row = one ingredient for one drink) ────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS drink_recipes (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            drink_id       INTEGER NOT NULL REFERENCES drinks(id) ON DELETE CASCADE,
            inventory_name TEXT    NOT NULL,
            amount         REAL    NOT NULL DEFAULT 1
        )
    """)

    # ── Order Items (optional recipe-based deduction) ──────────────────────
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            inventory_id INTEGER NOT NULL REFERENCES inventory(id),
            quantity_used REAL   NOT NULL DEFAULT 1,
            item_name    TEXT    NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS deduction_template (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            name    TEXT    NOT NULL,
            amount  REAL    NOT NULL DEFAULT 1
        )
    """)

    conn.commit()
    conn.close()
    print("[DB] Tables initialized.")

    # ── Seed deduction template (base packaging items) ─────────────────────
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM deduction_template").fetchone()[0]
    if count == 0:
        default_items = [
            ("1L Bottle",         1),
            ("Foam 500ml Bottle",  1),
            ("Cups",               7),
            ("Pags (Bags)",        1),
            ("Straws",             7),
            ("Wooden Spoons",      1),
            ("1L Bottle Sticker",  1),
            ("Cups Sticker",       7),
            ("Foam Sticker",       1),
            ("Givaway Sticker",    1),
            ("Packaging Sticker",  1),
        ]
        for name, amount in default_items:
            conn.execute(
                "INSERT INTO deduction_template (name, amount) VALUES (?, ?)",
                (name, amount)
            )
        conn.commit()
    conn.close()

    # ── Migrations: add columns to existing tables safely ─────────────────
    conn = get_db()
    for sql in [
        "ALTER TABLE orders ADD COLUMN drink_name TEXT DEFAULT ''",
        "ALTER TABLE orders ADD COLUMN drink_id   INTEGER DEFAULT NULL",
        "ALTER TABLE inventory ADD COLUMN archived INTEGER NOT NULL DEFAULT 0",
    ]:
        try:
            conn.execute(sql)
            conn.commit()
        except Exception:
            pass  # Column already exists
    conn.close()

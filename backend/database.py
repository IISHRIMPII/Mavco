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

    conn.commit()
    conn.close()
    print("[DB] Tables initialized.")

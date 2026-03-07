"""
migrate_categories.py - Add and populate the 'category' column on existing DB.
Run: python migrate_categories.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from database import get_db

db = get_db()

# 1. Add column (safe – skips if already exists)
try:
    db.execute("ALTER TABLE inventory ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'")
    db.commit()
    print("[Migration] 'category' column added.")
except Exception as e:
    print(f"[Migration] Column already exists or skipped: {e}")

# 2. Assign categories
CATEGORY_MAP = {
    "Containers": ["1L Bottle", "Foam 500ml Bottle", "Pots Plastic", "Pots Glass"],
    "Accessories": ["Wooden Spoons", "Cups", "Straws", "Pags (Bags)"],
    "Stickers": ["Cups Sticker", "Foam Sticker", "1L Bottle Sticker", "Givaway Sticker", "Packaging Sticker"],
    "Ingredients": [
        "Matcha Powder", "Dream Web Mix", "Normal Milk", "Vanilla Milk",
        "Coconut Milk", "Vanilla Soy Milk", "Oat Milk", "Almond Milk",
        "Coconut Water", "Water",
    ],
}

for cat, names in CATEGORY_MAP.items():
    for name in names:
        db.execute("UPDATE inventory SET category = ? WHERE name = ?", (cat, name))

db.commit()

# 3. Verify
rows = db.execute("SELECT name, category FROM inventory ORDER BY category, name").fetchall()
print(f"\n{'Category':<15} Item")
print("-" * 40)
for r in rows:
    print(f"{r['category']:<15} {r['name']}")

db.close()
print(f"\n[Migration] Done! {len(rows)} items updated.")

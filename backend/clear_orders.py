from database import get_db
db = get_db()
db.execute("DELETE FROM order_items")
db.execute("DELETE FROM orders")
db.execute("DELETE FROM sqlite_sequence WHERE name='orders'")
db.commit()
count = db.execute("SELECT COUNT(*) as c FROM orders").fetchone()["c"]
print(f"Orders remaining: {count}")
db.close()
print("Done — orders table is empty.")

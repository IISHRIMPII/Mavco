"""
routes/parse_order.py - Parse WhatsApp-style text messages into order fields
"""

import re
from flask import Blueprint, request, jsonify

parse_order_bp = Blueprint("parse_order", __name__)

# ── Mapping helpers ─────────────────────────────────────────────────────────
MILK_KEYWORDS = {
    "coconut water": "Coconut Water",   # must be before "coconut"
    "vanilla soy":   "Vanilla Soy",     # must be before "vanilla"
    "vanilla":       "Vanilla",
    "coconut":       "Coconut",
    "normal":        "Normal",
    "oat":           "Oat",
    "almond":        "Almond",
    "full cream":    "Normal",           # fallback alias
    "full":          "Normal",
    "skim":          "Normal",
}

POT_KEYWORDS = {
    "plastic": "Plastic",
    "glass":   "Glass",
}

STATUS_KEYWORDS = {
    "new":       "New",
    "preparing": "Preparing",
    "ready":     "Ready",
    "delivered": "Delivered",
}


def extract_field(text, patterns):
    """Try multiple regex patterns, return first match or None."""
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return None


@parse_order_bp.route("/parse_order", methods=["POST"])
def parse_order():
    """
    Accepts raw WhatsApp-style text and extracts order fields.
    Example input:
        Name: Sarah
        Phone: 050-1234567
        Location: Dubai Marina
        Delivery: 3pm
        Milk: Oat
        Pot: Large
        Price: 85
        Notes: extra cold please
    """
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "text field is required"}), 400

    raw = data["text"]
    result = {}

    # ── Customer Name ──────────────────────────────────────────────────────
    name = extract_field(raw, [
        r"(?:name|customer|اسم)[:\s]+([^\n\r,]+)",
        r"^([A-Za-z\u0600-\u06FF ]{2,30})$",
    ])
    result["customer_name"] = name or ""

    # ── Phone ──────────────────────────────────────────────────────────────
    phone = extract_field(raw, [
        r"(?:phone|mobile|tel|رقم|هاتف)[:\s]+([\d\s\-\+]{7,15})",
        r"(\+?\d[\d\s\-]{7,14}\d)",
    ])
    result["phone"] = phone.replace(" ", "") if phone else ""

    # ── Location ───────────────────────────────────────────────────────────
    location = extract_field(raw, [
        r"(?:location|address|area|deliver to|منطقة|عنوان)[:\s]+([^\n\r]+)",
    ])
    result["location"] = location or ""

    # ── Delivery Time ──────────────────────────────────────────────────────
    delivery = extract_field(raw, [
        r"(?:delivery|time|deliver|وقت)[:\s]+([^\n\r]+)",
        r"(\d{1,2}(?::\d{2})?\s*(?:am|pm))",
    ])
    result["delivery_time"] = delivery or ""

    # ── Milk Type ──────────────────────────────────────────────────────────
    milk_raw = extract_field(raw, [
        r"(?:milk|حليب)[:\s]+([^\n\r]+)",
    ])
    milk = "Normal"
    if milk_raw:
        for kw, val in MILK_KEYWORDS.items():
            if kw in milk_raw.lower():
                milk = val
                break
    result["milk_type"] = milk

    # ── Pot / Container ───────────────────────────────────────────────────
    pot_raw = extract_field(raw, [
        r"(?:pot|container|material|كمية)[:\s]+([^\n\r]+)",
    ])
    pot = "Plastic"
    if pot_raw:
        for kw, val in POT_KEYWORDS.items():
            if kw in pot_raw.lower():
                pot = val
                break
    result["pot"] = pot

    # ── Price ──────────────────────────────────────────────────────────────
    price_raw = extract_field(raw, [
        r"(?:price|total|amount|سعر|إجمالي)[:\s]*([\d.]+)",
        r"(?:OMR|omr|dhs?)\s*([\d.]+)",
        r"([\d.]+)\s*(?:OMR|omr|dhs?)",
    ])
    result["price"] = float(price_raw) if price_raw else 0

    # ── Delivery Paid ──────────────────────────────────────────────────────
    delivery_paid = bool(re.search(
        r"delivery\s*paid|paid\s*delivery|توصيل مدفوع", raw, re.IGNORECASE
    ))
    result["delivery_paid"] = delivery_paid

    # ── Notes ──────────────────────────────────────────────────────────────
    notes = extract_field(raw, [
        r"(?:notes?|note|ملاحظات?)[:\s]+([^\n\r]+)",
    ])
    result["notes"] = notes or ""

    # ── Status ─────────────────────────────────────────────────────────────
    result["status"] = "New"

    result["raw_text"] = raw
    return jsonify(result)

// src/components/OrderSticker.js  — Printable sticker layout
import React, { useRef } from "react";

export default function OrderSticker({ order, onClose }) {
  const stickerRef = useRef(null);

  const handlePrint = () => {
    const content = stickerRef.current.innerHTML;
    const win = window.open("", "_blank", "width=400,height=500");
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order #${order.id} Sticker</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; }
            .sticker {
              width: 90mm; min-height: 60mm; padding: 6mm;
              border: 2px solid #000; border-radius: 4mm;
              font-size: 11pt; page-break-inside: avoid;
              display: flex; flex-direction: column; gap: 3mm;
            }
            .sticker-brand { text-align: center; font-size: 16pt; font-weight: 700; letter-spacing: 2px; }
            .sticker-id { text-align: center; font-size: 10pt; color: #555; }
            hr { border: none; border-top: 1px dashed #000; }
            .row { display: flex; justify-content: space-between; gap: 4mm; }
            .row strong { flex-shrink: 0; }
            .sticker-footer { text-align: center; font-size: 9pt; color: #777; margin-top: 2mm; }
            .big { font-size: 13pt; font-weight: bold; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const fmt = (dt) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleString("en-AE", { dateStyle: "short", timeStyle: "short" }); }
    catch { return dt; }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🖨 Order Sticker</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Preview */}
        <div className="sticker-preview">
          <div ref={stickerRef} className="sticker">
            <div className="sticker-brand">🥤 MAVCO</div>
            <div className="sticker-id">Order #{order.id} · {fmt(order.created_at)}</div>
            <hr />
            <div className="row big"><strong>Name:</strong> <span>{order.customer_name}</span></div>
            {order.phone    && <div className="row"><strong>Phone:</strong>    <span>{order.phone}</span></div>}
            {order.location && <div className="row"><strong>Address:</strong>  <span>{order.location}</span></div>}
            {order.delivery_time && <div className="row"><strong>Delivery:</strong> <span>{order.delivery_time}</span></div>}
            <hr />
            <div className="row"><strong>Milk:</strong>   <span>{order.milk_type}</span></div>
            <div className="row"><strong>Pot:</strong>    <span>{order.pot}</span></div>
            <div className="row"><strong>Price:</strong>  <span>OMR {Number(order.price).toFixed(2)}</span></div>
            <div className="row"><strong>Delivery:</strong> <span>{order.delivery_paid ? "✓ Paid" : "Collect"}</span></div>
            {order.notes && (
              <>
                <hr />
                <div className="row"><strong>Notes:</strong> <span>{order.notes}</span></div>
              </>
            )}
            <div className="sticker-footer">Mavco Beverage Box · {new Date().getFullYear()}</div>
          </div>
        </div>

        <div className="form-actions" style={{ marginTop: "1rem" }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handlePrint}>🖨 Print Sticker</button>
        </div>
      </div>
    </div>
  );
}

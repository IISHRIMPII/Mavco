// src/components/OrderSticker.js  — Thermal label sticker (48mm wide, We Print compatible)
import React, { useRef } from "react";
import html2canvas from "html2canvas";

export default function OrderSticker({ order, onClose }) {
  const stickerRef = useRef(null);

  const fmt = (dt) => {
    if (!dt) return "—";
    try { return new Date(dt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }); }
    catch { return dt; }
  };

  // Save as PNG — user then opens in We Print app
  const handleSaveImage = async () => {
    const el = stickerRef.current;
    const canvas = await html2canvas(el, {
      scale: 4,           // high-res for thermal clarity
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const link = document.createElement("a");
    link.download = `mavco-order-${order.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Browser print fallback (works on desktop)
  const handlePrint = () => {
    const content = stickerRef.current.innerHTML;
    const win = window.open("", "_blank", "width=250,height=600");
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>Order #${order.id}</title>
        <style>
          @page { size: 48mm auto; margin: 0; }
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: Arial, Helvetica, sans-serif; background:#fff; width:48mm; }
          .sticker { width:48mm; padding:3mm 3.5mm; font-size:8pt; }
          .brand { text-align:center; font-size:13pt; font-weight:900; letter-spacing:1px; margin-bottom:2mm; }
          .order-id { text-align:center; font-size:7pt; color:#555; margin-bottom:2mm; }
          hr { border:none; border-top:1px dashed #999; margin:2mm 0; }
          .row { display:flex; justify-content:space-between; gap:2mm; margin-bottom:1.2mm; font-size:8pt; }
          .row .label { font-weight:700; flex-shrink:0; }
          .name-row { font-size:10pt; font-weight:900; margin-bottom:1.5mm; }
          .footer { text-align:center; font-size:6.5pt; color:#888; margin-top:2mm; }
          .notes-box { background:#f5f5f5; border-radius:2mm; padding:1.5mm; font-size:7.5pt; margin-top:1mm; }
        </style>
      </head>
      <body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🖨 Order Sticker</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Sticker preview — fixed 48mm width rendered at screen scale */}
        <div style={{ display:"flex", justifyContent:"center", padding:"1rem 0", background:"#e5e7eb", borderRadius:"8px", margin:"0 1.5rem" }}>
          <div
            ref={stickerRef}
            style={{
              width: "181px", /* 48mm @ 96dpi */
              background: "#fff",
              color: "#000",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "9pt",
              padding: "11px 13px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            {/* Brand */}
            <div style={{ textAlign:"center", fontSize:"15pt", fontWeight:900, letterSpacing:"1px", marginBottom:"6px" }}>
              🥤 MAVCO
            </div>
            <div style={{ textAlign:"center", fontSize:"7pt", color:"#666", marginBottom:"6px" }}>
              Order #{order.id} · {fmt(order.created_at)}
            </div>
            <hr style={{ border:"none", borderTop:"1px dashed #aaa", margin:"5px 0" }} />

            {/* Customer */}
            <div style={{ fontWeight:900, fontSize:"11pt", marginBottom:"5px" }}>
              {order.customer_name}
            </div>
            {order.phone    && <Row label="📞" value={order.phone} />}
            {order.location && <Row label="📍" value={order.location} />}
            {order.delivery_time && <Row label="🕐" value={fmt(order.delivery_time)} />}

            <hr style={{ border:"none", borderTop:"1px dashed #aaa", margin:"5px 0" }} />

            {/* Order details */}
            <Row label="Drink" value={order.drink_name || order.milk_type || "—"} />
            <Row label="Pot"   value={order.pot} />
            <Row label="Price" value={`OMR ${Number(order.price).toFixed(2)}`} bold />
            <Row label="Delivery" value={order.delivery_paid ? "✓ Paid" : "Collect"} />

            {/* Notes */}
            {order.notes && (
              <>
                <hr style={{ border:"none", borderTop:"1px dashed #aaa", margin:"5px 0" }} />
                <div style={{ fontSize:"7.5pt", background:"#f5f5f5", borderRadius:"3px", padding:"4px 5px" }}>
                  📝 {order.notes}
                </div>
              </>
            )}

            <div style={{ textAlign:"center", fontSize:"6.5pt", color:"#aaa", marginTop:"6px" }}>
              Mavco Beverage Box
            </div>
          </div>
        </div>

        <p style={{ textAlign:"center", fontSize:"0.78rem", color:"var(--text-muted)", margin:"0.75rem 0 0" }}>
          Tap <strong>Save Image</strong> → open in <strong>We Print</strong> app to print
        </p>

        <div className="form-actions" style={{ marginTop:"0.75rem" }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-secondary" onClick={handlePrint}>🖨 Browser Print</button>
          <button className="btn btn-primary"   onClick={handleSaveImage}>⬇ Save Image</button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", gap:"6px", marginBottom:"3px", fontSize:"8.5pt" }}>
      <span style={{ fontWeight:700, flexShrink:0 }}>{label}</span>
      <span style={{ textAlign:"right", fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

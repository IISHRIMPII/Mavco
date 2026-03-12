// src/components/OrderSticker.js  — Thermal label sticker (60mm × 30mm, We Print compatible)
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
    const win = window.open("", "_blank", "width=280,height=160");
    win.document.write(`
      <!DOCTYPE html><html><head>
        <title>Order #${order.id}</title>
        <style>
          @page { size: 60mm 30mm; margin: 0; }
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: Arial, Helvetica, sans-serif; background:#fff; width:60mm; height:30mm; overflow:hidden; }
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

        {/* Sticker preview — 60mm × 30mm @ 96dpi = 227 × 113px */}
        <div style={{ display:"flex", justifyContent:"center", padding:"0.75rem 0", background:"#e5e7eb", borderRadius:"8px", margin:"0 1.5rem" }}>
          <div
            ref={stickerRef}
            style={{
              width: "227px",
              height: "113px",
              overflow: "hidden",
              background: "#fff",
              color: "#000",
              fontFamily: "Arial, Helvetica, sans-serif",
              padding: "4px 6px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "1px",
            }}
          >
            {/* Row 1: Brand + order ID */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
              <span style={{ fontSize:"10pt", fontWeight:900, letterSpacing:"0.5px" }}>🥤 MAVCO</span>
              <span style={{ fontSize:"7pt", color:"#333" }}>#{order.id}</span>
            </div>

            <hr style={{ border:"none", borderTop:"1px dashed #555", margin:"1px 0" }} />

            {/* Row 2: Name + Phone */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"4px" }}>
              <span style={{ fontWeight:900, fontSize:"9pt", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{order.customer_name}</span>
              {order.phone && <span style={{ fontSize:"7pt", color:"#000", flexShrink:0 }}>📞 {order.phone}</span>}
            </div>

            {/* Row 3: Location + Delivery time */}
            <div style={{ display:"flex", justifyContent:"space-between", gap:"4px", fontSize:"7pt", color:"#000" }}>
              <span style={{ minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {order.location ? `📍 ${order.location}` : ""}
              </span>
              {order.delivery_time && <span style={{ flexShrink:0 }}>🕐 {fmt(order.delivery_time)}</span>}
            </div>

            <hr style={{ border:"none", borderTop:"1px dashed #555", margin:"1px 0" }} />

            {/* Row 4: Drink + Pot */}
            <div style={{ display:"flex", justifyContent:"space-between", gap:"4px", fontSize:"7.5pt" }}>
              <span style={{ minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                <b>Drink:</b> {order.drink_name || "—"}
              </span>
              <span style={{ flexShrink:0 }}><b>Pot:</b> {order.pot}</span>
            </div>

            {/* Row 5: Price + Delivery paid */}
            <div style={{ display:"flex", justifyContent:"space-between", gap:"4px", fontSize:"7.5pt" }}>
              <span><b>Price:</b> OMR {Number(order.price).toFixed(2)}</span>
              <span>{order.delivery_paid ? "✓ Delivery Paid" : "Delivery: Collect"}</span>
            </div>

            {/* Row 6: Notes (if any) */}
            {order.notes && (
              <div style={{ fontSize:"7pt", color:"#222", borderTop:"1px dashed #555", paddingTop:"1px", marginTop:"1px",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                📝 {order.notes}
              </div>
            )}
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


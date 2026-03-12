// src/components/Orders.js
import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getOrders, createOrder, updateOrder, deleteOrder, parseOrder, deductInventory, getInventory
} from "../api/client";
import OrderSticker from "./OrderSticker";

const STATUSES = ["New", "Preparing", "Ready", "Delivered"];
const STATUS_COLORS = {
  New:       "#3b82f6",
  Preparing: "#f59e0b",
  Ready:     "#10b981",
  Delivered: "#8b5cf6",
};
// Legacy fallback: maps old short names → inventory item names
// (keeps existing orders working that stored "Oat" instead of "Oat Milk")
const MILK_INV_FALLBACK = {
  "Normal":       "Normal Milk",
  "Vanilla":      "Vanilla Milk",
  "Coconut":      "Coconut Milk",
  "Vanilla Soy":  "Vanilla Soy Milk",
  "Oat":          "Oat Milk",
  "Almond":       "Almond Milk",
  "Coconut Water":"Coconut Water",
  "Plastic":      "Pots Plastic",
  "Glass":        "Pots Glass",
};

// Resolve a value that may be a full inventory name OR a legacy short name
function resolveInvName(value) {
  return MILK_INV_FALLBACK[value] || value;
}

function buildRecipe(order) {
  return [
    { name: "1L Bottle",         amount: 1 },
    { name: "Foam 500ml Bottle", amount: 1 },
    { name: resolveInvName(order.pot),       amount: 1 },
    { name: "Cups",              amount: 7 },
    { name: "Pags (Bags)",       amount: 1 },
    { name: "Straws",            amount: 7 },
    { name: "Wooden Spoons",     amount: 1 },
    { name: "1L Bottle Sticker", amount: 1 },
    { name: "Cups Sticker",      amount: 7 },
    { name: "Foam Sticker",      amount: 1 },
    { name: "Givaway Sticker",   amount: 1 },
    { name: "Packaging Sticker", amount: 1 },
    { name: resolveInvName(order.milk_type), amount: 1 },
  ];
}

// Format a stored datetime-local string ("2026-03-12T15:00") for display
function formatDelivery(dt) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return dt;
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch { return dt; }
}

const EMPTY_FORM = {
  customer_name: "", phone: "", location: "", delivery_time: "",
  milk_type: "", pot: "", delivery_paid: false,
  notes: "", status: "New", price: "", cost: "",
};

export default function Orders() {
  const [searchParams]          = useSearchParams();
  const [orders,     setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState(searchParams.get("status") || "All");
  const [loading,    setLoading]= useState(true);
  const [error,      setError]  = useState(null);

  // Modal state
  const [showForm,   setShowForm]   = useState(false);
  const [formMode,   setFormMode]   = useState("add"); // add | edit
  const [formData,   setFormData]   = useState(EMPTY_FORM);
  const [editId,     setEditId]     = useState(null);
  const [formError,  setFormError]  = useState(null);
  const [saving,     setSaving]     = useState(false);

  // Sticker
  const [stickerOrder, setStickerOrder] = useState(null);

  // Inventory (for stock display in form)
  const [inventory, setInventory] = useState([]);

  // Deduction modal
  const [dedOrder,   setDedOrder]   = useState(null);   // order being prepared
  const [dedItems,   setDedItems]   = useState([]);     // editable recipe
  const [deducting,  setDeducting]  = useState(false);

  // WhatsApp parser
  const [showParser, setShowParser] = useState(false);
  const [rawText,    setRawText]    = useState("");
  const [parsing,    setParsing]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrders();
      setOrders(res.data);
    } catch {
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getInventory().then((res) => setInventory(res.data)).catch(() => {});
  }, []);

  // ── Filtered + sorted orders ──────────────────────────────────────────
  const displayed = (filterStatus === "All" ? orders : orders.filter((o) => o.status === filterStatus))
    .slice()
    .sort((a, b) => {
      if (!a.delivery_time && !b.delivery_time) return 0;
      if (!a.delivery_time) return 1;
      if (!b.delivery_time) return -1;
      return a.delivery_time.localeCompare(b.delivery_time);
    });

  // ── Form helpers ───────────────────────────────────────────────────────
  const openAdd = () => {
    const milkItems = inventory.filter((i) => i.category === "Milk");
    const potItems  = inventory.filter((i) => i.category === "Pots");
    setFormData({
      ...EMPTY_FORM,
      milk_type: milkItems[0]?.name || "",
      pot:       potItems[0]?.name  || "",
    });
    setEditId(null);
    setFormMode("add");
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (order) => {
    setFormData({
      customer_name:  order.customer_name,
      phone:          order.phone || "",
      location:       order.location || "",
      delivery_time:  order.delivery_time ? order.delivery_time.slice(0, 16) : "",
      milk_type:      order.milk_type || "Full Cream",
      pot:            order.pot || "Regular",
      delivery_paid:  !!order.delivery_paid,
      notes:          order.notes || "",
      status:         order.status,
      price:          order.price,
      cost:           order.cost || "",
    });
    setEditId(order.id);
    setFormMode("edit");
    setFormError(null);
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name.trim()) {
      setFormError("Customer name is required.");
      return;
    }
    if (!formData.price) {
      setFormError("Price is required.");
      return;
    }

    if (formMode === "add") {
      // For new orders: close form and show deduction modal first
      setShowForm(false);
      setDedOrder({ ...formData, id: null, _isNew: true });
      setDedItems(buildRecipe(formData));
      return;
    }

    // Edit mode: save directly, no deduction
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...formData, price: Number(formData.price), cost: Number(formData.cost || 0) };
      await updateOrder(editId, payload);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this order?")) return;
    await deleteOrder(id);
    await load();
  };

  const handleStatusChange = async (order, newStatus) => {
    await updateOrder(order.id, { status: newStatus });
    await load();
  };

  const handleDedItemChange = (idx, value) => {
    setDedItems((prev) => prev.map((item, i) =>
      i === idx ? { ...item, amount: parseFloat(value) || 0 } : item
    ));
  };

  const confirmDeduction = async () => {
    setDeducting(true);
    try {
      const itemsToDeduct = dedItems.filter((i) => i.amount > 0);

      if (dedOrder._isNew) {
        // New order: create order then deduct
        const payload = { ...dedOrder, price: Number(dedOrder.price), cost: Number(dedOrder.cost || 0) };
        delete payload._isNew;
        await createOrder(payload);
        if (itemsToDeduct.length > 0) await deductInventory(itemsToDeduct);
      } else {
        // Existing order: just deduct
        if (itemsToDeduct.length > 0) await deductInventory(itemsToDeduct);
      }

      setDedOrder(null);
      await load();
    } catch (err) {
      alert("Failed: " + (err.response?.data?.error || err.message));
    } finally {
      setDeducting(false);
    }
  };

  const nextStatus = (current) => {
    const idx = STATUSES.indexOf(current);
    return idx < STATUSES.length - 1 ? STATUSES[idx + 1] : null;
  };

  // ── WhatsApp parser ────────────────────────────────────────────────────
  const handleParse = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    try {
      const res = await parseOrder(rawText);
      setFormData((f) => ({
        ...f,
        ...res.data,
        price: res.data.price || "",
        cost:  "",
        delivery_paid: !!res.data.delivery_paid,
      }));
      setShowParser(false);
      setFormMode("add");
      setEditId(null);
      setFormError(null);
      setShowForm(true);
    } catch {
      alert("Parsing failed.");
    } finally {
      setParsing(false);
    }
  };

  if (loading) return <div className="page-loading">Loading orders…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page orders-page">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <h1>📦 Orders</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowParser(true)}>
            💬 Parse WhatsApp
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            + New Order
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────── */}
      <div className="filter-tabs">
        {["All", ...STATUSES].map((s) => (
          <button
            key={s}
            className={`tab-btn ${filterStatus === s ? "active" : ""}`}
            style={filterStatus === s && s !== "All" ? { borderColor: STATUS_COLORS[s], color: STATUS_COLORS[s] } : {}}
            onClick={() => setFilterStatus(s)}
          >
            {s} ({s === "All" ? orders.length : orders.filter((o) => o.status === s).length})
          </button>
        ))}
        <button className="btn btn-ghost ml-auto" onClick={load}>🔄</button>
      </div>

      {/* ── Orders Table ────────────────────────────────────────────── */}
      <div className="table-wrap">
        <table className="data-table orders-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Delivery Date</th>
              <th>Milk</th>
              <th>Pot</th>
              <th>Price</th>
              <th>Profit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={11} className="empty-row">No orders in this category</td></tr>
            ) : (
              displayed.map((o) => {
                const next = nextStatus(o.status);
                return (
                  <tr key={o.id}>
                    <td>#{o.id}</td>
                    <td><strong>{o.customer_name}</strong></td>
                    <td>{o.phone || "—"}</td>
                    <td className="location-cell">{o.location || "—"}</td>
                    <td>{formatDelivery(o.delivery_time)}</td>
                    <td>{o.milk_type}</td>
                    <td>{o.pot}</td>
                    <td>OMR {Number(o.price).toFixed(2)}</td>
                    <td className={o.profit >= 0 ? "profit-pos" : "profit-neg"}>
                      OMR {Number(o.profit || 0).toFixed(2)}
                    </td>
                    <td>
                      <select
                        className="status-select"
                        value={o.status}
                        style={{ borderColor: STATUS_COLORS[o.status] }}
                        onChange={(e) => handleStatusChange(o, e.target.value)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="action-cell">
                      {next && (
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleStatusChange(o, next)}
                          title={`Move to ${next}`}
                        >
                          → {next}
                        </button>
                      )}
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setStickerOrder(o)}
                        title="Print sticker"
                      >
                        🖨
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEdit(o)}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(o.id)}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add/Edit Modal ───────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{formMode === "add" ? "Add New Order" : "Edit Order"}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form className="order-form" onSubmit={handleSubmit}>
              {formError && <div className="form-error">{formError}</div>}

              <div className="form-grid">
                <Field label="Customer Name *" name="customer_name" value={formData.customer_name} onChange={handleFormChange} required />
                <Field label="Phone"           name="phone"         value={formData.phone}         onChange={handleFormChange} />
                <Field label="Location"        name="location"      value={formData.location}      onChange={handleFormChange} colSpan={2} />
                <div className="form-group">
                  <label>Delivery Date & Time</label>
                  <input
                    type="datetime-local"
                    name="delivery_time"
                    value={formData.delivery_time}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label>Milk Type</label>
                  <select name="milk_type" value={formData.milk_type} onChange={handleFormChange}>
                    {inventory.filter((i) => i.category === "Milk").map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name} — {item.quantity} {item.unit} in stock
                      </option>
                    ))}
                    {inventory.filter((i) => i.category === "Milk").length === 0 && (
                      <option value="">Loading…</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>Pot / Size</label>
                  <select name="pot" value={formData.pot} onChange={handleFormChange}>
                    {inventory.filter((i) => i.category === "Pots").map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name} — {item.quantity} pcs in stock
                      </option>
                    ))}
                    {inventory.filter((i) => i.category === "Pots").length === 0 && (
                      <option value="">Loading…</option>
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select name="status" value={formData.status} onChange={handleFormChange}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>

                <Field label="Price (OMR) *" name="price" type="number" value={formData.price} onChange={handleFormChange} required min="0" />
                <Field label="Cost (OMR)"   name="cost"  type="number" value={formData.cost}  onChange={handleFormChange} min="0" />

                <div className="form-group checkbox-group">
                  <label>
                    <input type="checkbox" name="delivery_paid" checked={formData.delivery_paid} onChange={handleFormChange} />
                    Delivery Paid
                  </label>
                </div>

                <Field label="Notes" name="notes" value={formData.notes} onChange={handleFormChange} colSpan={2} as="textarea" />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : formMode === "add" ? "Create Order" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── WhatsApp Parser Modal ────────────────────────────────────── */}
      {showParser && (
        <div className="modal-overlay" onClick={() => setShowParser(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💬 Parse WhatsApp Order</h2>
              <button className="modal-close" onClick={() => setShowParser(false)}>✕</button>
            </div>
            <div className="parser-body">
              <p className="parser-hint">
                Paste the WhatsApp message below. The system will extract customer
                name, phone, location, delivery time, milk type, price, and notes.
              </p>
              <textarea
                className="parser-input"
                rows={10}
                placeholder={`Example:\nName: Sarah\nPhone: 050-1234567\nLocation: Dubai Marina\nDelivery: 3pm\nMilk: Oat\nPot: Large\nPrice: 85\nNotes: extra cold please`}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
              />
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setShowParser(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleParse} disabled={parsing || !rawText.trim()}>
                  {parsing ? "Parsing…" : "Parse & Fill Form →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticker Modal ────────────────────────────────────────────── */}
      {stickerOrder && (
        <OrderSticker order={stickerOrder} onClose={() => setStickerOrder(null)} />
      )}

      {/* ── Deduction Confirmation Modal ─────────────────────────────── */}
      {dedOrder && (
        <div className="modal-overlay" onClick={() => setDedOrder(null)}>
          <div className="modal modal-deduct" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📦 {dedOrder._isNew ? "New Order — Deduct Inventory" : `Deduct Inventory — Order #${dedOrder.id}`}</h2>
              <button className="modal-close" onClick={() => setDedOrder(null)}>✕</button>
            </div>
            <p className="deduct-subtitle">
              {dedOrder._isNew
                ? <>Order for <strong>{dedOrder.customer_name}</strong>. Adjust amounts then confirm to create the order and deduct from stock.</>
                : <>Adjust amounts then confirm to deduct from stock.</>}
            </p>
            <div className="deduct-table-wrap">
              <table className="deduct-table">
                <thead>
                  <tr><th>Inventory Item</th><th>Deduct Amount</th></tr>
                </thead>
                <tbody>
                  {dedItems.map((item, idx) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.amount}
                          onChange={(e) => handleDedItemChange(idx, e.target.value)}
                          className="deduct-qty-input"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setDedOrder(null)}>Cancel</button>
              <button
                className="btn btn-warning"
                onClick={confirmDeduction}
                disabled={deducting}
              >
                {deducting ? "Saving…" : dedOrder._isNew ? "✓ Create Order & Deduct" : "✓ Confirm Deduction"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable field ──────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, type = "text", colSpan, as, required, ...rest }) {
  return (
    <div className={`form-group ${colSpan ? `col-span-${colSpan}` : ""}`}>
      <label>{label}</label>
      {as === "textarea" ? (
        <textarea name={name} value={value} onChange={onChange} rows={3} />
      ) : (
        <input name={name} type={type} value={value} onChange={onChange} required={required} {...rest} />
      )}
    </div>
  );
}

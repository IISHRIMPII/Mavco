// src/components/Orders.js
import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getOrders, createOrder, updateOrder, deleteOrder, parseOrder, deductInventory, getInventory, getDrinks, resetOrders,
  getDeductionTemplate, saveDeductionTemplate
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

function resolveInvName(value) {
  return MILK_INV_FALLBACK[value] || value;
}

// Build recipe from a drink object (from DB) + the selected pot + the saved base template
function buildRecipeFromDrink(drink, pot, baseTemplate) {
  // baseTemplate is [{name, amount}, ...] from DB; add the pot on top
  const base = [
    ...baseTemplate,
    { name: resolveInvName(pot), amount: 1 },
  ];
  const drinkItems = drink
    ? drink.recipe.map((r) => ({ name: r.inventory_name, amount: r.amount }))
    : [];
  return [...base, ...drinkItems];
}

// Legacy fallback for orders that pre-date the drinks system
function buildRecipeLegacy(order, baseTemplate) {
  return [
    ...baseTemplate,
    { name: resolveInvName(order.pot),       amount: 1 },
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
  drink_id: "", drink_name: "", pot: "", delivery_paid: false,
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

  // Inventory and drinks (for form + deduction)
  const [inventory, setInventory] = useState([]);
  const [drinks,    setDrinks]    = useState([]);

  // Deduction modal
  const [dedOrder,   setDedOrder]   = useState(null);   // order being prepared
  const [dedItems,   setDedItems]   = useState([]);     // editable recipe
  const [deducting,  setDeducting]  = useState(false);

  // Deduction template editor
  const [baseTemplate,      setBaseTemplate]      = useState([]);
  const [showTplEditor,     setShowTplEditor]     = useState(false);
  const [tplDraft,          setTplDraft]          = useState([]);
  const [savingTpl,         setSavingTpl]         = useState(false);

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
    getDrinks().then((res) => setDrinks(res.data)).catch(() => {});
    getDeductionTemplate().then((res) => setBaseTemplate(res.data)).catch(() => {});
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
    const potItems = inventory.filter((i) => i.category === "Pots");
    const firstDrink = drinks[0];
    setFormData({
      ...EMPTY_FORM,
      pot:        potItems[0]?.name || "",
      drink_id:   firstDrink?.id    || "",
      drink_name: firstDrink?.name  || "",
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
      drink_id:       order.drink_id   || "",
      drink_name:     order.drink_name || order.milk_type || "",
      pot:            order.pot || "",
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
      const selectedDrink = drinks.find((d) => String(d.id) === String(formData.drink_id)) || null;
      setShowForm(false);
      setDedOrder({ ...formData, id: null, _isNew: true });
      setDedItems(buildRecipeFromDrink(selectedDrink, formData.pot, baseTemplate));
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

  const handleDedItemChange = (idx, field, value) => {
    setDedItems((prev) => prev.map((item, i) =>
      i === idx ? { ...item, [field]: field === "amount" ? (parseFloat(value) || 0) : value } : item
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
          <button
            className="btn btn-ghost"
            onClick={() => {
              setTplDraft(baseTemplate.map((r) => ({ ...r })));
              setShowTplEditor(true);
            }}
          >
            ⚙️ Deduct Template
          </button>
          <button
            className="btn btn-ghost"
            style={{ color: "#e53e3e", borderColor:"#e53e3e" }}
            onClick={async () => {
              if (!window.confirm("⚠️ This will DELETE ALL orders and reset the order number back to 1. Are you sure?")) return;
              if (!window.confirm("Last warning: all order history will be lost. Continue?")) return;
              await resetOrders();
              await load();
            }}
          >
            🔄 Reset #
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
              <th>Drink</th>
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
                    <td>{o.drink_name || "—"}</td>
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
                  <label>Drink *</label>
                  <select
                    name="drink_id"
                    value={formData.drink_id}
                    onChange={(e) => {
                      const d = drinks.find((d) => String(d.id) === e.target.value);
                      setFormData((f) => ({
                        ...f,
                        drink_id:   e.target.value,
                        drink_name: d?.name || "",
                      }));
                    }}
                  >
                    <option value="">— select drink —</option>
                    {drinks.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
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
                  {dedItems.map((item, idx) => {
                    const isMilk = inventory.some((i) => i.name === item.name && i.category === "Milk");
                    return (
                      <tr key={idx}>
                        <td>
                          {isMilk ? (
                            <select
                              value={item.name}
                              onChange={(e) => handleDedItemChange(idx, "name", e.target.value)}
                              style={{ width: "100%", background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 8px" }}
                            >
                              {inventory.filter((i) => i.category === "Milk").map((mi) => (
                                <option key={mi.name} value={mi.name}>
                                  {mi.name} ({mi.quantity} {mi.unit} in stock)
                                </option>
                              ))}
                            </select>
                          ) : (
                            item.name
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.amount}
                            onChange={(e) => handleDedItemChange(idx, "amount", e.target.value)}
                            className="deduct-qty-input"
                          />
                        </td>
                      </tr>
                    );
                  })}
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

      {/* ── Deduction Template Editor ─────────────────────────────── */}
      {showTplEditor && (
        <div className="modal-overlay" onClick={() => setShowTplEditor(false)}>
          <div className="modal modal-deduct" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ Deduction Template</h2>
              <button className="modal-close" onClick={() => setShowTplEditor(false)}>✕</button>
            </div>
            <p className="deduct-subtitle">
              These base items are deducted for every new order (plus the drink's own recipe and the selected pot).
            </p>
            <div className="deduct-table-wrap">
              <table className="deduct-table">
                <thead>
                  <tr><th>Inventory Item Name</th><th>Amount</th><th></th></tr>
                </thead>
                <tbody>
                  {tplDraft.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          value={row.name}
                          onChange={(e) => setTplDraft((d) => d.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                          style={{ width: "100%", background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px 8px" }}
                          placeholder="Item name"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.amount}
                          onChange={(e) => setTplDraft((d) => d.map((r, i) => i === idx ? { ...r, amount: parseFloat(e.target.value) || 0 } : r))}
                          className="deduct-qty-input"
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => setTplDraft((d) => d.filter((_, i) => i !== idx))}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "0 1rem 0.75rem" }}>
              <button
                className="btn btn-secondary"
                onClick={() => setTplDraft((d) => [...d, { name: "", amount: 1 }])}
              >
                + Add Row
              </button>
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowTplEditor(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={savingTpl}
                onClick={async () => {
                  setSavingTpl(true);
                  try {
                    const res = await saveDeductionTemplate(tplDraft.filter((r) => r.name.trim()));
                    setBaseTemplate(res.data);
                    setShowTplEditor(false);
                  } catch {
                    alert("Failed to save template.");
                  } finally {
                    setSavingTpl(false);
                  }
                }}
              >
                {savingTpl ? "Saving…" : "💾 Save Template"}
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

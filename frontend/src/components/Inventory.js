// src/components/Inventory.js
import React, { useEffect, useState, useCallback } from "react";
import {
  getInventory, addInventory, updateInventory, restockItem, deleteInventory
} from "../api/client";

const UNIT_OPTIONS = ["L", "kg", "g", "ml", "pcs", "pkt", "jar", "box", "roll"];
const CATEGORIES = ["Containers", "Accessories", "Stickers", "Ingredients", "Milk", "Pots", "Other"];
const FILTER_TABS = ["All", ...CATEGORIES, "⚠️ Low Stock"];

const EMPTY_FORM = {
  name: "", quantity: "", unit: "pcs", cost_per_unit: "", low_stock_threshold: "10", category: "Other",
};

export default function Inventory() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState("All"); // All | <category> | ⚠️ Low Stock

  // Form modal
  const [showForm,  setShowForm]  = useState(false);
  const [formMode,  setFormMode]  = useState("add");
  const [formData,  setFormData]  = useState(EMPTY_FORM);
  const [editId,    setEditId]    = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving,    setSaving]    = useState(false);

  // Restock modal
  const [restockItem2,   setRestockItem2]   = useState(null);
  const [restockAmount, setRestockAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInventory();
      setItems(res.data);
    } catch {
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = filter === "⚠️ Low Stock"
    ? items.filter((i) => i.is_low_stock)
    : filter === "All"
    ? items
    : items.filter((i) => i.category === filter);

  const lowCount = items.filter((i) => i.is_low_stock).length;

  // ── Form helpers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setFormData(EMPTY_FORM);
    setEditId(null);
    setFormMode("add");
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setFormData({
      name:                item.name,
      quantity:            item.quantity,
      unit:                item.unit,
      cost_per_unit:       item.cost_per_unit,
      low_stock_threshold: item.low_stock_threshold,
      category:            item.category || "Other",
    });
    setEditId(item.id);
    setFormMode("edit");
    setFormError(null);
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setFormError("Name is required."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...formData,
        quantity:            Number(formData.quantity || 0),
        cost_per_unit:       Number(formData.cost_per_unit || 0),
        low_stock_threshold: Number(formData.low_stock_threshold || 10),
        category:            formData.category || "Other",
      };
      if (formMode === "add") {
        await addInventory(payload);
      } else {
        await updateInventory(editId, payload);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.error || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this inventory item?")) return;
    await deleteInventory(id);
    await load();
  };

  const handleRestock = async () => {
    const amt = parseFloat(restockAmount);
    if (!amt || amt <= 0) { alert("Enter a valid amount."); return; }
    await restockItem(restockItem2.id, amt);
    setRestockItem2(null);
    setRestockAmount("");
    await load();
  };

  if (loading) return <div className="page-loading">Loading inventory…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page inventory-page">
      <div className="page-header">
        <h1>🗂 Inventory</h1>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={load}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="inv-stats">
        <div className="inv-stat">
          <span className="inv-stat-value">{items.length}</span>
          <span className="inv-stat-label">Total Items</span>
        </div>
        <div className={`inv-stat ${lowCount > 0 ? "danger" : ""}`}>
          <span className="inv-stat-value">{lowCount}</span>
          <span className="inv-stat-label">⚠️ Low Stock</span>
        </div>
        <div className="inv-stat">
          <span className="inv-stat-value">
            OMR {items.reduce((s, i) => s + i.quantity * i.cost_per_unit, 0).toFixed(2)}
          </span>
          <span className="inv-stat-label">Stock Value</span>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-tabs">
        {FILTER_TABS.map((tab) => {
          const count =
            tab === "All" ? items.length
            : tab === "⚠️ Low Stock" ? lowCount
            : items.filter((i) => i.category === tab).length;
          return (
            <button
              key={tab}
              className={`tab-btn ${filter === tab ? "active" : ""}`}
              onClick={() => setFilter(tab)}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Unit</th>
              <th>Cost / Unit</th>
              <th>Stock Value</th>
              <th>Low Alert</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={9} className="empty-row">No items found</td></tr>
            ) : (
              displayed.map((item) => (
                <tr key={item.id} className={item.is_low_stock ? "row-warning" : ""}>
                  <td>{item.id}</td>
                  <td><strong>{item.name}</strong></td>
                  <td><span className="category-badge">{item.category}</span></td>
                  <td className={item.is_low_stock ? "qty-low" : ""}>{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td>OMR {Number(item.cost_per_unit).toFixed(2)}</td>
                  <td>OMR {(item.quantity * item.cost_per_unit).toFixed(2)}</td>
                  <td>{item.low_stock_threshold} {item.unit}</td>
                  <td>
                    {item.is_low_stock
                      ? <span className="badge badge-warning">⚠️ Low</span>
                      : <span className="badge badge-ok">✓ OK</span>}
                  </td>
                  <td className="action-cell">
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => { setRestockItem2(item); setRestockAmount(""); }}
                    >
                      + Stock
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>✏️</button>
                    <button className="btn btn-sm btn-danger"    onClick={() => handleDelete(item.id)}>🗑</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add/Edit Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{formMode === "add" ? "Add Inventory Item" : "Edit Item"}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form className="order-form" onSubmit={handleSubmit}>
              {formError && <div className="form-error">{formError}</div>}
              <div className="form-grid">
                <div className="form-group col-span-2">
                  <label>Name *</label>
                  <input name="name" value={formData.name} onChange={handleFormChange} required />
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input name="quantity" type="number" min="0" step="0.01" value={formData.quantity} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <select name="unit" value={formData.unit} onChange={handleFormChange}>
                    {UNIT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cost per Unit (OMR)</label>
                  <input name="cost_per_unit" type="number" min="0" step="0.01" value={formData.cost_per_unit} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Low Stock Threshold</label>
                  <input name="low_stock_threshold" type="number" min="0" step="0.01" value={formData.low_stock_threshold} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={formData.category} onChange={handleFormChange}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : formMode === "add" ? "Add Item" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Restock Modal ──────────────────────────────────────────────── */}
      {restockItem2 && (
        <div className="modal-overlay" onClick={() => setRestockItem2(null)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>+ Restock: {restockItem2.name}</h2>
              <button className="modal-close" onClick={() => setRestockItem2(null)}>✕</button>
            </div>
            <div className="restock-body">
              <p>Current stock: <strong>{restockItem2.quantity} {restockItem2.unit}</strong></p>
              <label>Add amount ({restockItem2.unit})</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={restockAmount}
                onChange={(e) => setRestockAmount(e.target.value)}
                autoFocus
                className="restock-input"
              />
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setRestockItem2(null)}>Cancel</button>
                <button className="btn btn-success" onClick={handleRestock}>Add Stock</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

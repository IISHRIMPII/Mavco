// src/components/Drinks.js — Manage drinks and their inventory recipes
import React, { useEffect, useState, useCallback } from "react";
import { getDrinks, createDrink, updateDrink, deleteDrink, getInventory } from "../api/client";

const EMPTY_FORM = { name: "", notes: "" };

export default function Drinks() {
  const [drinks,    setDrinks]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Add/Edit drink modal
  const [showForm,  setShowForm]  = useState(false);
  const [formMode,  setFormMode]  = useState("add");
  const [formData,  setFormData]  = useState(EMPTY_FORM);
  const [recipe,    setRecipe]    = useState([]); // [{inventory_name, amount}]
  const [editId,    setEditId]    = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving,    setSaving]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dRes, iRes] = await Promise.all([getDrinks(), getInventory()]);
      setDrinks(dRes.data);
      setInventory(iRes.data);
    } catch {
      setError("Failed to load drinks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setFormData(EMPTY_FORM);
    setRecipe([]);
    setEditId(null);
    setFormMode("add");
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (drink) => {
    setFormData({ name: drink.name, notes: drink.notes || "" });
    setRecipe(drink.recipe.map((r) => ({ inventory_name: r.inventory_name, amount: r.amount })));
    setEditId(drink.id);
    setFormMode("edit");
    setFormError(null);
    setShowForm(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((f) => ({ ...f, [name]: value }));
  };

  // Recipe row helpers
  const addRecipeRow = () => setRecipe((r) => [...r, { inventory_name: "", amount: 1 }]);
  const removeRecipeRow = (idx) => setRecipe((r) => r.filter((_, i) => i !== idx));
  const updateRecipeRow = (idx, field, value) =>
    setRecipe((r) => r.map((row, i) => i === idx ? { ...row, [field]: value } : row));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { setFormError("Drink name is required."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const payload = { ...formData, recipe: recipe.filter((r) => r.inventory_name && r.amount > 0) };
      if (formMode === "add") {
        await createDrink(payload);
      } else {
        await updateDrink(editId, payload);
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
    if (!window.confirm("Delete this drink and its recipe?")) return;
    await deleteDrink(id);
    await load();
  };

  if (loading) return <div className="page-loading">Loading drinks…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page drinks-page">
      <div className="page-header">
        <h1>🍵 Drinks</h1>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={load}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Drink</button>
        </div>
      </div>

      <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>
        Define your drink menu. Each drink's recipe tells the system which inventory items to deduct when an order is placed.
      </p>

      {drinks.length === 0 ? (
        <div className="empty-row" style={{ padding: "2rem", textAlign: "center" }}>
          No drinks yet. Click "+ Add Drink" to create your first one.
        </div>
      ) : (
        <div className="drinks-grid">
          {drinks.map((drink) => (
            <div key={drink.id} className="drink-card">
              <div className="drink-card-header">
                <h3>🥤 {drink.name}</h3>
                <div className="drink-card-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(drink)}>✏️ Edit</button>
                  <button className="btn btn-sm btn-danger"    onClick={() => handleDelete(drink.id)}>🗑</button>
                </div>
              </div>
              {drink.notes && <p className="drink-notes">{drink.notes}</p>}
              <div className="drink-recipe">
                <strong>Recipe:</strong>
                {drink.recipe.length === 0 ? (
                  <span style={{ color: "#64748b", marginLeft: "0.5rem" }}>No ingredients defined</span>
                ) : (
                  <ul className="recipe-list">
                    {drink.recipe.map((r, i) => {
                      const inv = inventory.find((item) => item.name === r.inventory_name);
                      return (
                        <li key={i}>
                          <span className="recipe-name">{r.inventory_name}</span>
                          <span className="recipe-amount">× {r.amount} {inv?.unit || ""}</span>
                          {inv && (
                            <span className={`recipe-stock ${inv.is_low_stock ? "low" : ""}`}>
                              ({inv.quantity} in stock)
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add/Edit Modal ───────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal modal-drinks" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{formMode === "add" ? "Add New Drink" : `Edit — ${formData.name}`}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              {formError && <div className="form-error">{formError}</div>}

              <div className="form-group">
                <label>Drink Name *</label>
                <input name="name" value={formData.name} onChange={handleFormChange} placeholder="e.g. Signature Matcha" required />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input name="notes" value={formData.notes} onChange={handleFormChange} placeholder="Optional description" />
              </div>

              {/* Recipe */}
              <div style={{ marginTop: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <strong>Recipe (ingredients to deduct per order)</strong>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={addRecipeRow}>+ Add Row</button>
                </div>

                {recipe.length === 0 && (
                  <p style={{ color: "#64748b", fontSize: "0.85rem" }}>No ingredients yet. Click "+ Add Row".</p>
                )}

                <table className="deduct-table" style={{ width: "100%" }}>
                  {recipe.length > 0 && (
                    <thead>
                      <tr>
                        <th>Inventory Item</th>
                        <th>Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {recipe.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <select
                            value={row.inventory_name}
                            onChange={(e) => updateRecipeRow(idx, "inventory_name", e.target.value)}
                            style={{ width: "100%" }}
                          >
                            <option value="">— pick item —</option>
                            {inventory.map((item) => (
                              <option key={item.name} value={item.name}>
                                {item.name} ({item.unit})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.amount}
                            onChange={(e) => updateRecipeRow(idx, "amount", parseFloat(e.target.value) || 0)}
                            className="deduct-qty-input"
                          />
                        </td>
                        <td>
                          <button type="button" className="btn btn-sm btn-danger" onClick={() => removeRecipeRow(idx)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-actions" style={{ marginTop: "1.5rem" }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : formMode === "add" ? "Create Drink" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

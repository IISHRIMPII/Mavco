// src/api/client.js  — Centralised Axios instance
import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api",  // Use env var in production
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// ── Orders ─────────────────────────────────────────────────────────────────
export const getOrders      = (status) => api.get("/orders", { params: status ? { status } : {} });
export const getOrder       = (id)     => api.get(`/orders/${id}`);
export const createOrder    = (data)   => api.post("/orders", data);
export const updateOrder    = (id, d)  => api.put(`/orders/${id}`, d);
export const deleteOrder    = (id)     => api.delete(`/orders/${id}`);
export const resetOrders    = ()       => api.post("/orders/reset");

// ── Inventory ──────────────────────────────────────────────────────────────
export const getInventory    = (params) => api.get("/inventory", { params });
export const archiveInventory = (id)    => api.patch(`/inventory/${id}/archive`);
export const addInventory    = (data)   => api.post("/inventory", data);
export const updateInventory = (id, d)  => api.put(`/inventory/${id}`, d);
export const restockItem     = (id, amt)=> api.patch(`/inventory/${id}/restock`, { amount: amt });
export const deleteInventory = (id)     => api.delete(`/inventory/${id}`);
export const deductInventory = (items)  => api.post("/inventory/deduct", { items });

// ── Profit ─────────────────────────────────────────────────────────────────
export const getProfit      = (period) => api.get("/profit", { params: { period } });

// ── Parse Order ────────────────────────────────────────────────────────────
export const parseOrder     = (text)   => api.post("/parse_order", { text });

// ── Drinks ─────────────────────────────────────────────────────────────────
export const getDrinks      = ()       => api.get("/drinks");
export const getDrink       = (id)     => api.get(`/drinks/${id}`);
export const createDrink    = (data)   => api.post("/drinks", data);
export const updateDrink    = (id, d)  => api.put(`/drinks/${id}`, d);
export const deleteDrink    = (id)     => api.delete(`/drinks/${id}`);

// ── Deduction Template ───────────────────────────────────────────────────
export const getDeductionTemplate  = ()    => api.get("/deduction_template");
export const saveDeductionTemplate = (items) => api.put("/deduction_template", { items });

export default api;

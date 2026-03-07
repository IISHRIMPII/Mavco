// src/api/client.js  — Centralised Axios instance
import axios from "axios";

const api = axios.create({
  baseURL: "/api",          // CRA proxy forwards to http://localhost:5000/api
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// ── Orders ─────────────────────────────────────────────────────────────────
export const getOrders      = (status) => api.get("/orders", { params: status ? { status } : {} });
export const getOrder       = (id)     => api.get(`/orders/${id}`);
export const createOrder    = (data)   => api.post("/orders", data);
export const updateOrder    = (id, d)  => api.put(`/orders/${id}`, d);
export const deleteOrder    = (id)     => api.delete(`/orders/${id}`);

// ── Inventory ──────────────────────────────────────────────────────────────
export const getInventory    = ()       => api.get("/inventory");
export const addInventory    = (data)   => api.post("/inventory", data);
export const updateInventory = (id, d)  => api.put(`/inventory/${id}`, d);
export const restockItem     = (id, amt)=> api.patch(`/inventory/${id}/restock`, { amount: amt });
export const deleteInventory = (id)     => api.delete(`/inventory/${id}`);
export const deductInventory = (items)  => api.post("/inventory/deduct", { items });

// ── Profit ─────────────────────────────────────────────────────────────────
export const getProfit      = (period) => api.get("/profit", { params: { period } });

// ── Parse Order ────────────────────────────────────────────────────────────
export const parseOrder     = (text)   => api.post("/parse_order", { text });

export default api;

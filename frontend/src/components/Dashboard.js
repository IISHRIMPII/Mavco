// src/components/Dashboard.js
import React, { useEffect, useState, useCallback } from "react";
import { getProfit, getOrders, getInventory } from "../api/client";
import { useNavigate } from "react-router-dom";

const STATUS_META = {
  New:       { icon: "🆕", color: "#3b6ebe" },
  Preparing: { icon: "👨‍🍳", color: "#f59e0b" },
  Ready:     { icon: "✅", color: "#10b981" },
  Delivered: { icon: "🚚", color: "#8b5cf6" },
};

export default function Dashboard() {
  const [profit,    setProfit]    = useState(null);
  const [orders,    setOrders]    = useState([]);
  const [inventory, setInventory] = useState([]);
  const [period,    setPeriod]    = useState("all");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, o, i] = await Promise.all([
        getProfit(period),
        getOrders(),
        getInventory(),
      ]);
      setProfit(p.data);
      setOrders(o.data);
      setInventory(i.data);
    } catch (e) {
      setError("Could not connect to backend. Is Flask running on port 5000?");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const lowStock = inventory.filter((i) => i.is_low_stock);
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  if (loading) return <div className="page-loading">Loading dashboard…</div>;
  if (error)   return <div className="page-error">{error}</div>;

  return (
    <div className="page dashboard">
      <div className="page-header">
        <h1>📊 Dashboard</h1>
        <div className="period-tabs">
          {["today", "week", "month", "all"].map((p) => (
            <button
              key={p}
              className={`tab-btn ${period === p ? "active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────── */}
      <div className="card-grid four-col">
        <SummaryCard
          icon="🧾"
          label="Total Orders"
          value={profit?.total_orders ?? 0}
          color="#3b82f6"
        />
        <SummaryCard
          icon="💰"
          label="Revenue"
          value={`OMR ${(profit?.total_revenue ?? 0).toFixed(2)}`}
          color="#10b981"
        />
        <SummaryCard
          icon="🏭"
          label="Cost"
          value={`OMR ${(profit?.total_cost ?? 0).toFixed(2)}`}
          color="#ef4444"
        />
        <SummaryCard
          icon="📈"
          label="Profit"
          value={`OMR ${(profit?.total_profit ?? 0).toFixed(2)}`}
          color="#8b5cf6"
          highlight
        />
      </div>

      {/* ── Order Status Breakdown ───────────────────────────────────── */}
      <section className="section">
        <h2>Orders by Status</h2>
        <div className="card-grid four-col">
          {Object.entries(STATUS_META).map(([status, meta]) => {
            const count = profit?.by_status?.[status] ?? 0;
            const statusOrders = orders.filter((o) => o.status === status);
            return (
              <div
                key={status}
                className="status-card clickable"
                style={{ borderTop: `4px solid ${meta.color}` }}
                onClick={() => navigate(`/orders?status=${status}`)}
              >
                <div className="status-icon">{meta.icon}</div>
                <div className="status-name">{status}</div>
                <div className="status-count" style={{ color: meta.color }}>
                  {count}
                </div>
                <div className="status-label">orders</div>
                {statusOrders.length > 0 && (
                  <ul className="status-preview">
                    {statusOrders.slice(0, 2).map((o) => (
                      <li key={o.id}>{o.customer_name}</li>
                    ))}
                    {statusOrders.length > 2 && (
                      <li className="more">+{statusOrders.length - 2} more</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Low Stock Alerts ─────────────────────────────────────────── */}
      {lowStock.length > 0 && (
        <section className="section">
          <h2>⚠️ Low Stock Alerts</h2>
          <div className="alert-grid">
            {lowStock.map((item) => (
              <div key={item.id} className="alert-card">
                <span className="alert-name">{item.name}</span>
                <span className="alert-qty">
                  {item.quantity} {item.unit}
                  <span className="alert-badge">LOW</span>
                </span>
              </div>
            ))}
          </div>
          <button className="btn btn-outline mt-sm" onClick={() => navigate("/inventory")}>
            Manage Inventory →
          </button>
        </section>
      )}

      {/* ── Recent Orders ────────────────────────────────────────────── */}
      <section className="section">
        <div className="section-header">
          <h2>Recent Orders</h2>
          <button className="btn btn-outline" onClick={() => navigate("/orders")}>
            View All →
          </button>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Location</th>
                <th>Delivery</th>
                <th>Milk</th>
                <th>Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">No orders yet</td>
                </tr>
              ) : (
                recentOrders.map((o) => (
                  <tr key={o.id} onClick={() => navigate("/orders")} className="clickable-row">
                    <td>#{o.id}</td>
                    <td><strong>{o.customer_name}</strong></td>
                    <td>{o.location || "—"}</td>
                    <td>{o.delivery_time || "—"}</td>
                    <td>{o.milk_type}</td>
                    <td>OMR {o.price}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ background: STATUS_META[o.status]?.color }}
                      >
                        {STATUS_META[o.status]?.icon} {o.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Daily Revenue Chart (text-based sparkline) ───────────────── */}
      {profit?.daily_chart?.length > 0 && (
        <section className="section">
          <h2>📅 Last 7 Days</h2>
          <div className="daily-chart">
            {profit.daily_chart.map((d) => (
              <div key={d.day} className="day-bar-wrap">
                <div
                  className="day-bar"
                  style={{ height: `${Math.max(4, (d.revenue / 300) * 100)}px` }}
                  title={`Revenue: OMR ${d.revenue}`}
                />
                <div className="day-label">{d.day?.slice(5)}</div>
                <div className="day-rev">AED {d.revenue}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color, highlight }) {
  return (
    <div className={`summary-card ${highlight ? "highlight" : ""}`} style={{ borderTop: `4px solid ${color}` }}>
      <div className="summary-icon">{icon}</div>
      <div className="summary-value" style={{ color }}>{value}</div>
      <div className="summary-label">{label}</div>
    </div>
  );
}

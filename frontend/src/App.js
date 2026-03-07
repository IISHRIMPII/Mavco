// src/App.js — Root component with routing and navbar
import React, { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard  from "./components/Dashboard";
import Orders     from "./components/Orders";
import Inventory  from "./components/Inventory";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="app">
        {/* ── Navbar ─────────────────────────────────────────────────── */}
        <nav className="navbar">
          <div className="navbar-brand">
            <span className="brand-icon">🥤</span>
            <span className="brand-name">Mavco</span>
          </div>
          {/* Hamburger for small screens */}
          <button
            className="hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <ul className={`nav-links ${menuOpen ? "open" : ""}`}>
            {[
              { to: "/",          label: "📊 Dashboard" },
              { to: "/orders",    label: "📦 Orders"    },
              { to: "/inventory", label: "🗂 Inventory" },
            ].map(({ to, label }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Pages ──────────────────────────────────────────────────── */}
        <main className="main-content">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/orders"    element={<Orders />}    />
            <Route path="/inventory" element={<Inventory />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

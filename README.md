# 🥤 Mavco Beverage Box — Inventory & Order Tracking System

A full-stack web application to manage your beverage box business: order tracking, inventory management, profit analytics, and printable stickers. Built with Flask (Python) backend and React frontend.

## ✨ Features

- **Order Management**: Create, edit, track orders with status flow (New → Preparing → Ready → Delivered)
- **Inventory Tracking**: Real-time stock levels with low-stock alerts, restocking, and automatic deduction on order preparation
- **WhatsApp Integration**: Parse customer messages into orders automatically
- **Profit Analytics**: Revenue, cost, profit tracking by period
- **Printable Stickers**: Generate delivery labels with QR codes
- **iPad-Friendly**: Dark theme optimized for touch devices
- **Category Filtering**: Filter inventory by Containers, Accessories, Stickers, Ingredients

## 🚀 Quick Start (Windows)

### Prerequisites
- Python 3.8+ (for backend)
- Node.js 18+ (for frontend)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mavco.git
   cd mavco
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   python seed_data.py  # Load sample inventory
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the App

**Terminal 1 — Backend**
```bash
cd backend
venv\Scripts\activate
python app.py
```
Backend runs on http://localhost:5000

**Terminal 2 — Frontend**
```bash
cd frontend
npm start
```
Frontend runs on http://localhost:3000

Open http://localhost:3000 in your browser.

## 📱 Usage

### Placing Orders
1. Go to **Orders** page
2. Click **+ New Order** or **💬 Parse WhatsApp**
3. Fill in customer details, milk type, pot size, price
4. Change status to **Preparing** → inventory auto-deducts

### Managing Inventory
- View stock levels on **Inventory** page
- Filter by category (All, Containers, Accessories, etc.)
- Restock items with the **+ Stock** button
- Low-stock items are highlighted in red

### Analytics
- **Dashboard** shows total revenue, costs, profits
- View order status breakdown and low-stock alerts

## 🏗️ Project Structure

```
Mavco/
├── backend/                  # Flask REST API
│   ├── app.py                # Main app with CORS
│   ├── database.py           # SQLite connection & init
│   ├── seed_data.py          # Sample data loader
│   ├── requirements.txt      # Python deps
│   └── routes/
│       ├── orders.py         # Order CRUD
│       ├── inventory.py      # Inventory CRUD + deduction
│       ├── profit.py         # Analytics
│       └── parse_order.py    # WhatsApp parser
├── frontend/                 # React SPA
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js            # Router & navbar
│       ├── api/client.js     # Axios wrapper
│       ├── styles/App.css    # Dark theme
│       └── components/
│           ├── Dashboard.js
│           ├── Orders.js
│           ├── Inventory.js
│           └── OrderSticker.js
├── .gitignore
└── README.md
```

## 🛠️ Technologies

- **Backend**: Python 3, Flask 3.0, SQLite, flask-cors
- **Frontend**: React 18, Axios, React Router
- **Styling**: CSS with dark theme
- **Deployment**: Ready for Railway, Render, or any cloud platform

## 📦 Deployment

### Railway.app (Recommended)
1. Push to GitHub
2. Connect to [railway.app](https://railway.app)
3. Deploy backend and frontend as separate services
4. Set `FLASK_ENV=production` for backend

### Local Network Access
- Backend: `http://YOUR_IP:5000`
- Frontend: `http://YOUR_IP:3000`

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Commit changes
4. Push to GitHub
5. Open a Pull Request

## 📄 License

MIT License - feel free to use for your business!

## 📞 Support

For issues or questions, open a GitHub issue or contact the maintainer.

This will:
1. Create a Python virtual environment
2. Install Flask + flask-cors
3. Seed the SQLite database with sample data
4. Start the API on **http://localhost:5000**

### Terminal 2 — Frontend

```bat
cd frontend
start.bat
```

This will:
1. Install npm packages
2. Start the React dev server on **http://localhost:3000**

> Open **http://localhost:3000** in any browser (including iPad via your local IP).

---

## iPad Access (same Wi-Fi)

1. Find your computer's local IP:  
   ```bat
   ipconfig
   ```
   Look for `IPv4 Address`, e.g. `192.168.1.105`

2. Edit `frontend/package.json` — change the proxy line:
   ```json
   "proxy": "http://192.168.1.105:5000"
   ```
   Or access directly: `http://192.168.1.105:3000`

3. Open `http://192.168.1.105:3000` on your iPad browser.

---

## API Reference

| Method | Endpoint                          | Description                    |
|--------|-----------------------------------|--------------------------------|
| GET    | /api/health                       | Health check                   |
| GET    | /api/orders                       | List all orders (filter ?status=) |
| POST   | /api/orders                       | Create order + deduct inventory |
| PUT    | /api/orders/:id                   | Update order fields/status     |
| DELETE | /api/orders/:id                   | Delete order                   |
| GET    | /api/inventory                    | List all inventory items       |
| POST   | /api/inventory                    | Add new item                   |
| PUT    | /api/inventory/:id                | Update item                    |
| PATCH  | /api/inventory/:id/restock        | Add stock (body: {amount: N})  |
| DELETE | /api/inventory/:id                | Delete item                    |
| GET    | /api/profit?period=today/week/month/all | Revenue/cost/profit summary |
| POST   | /api/parse_order                  | Parse WhatsApp text → order fields |

---

## Features

- **Dashboard** — Live summary: revenue, cost, profit, orders by status, low-stock warnings
- **Orders** — Full CRUD, one-click status progression (New→Preparing→Ready→Delivered)
- **WhatsApp Parser** — Paste a WhatsApp message, auto-fill the order form
- **Printable Stickers** — Pop-up sticker preview with print button (opens browser print dialog)
- **Inventory** — Add/edit/delete items, restock button, low-stock badge
- **Profit Analytics** — Filter by today/week/month/all, daily bar chart for last 7 days

---

## Database (SQLite)

File: `backend/mavco.db` (auto-created on first run)

Tables: `inventory`, `orders`, `order_items`

To reset: delete `mavco.db` and re-run `seed_data.py`.

# 📈 MarketMind AI — Indian Stock Market Live Agent Dashboard

A premium, AI-powered live dashboard for tracking the Indian stock market (NSE/BSE). Built with pure HTML, CSS, and JavaScript — no heavy frameworks required.

## ✨ Features

- **📊 Real-Time Index Tracking** — NIFTY 50, SENSEX, BANK NIFTY, NIFTY IT, NIFTY MID, NIFTY AUTO
- **🗺️ Sector Heatmap** — Color-coded sector performance across 12 major NSE sectors
- **📈 Interactive Charts** — Multi-timeframe line charts with zoom/hover tooltips (powered by Chart.js)
- **🤖 AI Market Agent** — Ask natural language questions about the market, sectors, or indices
- **🔼🔽 Top Movers** — Gainers, Losers, and High Volume stocks tables with live animations
- **📡 Live Signals** — AI-generated trading signals and alerts
- **🕐 IST Clock** — Real-time India Standard Time with market open/closed indicator
- **💹 FII/DII Activity** — Track institutional flows
- **🌊 Advance/Decline Ratio** — Breadth indicator bar

## 🚀 Getting Started

No build step required. Simply open `index.html` in your browser:

```bash
# Clone the repo
git clone https://github.com/<your-username>/new-project.git
cd new-project

# Open directly (macOS)
open index.html

# Or use a simple local server
npx serve .
```

## 🔌 Connecting to Live Data APIs

The app is pre-configured with simulated data. To connect real NSE/BSE feeds:

### Option 1 — NSE India Unofficial API
Replace mock data in `app.js` with calls to NSE's unofficial endpoints:
```js
const response = await fetch('https://www.nseindia.com/api/allIndices');
const data = await response.json();
```

### Option 2 — Angel One / Zerodha Kite API
```js
// Replace INDICES_DATA population in app.js with:
const kite = new KiteConnect({ api_key: 'YOUR_KEY' });
const quotes = await kite.getQuote(['NSE:NIFTY 50', 'BSE:SENSEX']);
```

### Option 3 — Alpha Vantage (paid)
```js
const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=^NSEI&apikey=YOUR_KEY`);
```

## 🏗️ Architecture

```
new-project/
├── index.html      # App structure & layout
├── style.css       # Premium dark design system
├── app.js          # Data, chart logic, AI agent
└── README.md       # This file
```

## 🎨 Design System

- **Font**: Inter + JetBrains Mono (Google Fonts)
- **Theme**: Premium dark mode with glassmorphism accents
- **Colors**: Deep navy backgrounds with blue/purple accent gradients
- **Charts**: Chart.js v4 with custom gradient fills
- **Animations**: CSS keyframes + micro-interactions

## 🤖 AI Agent Capabilities

The built-in AI agent responds to natural language queries about:
- Index trends (NIFTY, SENSEX, BANK NIFTY)
- Sector performance and rotation
- FII/DII institutional activity
- Intraday technical levels
- Market breadth and VIX analysis

## 📱 Responsive Design

| Breakpoint | Layout |
|-----------|--------|
| > 1200px  | Full 3-column layout |
| 820–1200px | 2-column (left + main) |
| < 820px   | Single column mobile view |

## 🛠️ Tech Stack

- **HTML5** — Semantic layout with accessibility in mind
- **CSS3** — Custom properties, Grid, Flexbox, animations
- **Vanilla JavaScript** — ES2022, modular architecture
- **Chart.js v4** — Interactive financial charts
- **Google Fonts** — Inter & JetBrains Mono

## 📄 License

MIT License — free to use, modify, and distribute.

---

> Built with ❤️ for Indian investors and traders. Data is simulated for demonstration — connect a live broker API for production use.

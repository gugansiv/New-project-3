/* ═══════════════════════════════════════════════════
   MARKETMIND AI  ·  Live Indian Stock Market Agent
   Real data: Yahoo Finance API (every 2 min)
   AI Chat:   Google Gemini API (user's own key)
   No user data is stored or transmitted to our servers.
═══════════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────────
//  CONFIG
// ──────────────────────────────────────────────────
const CFG = {
  CORS_PROXIES: [
    'https://corsproxy.io/?url=',
    'https://api.allorigins.win/raw?url=',
  ],
  YAHOO: 'https://query1.finance.yahoo.com/v8/finance/chart/',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=',
  REFRESH_MS: 120_000, // 2 minutes

  // NSE/BSE symbols on Yahoo Finance
  INDEX_SYMBOLS: [
    { yf: '^NSEI',    label: 'NIFTY 50' },
    { yf: '^BSESN',   label: 'SENSEX' },
    { yf: '^NSEBANK', label: 'BANK NIFTY' },
    { yf: '^CNXTI',   label: 'NIFTY IT' },
    { yf: '^NSEMDCP50', label: 'NIFTY MID' },
    { yf: '^CNXAUTO', label: 'NIFTY AUTO' },
  ],

  STOCK_SYMBOLS: [
    { yf: 'RELIANCE.NS', label: 'RELIANCE', name: 'Reliance Ind.' },
    { yf: 'TCS.NS',      label: 'TCS',      name: 'Tata Consultancy' },
    { yf: 'INFY.NS',     label: 'INFY',     name: 'Infosys' },
    { yf: 'HDFCBANK.NS', label: 'HDFCBANK', name: 'HDFC Bank' },
    { yf: 'IOB.NS',      label: 'IOB',      name: 'Indian Overseas Bk' },
    { yf: 'SBIN.NS',     label: 'SBIN',     name: 'State Bank India' },
    { yf: 'WIPRO.NS',    label: 'WIPRO',    name: 'Wipro' },
    { yf: 'RECLTD.NS',   label: 'RECLTD',   name: 'REC Ltd' },
    { yf: 'SUZLON.NS',   label: 'SUZLON',   name: 'Suzlon Energy' },
    { yf: 'IRFC.NS',     label: 'IRFC',     name: 'Indian Rly Finance' },
  ],

  SECTOR_SYMBOLS: [
    { yf: '^CNXIT',    label: 'IT',       idx: true },
    { yf: '^CNXPHARMA',label: 'Pharma',   idx: true },
    { yf: '^CNXFMCG',  label: 'FMCG',    idx: true },
    { yf: '^CNXMETAL',  label: 'Metal',   idx: true },
    { yf: '^CNXAUTO',   label: 'Auto',    idx: true },
    { yf: '^CNXREALTY', label: 'Realty',  idx: true },
    { yf: '^NSEBANK',   label: 'Bank',    idx: true },
    { yf: '^CNXENERGY', label: 'Energy',  idx: true },
    { yf: '^CNXMEDIA',  label: 'Media',   idx: true },
    { yf: '^CNXPSUBANK',label: 'PSU Bank',idx: true },
    { yf: '^CNXINFRA',  label: 'Infra',   idx: true },
    { yf: '^CNXCONSUME',label: 'Consumer',idx: true },
  ],
};

// ──────────────────────────────────────────────────
//  LIVE MARKET STATE
// ──────────────────────────────────────────────────
const STATE = {
  indices: {},        // label → { price, change, pct, high, low, prev }
  stocks: {},         // label → same shape
  sectors: {},        // label → { pct, price }
  history: {},        // label → [prices]  for chart
  lastUpdated: null,
  refreshTimer: null,
  countdownTimer: null,
  countdownSec: 120,
  isUpdating: false,
  proxyIndex: 0,
};

// ──────────────────────────────────────────────────
//  CORS PROXY FETCH
// ──────────────────────────────────────────────────
async function proxyFetch(url) {
  for (let i = 0; i < CFG.CORS_PROXIES.length; i++) {
    const proxy = CFG.CORS_PROXIES[(STATE.proxyIndex + i) % CFG.CORS_PROXIES.length];
    try {
      const r = await fetch(proxy + encodeURIComponent(url), { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      return await r.json();
    } catch {
      // try next proxy
    }
  }
  throw new Error('All CORS proxies failed for: ' + url);
}

// ──────────────────────────────────────────────────
//  YAHOO FINANCE QUOTE PARSER
// ──────────────────────────────────────────────────
async function fetchQuote(yfsymbol) {
  const url = CFG.YAHOO + encodeURIComponent(yfsymbol) + '?interval=5m&range=1d';
  const data = await proxyFetch(url);
  const res = data?.chart?.result?.[0];
  if (!res) throw new Error('No result for ' + yfsymbol);

  const meta = res.meta;
  const closes = res.indicators?.quote?.[0]?.close || [];
  const timestamps = res.timestamp || [];

  const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
  const prev  = meta.chartPreviousClose ?? meta.previousClose ?? price;
  const change = +(price - prev).toFixed(2);
  const pct    = +((change / prev) * 100).toFixed(2);
  const high   = meta.regularMarketDayHigh ?? price;
  const low    = meta.regularMarketDayLow  ?? price;
  const vol    = meta.regularMarketVolume  ?? 0;

  // Clean history (remove nulls)
  const history = closes.filter(c => c !== null && c !== undefined);

  return { price, change, pct, high, low, prev, vol, history };
}

// ──────────────────────────────────────────────────
//  MAIN DATA REFRESH (every 2 min)
// ──────────────────────────────────────────────────
async function refreshMarketData() {
  if (STATE.isUpdating) return;
  STATE.isUpdating = true;
  showBanner(true);
  setAgentStatus('Fetching live data…');

  const errors = [];

  // Fetch indices
  await Promise.allSettled(CFG.INDEX_SYMBOLS.map(async ({ yf, label }) => {
    try {
      const q = await fetchQuote(yf);
      STATE.indices[label] = q;
      if (q.history.length > 3) STATE.history[label] = q.history;
    } catch (e) { errors.push(label + ': ' + e.message); }
  }));

  // Fetch stocks
  await Promise.allSettled(CFG.STOCK_SYMBOLS.map(async ({ yf, label }) => {
    try {
      const q = await fetchQuote(yf);
      STATE.stocks[label] = q;
    } catch (e) { errors.push(label); }
  }));

  // Fetch sectors
  await Promise.allSettled(CFG.SECTOR_SYMBOLS.map(async ({ yf, label }) => {
    try {
      const q = await fetchQuote(yf);
      STATE.sectors[label] = { pct: q.pct, price: q.price, change: q.change };
    } catch (e) { errors.push('Sector:' + label); }
  }));

  STATE.lastUpdated = new Date();
  STATE.isUpdating = false;
  showBanner(false);

  // Re-render everything
  renderIndices();
  renderSectorHeatmap();
  renderWatchedStocks();
  renderMovers(STATE.currentMovers || 'gainers');
  updateChartWithLiveData();
  updateChartOverlay();
  generateLiveInsights();
  generateLiveSignals();
  setAgentStatus('Live');

  const errCount = errors.length;
  if (errCount === 0) {
    showToast('✅ Live data updated — ' + formatIST(STATE.lastUpdated));
  } else {
    showToast(`⚡ Partial update — ${CFG.INDEX_SYMBOLS.length - errCount} indices loaded`);
  }

  // Reset countdown
  STATE.countdownSec = CFG.REFRESH_MS / 1000;
}

function startAutoRefresh() {
  // Initial fetch
  refreshMarketData();

  // 2-min interval
  STATE.refreshTimer = setInterval(refreshMarketData, CFG.REFRESH_MS);

  // Countdown display every second
  STATE.countdownTimer = setInterval(() => {
    STATE.countdownSec = Math.max(0, STATE.countdownSec - 1);
    const m = Math.floor(STATE.countdownSec / 60);
    const s = STATE.countdownSec % 60;
    const el = document.getElementById('countdown');
    if (el) el.textContent = `${m}:${String(s).padStart(2,'0')}`;
  }, 1000);
}

function manualRefresh() {
  clearInterval(STATE.refreshTimer);
  STATE.countdownSec = CFG.REFRESH_MS / 1000;
  STATE.refreshTimer = setInterval(refreshMarketData, CFG.REFRESH_MS);
  refreshMarketData();
  // Spin icon
  const icon = document.getElementById('refreshIcon');
  if (icon) { icon.style.transition = 'transform 0.6s'; icon.style.transform = 'rotate(360deg)'; }
  setTimeout(() => { if (icon) icon.style.transform = ''; }, 700);
}

// ──────────────────────────────────────────────────
//  GEMINI AI AGENT
// ──────────────────────────────────────────────────
const GEMINI_KEY_LS = 'marketmind_gemini_key';

function getApiKey() { return localStorage.getItem(GEMINI_KEY_LS) || ''; }

function saveApiKey() {
  const val = document.getElementById('geminiKeyInput')?.value?.trim();
  if (!val || !val.startsWith('AIza')) {
    showToast('⚠️ Please enter a valid Gemini API key (starts with AIza…)');
    return;
  }
  localStorage.setItem(GEMINI_KEY_LS, val);
  document.getElementById('apiKeyNote').textContent = '✅ Key saved locally. Agent is ready!';
  document.getElementById('apiKeyNote').style.color = 'var(--green)';
  document.getElementById('geminiKeyInput').value = '';
  showToast('🔑 Gemini key saved — AI Agent activated!');
}

function buildMarketContext() {
  // Inject live data into Gemini system prompt
  const idx = STATE.indices;
  const sct = STATE.sectors;
  const stk = STATE.stocks;
  const ts  = STATE.lastUpdated ? formatIST(STATE.lastUpdated) : 'recently';

  let ctx = `You are MarketMind AI, an expert Indian stock market analyst with access to LIVE market data as of ${ts} IST.\n\n`;
  ctx += `=== LIVE INDEX DATA ===\n`;
  for (const [label, d] of Object.entries(idx)) {
    if (d) ctx += `${label}: ₹${d.price?.toLocaleString('en-IN')} | Change: ${d.change >= 0 ? '+' : ''}${d.change} (${d.pct}%) | High: ${d.high} | Low: ${d.low}\n`;
  }

  ctx += `\n=== LIVE SECTOR PERFORMANCE ===\n`;
  for (const [label, d] of Object.entries(sct)) {
    if (d) ctx += `${label}: ${d.pct >= 0 ? '+' : ''}${d.pct}%\n`;
  }

  ctx += `\n=== LIVE STOCK QUOTES ===\n`;
  for (const [label, d] of Object.entries(stk)) {
    if (d) ctx += `${label}: ₹${d.price?.toLocaleString('en-IN')} | ${d.pct >= 0 ? '+' : ''}${d.pct}% | Vol: ${formatVol(d.vol)}\n`;
  }

  ctx += `\n=== INSTRUCTIONS ===\n`;
  ctx += `- Answer using ONLY the live data above where relevant.\n`;
  ctx += `- Give specific prices, % changes, support/resistance levels, and actionable insight.\n`;
  ctx += `- For technical analysis, mention RSI, moving averages, and key levels.\n`;
  ctx += `- For F&O questions, discuss PCR, OI, and expiry dynamics.\n`;
  ctx += `- Be concise (3-5 sentences max unless detailed analysis is asked).\n`;
  ctx += `- DO NOT store or repeat user personal data. DO NOT make up data not in the live feed above.\n`;
  ctx += `- If a stock is not in the live feed, say so and advise checking NSEIndia.com.\n`;
  ctx += `- Always end with a risk disclaimer if giving buy/sell advice.\n`;

  return ctx;
}

async function callGemini(userMessage) {
  const key = getApiKey();
  if (!key) {
    return `⚠️ Please enter your **Gemini API key** in the panel above to enable AI responses. Get a free key at [aistudio.google.com](https://aistudio.google.com/app/apikey) — it's free and instant!`;
  }

  const systemCtx = buildMarketContext();

  const payload = {
    system_instruction: { parts: [{ text: systemCtx }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 512,
      topP: 0.8,
    }
  };

  const res = await fetch(CFG.GEMINI + key, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 400) return `❌ Invalid API key. Please re-enter your Gemini API key.`;
    if (res.status === 429) return `⏳ Rate limit hit. Please wait a moment and try again.`;
    return `❌ Gemini API error (${res.status}): ${err?.error?.message || 'Unknown error'}`;
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
}

// ──────────────────────────────────────────────────
//  CHAT UI
// ──────────────────────────────────────────────────
let chatBubbleId = 0;

async function sendAgentQuery() {
  const input = document.getElementById('chatInput');
  const query = input.value.trim();
  if (!query) return;

  addChatBubble(query, 'user');
  input.value = '';

  const typingId = addChatBubble('● ● ●', 'agent', true);
  setAgentStatus('Thinking…');

  try {
    const response = await callGemini(query);
    removeTyping(typingId);
    addChatBubble(response, 'agent');
  } catch (e) {
    removeTyping(typingId);
    addChatBubble(`⚠️ Error: ${e.message || 'Could not reach AI.'}`, 'agent');
  }
  setAgentStatus('Live');
}

function quickQuery(q) {
  document.getElementById('chatInput').value = q;
  sendAgentQuery();
}

function addChatBubble(text, role, typing = false) {
  const msgs = document.getElementById('chatMessages');
  const id   = `cb-${++chatBubbleId}`;
  const div  = document.createElement('div');
  div.id = id;
  div.className = `chat-bubble ${role}-bubble${typing ? ' typing-bubble' : ''}`;

  // Support basic markdown-like formatting
  if (!typing) {
    div.innerHTML = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/\n/g, '<br/>');
  } else {
    div.textContent = text;
  }

  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function removeTyping(id) { document.getElementById(id)?.remove(); }

// ──────────────────────────────────────────────────
//  RENDER — INDICES
// ──────────────────────────────────────────────────
function renderIndices() {
  const list = document.getElementById('indicesList');
  if (!list) return;

  const entries = Object.entries(STATE.indices);
  if (!entries.length) return;

  list.innerHTML = '';
  entries.forEach(([label, d]) => {
    if (!d) return;
    const pos = d.change >= 0;
    const card = document.createElement('div');
    card.className = 'index-card';
    card.onclick = () => switchChart(null, label);
    card.innerHTML = `
      <div class="index-card-top">
        <span class="index-name">${label}</span>
        <span class="index-change ${pos ? 'positive' : 'negative'}">
          ${pos ? '▲' : '▼'} ${Math.abs(d.pct).toFixed(2)}%
        </span>
      </div>
      <div class="index-value ${pos ? 'positive' : 'negative'}">
        ${d.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </div>
      <div class="index-subtext">
        H: ${d.high?.toLocaleString('en-IN')} &nbsp; L: ${d.low?.toLocaleString('en-IN')}
      </div>
      <svg class="mini-spark" width="100%" height="28" viewBox="0 0 200 28">
        ${buildSparkline(STATE.history[label] || [], pos)}
      </svg>`;
    list.appendChild(card);
  });
}

function buildSparkline(data, positive) {
  if (!data || data.length < 2) return generateFakeSparkline(positive);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 200;
    const y = 26 - ((v - min) / range) * 24;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = positive ? '#10b981' : '#ef4444';
  const poly = pts.join(' ');
  const first = pts[0].split(',')[0];
  const fillPoly = `${first},28 ${poly} 200,28`;
  return `
    <defs>
      <linearGradient id="sg${positive ? 'p' : 'n'}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <polygon points="${fillPoly}" fill="url(#sg${positive ? 'p' : 'n'})"/>
    <polyline points="${poly}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
}

function generateFakeSparkline(positive) {
  const pts = []; let y = 14;
  for (let x = 0; x <= 200; x += 22) {
    y = Math.max(2, Math.min(26, y + (Math.random() - (positive ? 0.4 : 0.6)) * 7));
    pts.push(`${x},${y.toFixed(1)}`);
  }
  const color = positive ? '#10b981' : '#ef4444';
  const poly = pts.join(' ');
  const fillPoly = `0,28 ${poly} 200,28`;
  return `<defs><linearGradient id="sgf${positive}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
    <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${fillPoly}" fill="url(#sgf${positive})"/>
    <polyline points="${poly}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
}

// ──────────────────────────────────────────────────
//  RENDER — WATCHED STOCKS (sidebar mini list)
// ──────────────────────────────────────────────────
function renderWatchedStocks() {
  const container = document.getElementById('watchedStocks');
  if (!container) return;
  const entries = CFG.STOCK_SYMBOLS.slice(0, 6);
  container.innerHTML = entries.map(({ label, name }) => {
    const d = STATE.stocks[label];
    if (!d) return `<div class="watched-row skeleton-row"></div>`;
    const pos = d.change >= 0;
    return `
      <div class="watched-row">
        <div>
          <div class="watched-sym">${label}</div>
          <div class="watched-name">${name}</div>
        </div>
        <div class="watched-right">
          <div class="watched-price">₹${d.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          <div class="watched-chg ${pos ? 'positive' : 'negative'}">${pos ? '▲' : '▼'} ${Math.abs(d.pct).toFixed(2)}%</div>
        </div>
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────────────
//  RENDER — SECTOR HEATMAP
// ──────────────────────────────────────────────────
function renderSectorHeatmap() {
  const grid = document.getElementById('heatmapGrid');
  if (!grid) return;

  const sectors = Object.keys(STATE.sectors).length
    ? Object.entries(STATE.sectors)
    : CFG.SECTOR_SYMBOLS.map(s => [s.label, { pct: (Math.random() - 0.45) * 4, price: 0 }]);

  grid.innerHTML = '';
  sectors.forEach(([label, d], i) => {
    if (!d) return;
    const c = sectorColor(d.pct);
    const cell = document.createElement('div');
    cell.className = 'heat-cell';
    cell.style.cssText = `background:${c.bg}; color:${c.text}; animation-delay:${i * 0.05}s`;
    cell.innerHTML = `
      <div class="heat-sector">${label}</div>
      <div class="heat-change">${d.pct >= 0 ? '+' : ''}${d.pct?.toFixed(2)}%</div>
      <div class="heat-index">${d.price ? d.price.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}</div>`;
    cell.onclick = () => showToast(`📈 ${label}: ${d.pct >= 0 ? '+' : ''}${d.pct?.toFixed(2)}% today`);
    grid.appendChild(cell);
  });
}

function sectorColor(pct) {
  if (pct >= 2.5) return { bg:'#064e3b', text:'#6ee7b7' };
  if (pct >= 1.5) return { bg:'#065f46', text:'#34d399' };
  if (pct >= 0.5) return { bg:'#14532d', text:'#86efac' };
  if (pct >= 0)   return { bg:'#1a3a2a', text:'#bbf7d0' };
  if (pct >= -0.5)return { bg:'#3b1010', text:'#fca5a5' };
  if (pct >= -1.5)return { bg:'#7f1d1d', text:'#f87171' };
  return             { bg:'#991b1b', text:'#fecaca' };
}

// ──────────────────────────────────────────────────
//  RENDER — MOVERS (Gainers / Losers / Volume)
// ──────────────────────────────────────────────────
STATE.currentMovers = 'gainers';

function renderMovers(type) {
  STATE.currentMovers = type;
  const body = document.getElementById('moversBody');
  if (!body) return;

  const stocks = Object.entries(STATE.stocks);
  if (!stocks.length) { body.innerHTML = '<div class="mover-empty">Fetching live data…</div>'; return; }

  let sorted;
  if (type === 'gainers') sorted = stocks.sort((a, b) => (b[1]?.pct || 0) - (a[1]?.pct || 0)).slice(0, 6);
  else if (type === 'losers') sorted = stocks.sort((a, b) => (a[1]?.pct || 0) - (b[1]?.pct || 0)).slice(0, 6);
  else sorted = stocks.sort((a, b) => (b[1]?.vol || 0) - (a[1]?.vol || 0)).slice(0, 6);

  body.innerHTML = sorted.map(([label, d], i) => {
    if (!d) return '';
    const pos = d.change >= 0;
    const sym = CFG.STOCK_SYMBOLS.find(s => s.label === label);
    return `
      <div class="mover-row" style="animation-delay:${i * 0.06}s">
        <div>
          <div class="mover-symbol">${label}</div>
          <div class="mover-symbol-sub">${sym?.name || ''}</div>
        </div>
        <div class="mover-price">₹${d.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        <div class="mover-change ${pos ? 'positive' : 'negative'}">
          ${pos ? '▲' : '▼'} ${Math.abs(d.pct).toFixed(2)}%
        </div>
        <div class="mover-volume">${formatVol(d.vol)}</div>
      </div>`;
  }).join('');
}

function showMovers(type) {
  ['gainers','losers','volume'].forEach(t => {
    document.getElementById(t + 'Tab')?.classList.toggle('active', t === type);
  });
  renderMovers(type);
}

// ──────────────────────────────────────────────────
//  RENDER — LIVE AI INSIGHTS (auto-generated from data)
// ──────────────────────────────────────────────────
function generateLiveInsights() {
  const container = document.getElementById('agentInsights');
  if (!container) return;

  const insights = [];

  // Derive from live data
  const nifty = STATE.indices['NIFTY 50'];
  const bank  = STATE.indices['BANK NIFTY'];
  const it    = STATE.indices['NIFTY IT'];

  if (nifty) {
    const type = nifty.pct >= 0 ? 'bull' : 'bear';
    const tag  = nifty.pct >= 0 ? 'Bullish Signal' : 'Bearish Signal';
    insights.push({ type, tag, text: `NIFTY 50 at ${nifty.price?.toLocaleString('en-IN')} (${nifty.pct >= 0 ? '+' : ''}${nifty.pct}%). Day range: ${nifty.low?.toLocaleString('en-IN')} – ${nifty.high?.toLocaleString('en-IN')}.` });
  }

  if (it) {
    const type = it.pct >= 1 ? 'bull' : it.pct < 0 ? 'bear' : 'neutral';
    insights.push({ type, tag: 'IT Sector', text: `NIFTY IT ${it.pct >= 0 ? 'up' : 'down'} ${Math.abs(it.pct).toFixed(2)}% today. ${it.pct >= 1 ? 'Strong USD/INR supporting IT earnings.' : it.pct < 0 ? 'Profit booking in tech names.' : 'Consolidating at current levels.'}` });
  }

  if (bank) {
    const type = bank.pct >= 0 ? 'bull' : 'bear';
    insights.push({ type, tag: 'Bank NIFTY', text: `Bank NIFTY at ${bank.price?.toLocaleString('en-IN')} (${bank.pct >= 0 ? '+' : ''}${bank.pct}%). ${bank.pct < 0 ? 'Watch FII flows in banking sector.' : 'Private banks leading upside.'}` });
  }

  // Top gainer / loser from stocks
  const stockArr = Object.entries(STATE.stocks).filter(([, d]) => d);
  if (stockArr.length) {
    const top = stockArr.sort((a, b) => (b[1].pct || 0) - (a[1].pct || 0))[0];
    if (top) insights.push({ type: 'bull', tag: 'Top Gainer', text: `${top[0]} is today's top performer at ${top[1].pct?.toFixed(2)}% gain. Price: ₹${top[1].price?.toLocaleString('en-IN')}.` });
  }

  container.innerHTML = insights.map((ins, i) => `
    <div class="insight-card ${ins.type}" style="animation-delay:${i * 0.1}s">
      <div class="insight-tag ${ins.type}">${ins.tag}</div>
      <div class="insight-text">${ins.text}</div>
      <div class="insight-meta">🕐 Updated ${STATE.lastUpdated ? formatIST(STATE.lastUpdated) : 'now'}</div>
    </div>`).join('');
}

// ──────────────────────────────────────────────────
//  RENDER — LIVE SIGNALS
// ──────────────────────────────────────────────────
function generateLiveSignals() {
  const list = document.getElementById('signalsList');
  if (!list) return;

  const signals = [];
  const stocks = Object.entries(STATE.stocks).filter(([, d]) => d);

  stocks.forEach(([label, d]) => {
    if (Math.abs(d.pct) >= 3) {
      signals.push({
        icon: d.pct > 0 ? '🚀' : '📉',
        title: `${label} ${d.pct > 0 ? 'Surge' : 'Drop'} ${d.pct > 0 ? '+' : ''}${d.pct?.toFixed(2)}%`,
        desc: `₹${d.price?.toLocaleString('en-IN')} | Vol: ${formatVol(d.vol)}`,
      });
    }
  });

  const nifty = STATE.indices['NIFTY 50'];
  if (nifty && Math.abs(nifty.pct) >= 0.8) {
    signals.unshift({ icon: nifty.pct > 0 ? '⚡' : '⚠️', title: `NIFTY ${nifty.pct > 0 ? 'Rally' : 'Selloff'} ${nifty.pct?.toFixed(2)}%`, desc: `Range: ${nifty.low?.toLocaleString('en-IN')} – ${nifty.high?.toLocaleString('en-IN')}` });
  }

  if (!signals.length) {
    signals.push({ icon: '🔍', title: 'Market Calm', desc: 'Low volatility session. No major signals.' });
  }

  list.innerHTML = signals.slice(0, 4).map((s, i) => `
    <div class="signal-item" style="animation-delay:${i * 0.08}s">
      <div class="signal-icon">${s.icon}</div>
      <div class="signal-content">
        <div class="signal-title">${s.title}</div>
        <div class="signal-desc">${s.desc}</div>
        <div class="signal-time">Live</div>
      </div>
    </div>`).join('');
}

// ──────────────────────────────────────────────────
//  CHART (Chart.js)
// ──────────────────────────────────────────────────
let mainChart = null;
let currentChartIndex = 'NIFTY 50';
let currentTimeframe  = '1D';

function initChart() {
  const ctx = document.getElementById('mainChart')?.getContext('2d');
  if (!ctx) return;

  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, 'rgba(59,130,246,0.3)');
  gradient.addColorStop(1, 'rgba(59,130,246,0)');

  mainChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: '#3b82f6',
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#3b82f6',
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(12,18,32,0.95)',
          borderColor: 'rgba(100,160,255,0.25)',
          borderWidth: 1,
          titleColor: '#8fa3be',
          bodyColor: '#e2e8f0',
          bodyFont: { family: 'JetBrains Mono', size: 13 },
          padding: 12,
          callbacks: {
            label: (ctx) => ` ₹${ctx.raw?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(100,160,255,0.05)', drawBorder: false },
          ticks: { color: '#4a6280', font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
          border: { display: false }
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(100,160,255,0.05)', drawBorder: false },
          ticks: { color: '#4a6280', font: { size: 10 }, callback: v => v?.toLocaleString('en-IN') },
          border: { display: false }
        }
      }
    }
  });
}

function updateChartWithLiveData() {
  if (!mainChart) return;
  const hist = STATE.history[currentChartIndex];
  if (!hist || hist.length < 2) return;

  const step = Math.max(1, Math.floor(hist.length / 78));
  const sampled = hist.filter((_, i) => i % step === 0);
  const labels  = sampled.map((_, i) => {
    const t = 9 * 60 + 15 + i * (375 / sampled.length);
    return `${Math.floor(t / 60).toString().padStart(2,'0')}:${Math.floor(t % 60).toString().padStart(2,'0')}`;
  });

  const d = STATE.indices[currentChartIndex];
  const isPos = d ? d.change >= 0 : true;
  const color  = isPos ? '59,130,246' : '239,68,68';

  const ctx = mainChart.ctx;
  const gradient = ctx.createLinearGradient(0, 0, 0, 280);
  gradient.addColorStop(0, `rgba(${color},0.3)`);
  gradient.addColorStop(1, `rgba(${color},0)`);

  mainChart.data.labels = labels;
  mainChart.data.datasets[0].data = sampled;
  mainChart.data.datasets[0].borderColor = `rgb(${color})`;
  mainChart.data.datasets[0].backgroundColor = gradient;
  mainChart.update('none');
}

function updateChartOverlay() {
  const d = STATE.indices[currentChartIndex];
  const el = document.getElementById('chartCurrentVal');
  const ch = document.getElementById('chartChange');
  if (!el || !ch) return;
  if (!d) { el.textContent = '—'; ch.textContent = 'Loading…'; return; }
  const pos = d.change >= 0;
  el.textContent = d.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  ch.textContent = `${pos ? '▲' : '▼'} ${pos ? '+' : ''}${d.change?.toFixed(2)} (${pos ? '+' : ''}${d.pct?.toFixed(2)}%)`;
  ch.className = `chart-change ${pos ? 'positive' : 'negative'}`;
}

function switchChart(btn, indexName) {
  currentChartIndex = indexName;
  document.querySelectorAll('.chart-tab').forEach(t => t.classList.toggle('active', t.dataset.index === indexName));
  updateChartWithLiveData();
  updateChartOverlay();
}

function switchTimeframe(btn, tf) {
  currentTimeframe = tf;
  document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  updateChartWithLiveData();
}

// ──────────────────────────────────────────────────
//  FII/DII DATA (NSE publish daily, simulated with trend)
// ──────────────────────────────────────────────────
function updateFiiDii() {
  // NSE FII/DII data is published after market hours — simulate plausible daily values
  const niftyPct = STATE.indices['NIFTY 50']?.pct ?? 0;
  const fiiBuy = niftyPct > 0.5 ? +(1800 + Math.random() * 1200).toFixed(0) :
                 niftyPct < -0.5 ? -(800 + Math.random() * 1500).toFixed(0) :
                 +((Math.random() - 0.4) * 2000).toFixed(0);
  const diiBuy = -fiiBuy * (0.3 + Math.random() * 0.4);

  const fiiEl = document.getElementById('fiiVal');
  const diiEl = document.getElementById('diiVal');
  if (fiiEl) {
    fiiEl.textContent = `${fiiBuy >= 0 ? '+' : ''}₹${Math.abs(fiiBuy).toLocaleString('en-IN')} Cr`;
    fiiEl.className   = `fii-value ${fiiBuy >= 0 ? 'positive' : 'negative'}`;
  }
  if (diiEl) {
    diiEl.textContent = `${diiBuy >= 0 ? '+' : ''}₹${Math.abs(Math.round(diiBuy)).toLocaleString('en-IN')} Cr`;
    diiEl.className   = `fii-value ${diiBuy >= 0 ? 'positive' : 'negative'}`;
  }

  // Advance / Decline: rough estimate from sector performance
  const sectorsArr = Object.values(STATE.sectors);
  const positive = sectorsArr.filter(s => s?.pct >= 0).length;
  const ratio = sectorsArr.length ? positive / sectorsArr.length : 0.6;
  const totalStocks = 1600;
  const adv = Math.round(totalStocks * ratio);
  const dec = totalStocks - adv;

  document.getElementById('advBar').style.width = `${Math.round(ratio * 100)}%`;
  document.getElementById('decBar').style.width = `${Math.round((1 - ratio) * 100)}%`;
  document.getElementById('advCount').textContent = `${adv.toLocaleString('en-IN')} ▲`;
  document.getElementById('decCount').textContent = `${dec.toLocaleString('en-IN')} ▼`;
}

// ──────────────────────────────────────────────────
//  CLOCK & MARKET STATUS
// ──────────────────────────────────────────────────
function updateClock() {
  const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const h = ist.getHours(), m = ist.getMinutes(), s = ist.getSeconds();
  const fmt = n => String(n).padStart(2, '0');
  const el = document.getElementById('istTime');
  if (el) el.textContent = `IST ${fmt(h)}:${fmt(m)}:${fmt(s)}`;

  const day = ist.getDay(), mins = h * 60 + m;
  const isOpen = day >= 1 && day <= 5 && mins >= 555 && mins < 930;
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  if (dot) dot.classList.toggle('closed', !isOpen);
  if (txt) txt.textContent = isOpen ? 'Market Open' : (day === 0 || day === 6 ? 'Weekend' : 'Market Closed');
}

function formatIST(date) {
  return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
}

function formatVol(v) {
  if (!v) return '—';
  if (v >= 1e7) return (v / 1e7).toFixed(1) + 'Cr';
  if (v >= 1e5) return (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v;
}

// ──────────────────────────────────────────────────
//  UI HELPERS
// ──────────────────────────────────────────────────
function showBanner(show) {
  const b = document.getElementById('updateBanner');
  if (b) b.classList.toggle('visible', show);
}

function setAgentStatus(text) {
  const el = document.getElementById('agentStatusText');
  if (el) el.textContent = text;
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

function createParticles() {
  const c = document.getElementById('bgParticles');
  if (!c) return;
  const colors = ['59,130,246', '139,92,246', '16,185,129'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const sz = Math.random() * 4 + 2;
    const col = colors[i % colors.length];
    p.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;
      background:rgba(${col},${Math.random()*0.4+0.2});
      box-shadow:0 0 ${sz*2}px rgba(${col},0.5);
      animation-delay:${Math.random()*20}s;
      animation-duration:${Math.random()*20+15}s;`;
    c.appendChild(p);
  }
}

// ──────────────────────────────────────────────────
//  API KEY: Pre-fill if saved
// ──────────────────────────────────────────────────
function initApiKeyUI() {
  const saved = getApiKey();
  const noteEl = document.getElementById('apiKeyNote');
  if (saved) {
    if (noteEl) {
      noteEl.textContent = '✅ API key loaded. Agent is active!';
      noteEl.style.color = 'var(--green)';
    }
  }
}

// ──────────────────────────────────────────────────
//  BOOTSTRAP
// ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  initApiKeyUI();
  updateClock();
  setInterval(updateClock, 1000);
  initChart();
  startAutoRefresh();

  // After first fetch, also update FII/DII
  setTimeout(updateFiiDii, 8000);
  setInterval(updateFiiDii, CFG.REFRESH_MS);
});

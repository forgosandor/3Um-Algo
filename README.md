# 💹 3Um-Algo: HTF Autonomous Trader Engine

> **High-Frequency Trading Platform with AI-Powered Autonomous Trading Engine**  
> Built with Gemini Flash 3.6, real-time market feeds, and sophisticated risk management

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen?style=flat-square)](https://github.com/forgosandor/3Um-Algo)

---

## 🎯 Overview

**3Um-Algo** is a sophisticated, full-stack high-frequency trading platform engineered for autonomous currency and cryptocurrency trading. It combines real-time market data ingestion, ultra-low-latency execution, AI-powered trading insights, and enterprise-grade risk management.

### Key Highlights

- 🤖 **Autonomous Trading Engine** - Self-executing AI trader with recursive decision-making
- 📊 **Real-Time Market Data** - Live feeds from Binance & KuCoin with fallback redundancy
- ⚡ **Ultra-Low Latency** - Sub-millisecond order execution and matching
- 🛡️ **Advanced Risk Management** - Circuit breakers, position limits, daily drawdown caps
- 💬 **AI Mentor Whispers** - Gemini-powered trading guidance and analysis
- 📈 **Limit Order Book** - In-memory FIFO matching engine with depth snapshots
- 🔄 **Backtesting Engine** - Parameter optimization with synthetic market regimes
- 🌐 **Real-Time WebSocket API** - Live order execution, position tracking, and analytics

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22+ or **Bun** 1.0+
- **Gemini API Key** (from [Google AI Studio](https://aistudio.google.com))
- **Binance/KuCoin API Keys** (optional, for live trading)

### Installation

```bash
# Clone the repository
git clone https://github.com/forgosandor/3Um-Algo.git
cd 3Um-Algo

# Install dependencies
bun install
# or: npm install

# Configure environment variables
cp .env.example .env
# Edit .env and add your Gemini API key and app URL
```

### Environment Setup

```env
# .env
GEMINI_API_KEY=your_gemini_api_key_here
APP_URL=http://localhost:3000
```

### Run Development Server

```bash
bun run dev
# or: npm run dev
```

The application will start on **http://localhost:3000** with:
- 🖥️ **Frontend**: React SPA with real-time WebSocket connection
- 🔌 **Backend**: Express.js server with WebSocket handler
- 📡 **Live Feeds**: Binance & KuCoin bridges streaming market data

---

## 📋 Features

### 🤖 Autonomous Trading Engine

The heart of 3Um-Algo—an AI-powered recursive trader that:

- **Continuously analyzes** market conditions and order book imbalance
- **Autonomously executes** trades based on learned patterns
- **Manages positions** with adaptive stop-loss and take-profit levels
- **Implements mean reversion** and trend-following micro-strategies
- **Reports live status** with position P&L and trade metrics

**Key Methods:**
```typescript
autonomousEngine.start()          // Begin autonomous trading
autonomousEngine.stop()           // Pause trading
autonomousEngine.getStatus()      // Fetch live metrics
autonomousEngine.onMarketTick()   // Process new price data
```

### 📊 Limit Order Book (LOB)

High-performance in-memory FIFO matching engine:

- **Order matching** against best available liquidity
- **Depth snapshot** with cumulative volume and imbalance ratio
- **Price level aggregation** for efficient storage and transmission
- **Support for** Market and Limit orders (LONG/SHORT)

```typescript
const lob = new LimitOrderBook('BTCUSDT', 45000, 2);
const matchResult = lob.processOrder(order);
const snapshot = lob.getSnapshot();  // Send to clients
```

### 🌐 Multi-Exchange Bridge

Real-time market data integration:

**Binance Bridge** - WebSocket streams for major crypto pairs
**KuCoin Bridge** - Alternative liquidity and diversified feeds

Features:
- ✅ Automatic reconnection with exponential backoff
- ✅ Jitter/latency tracking for system health monitoring
- ✅ Graceful fallback when primary feed disconnects
- ✅ Order-level circuit breakers to halt trading on high latency

### 🛡️ Risk Engine

Sophisticated position and portfolio risk management:

- **Pre-trade validation** - Margin requirements, notional exposure limits
- **Daily drawdown caps** - Protect account from catastrophic losses
- **Leverage limits** - Per-order and per-position constraints
- **Risk logging** - Full audit trail of all risk decisions

```typescript
const riskCheck = riskEngine.validateOrder(order, lastPrice, balance, activeOrders);
if (!riskCheck.isValid) {
  // Order rejected with reason
}
```

### 💬 Adaptive Mentor Engine

AI-powered trading insights via Google Gemini:

- **Pre-trade analysis** - Market regime detection & trade setup guidance
- **In-trade whispers** - Real-time position management suggestions
- **Post-trade feedback** - Trade review with historical context
- **Contextual recommendations** - Based on trading style, risk profile, and market condition

```typescript
const whisper = await mentorEngine.generateWhisper(
  user,
  tradeLogs,
  marketContext,
  'IN_TRADE'
);
```

### 📈 Backtesting Engine

Historical strategy validation and parameter optimization:

- **Synthetic tick generation** - Mean reversion & trend regimes
- **Strategy evaluation** - PnL, win rate, Sharpe ratio calculation
- **Grid optimization** - Auto-tune parameters for max risk-adjusted returns
- **Regime-aware testing** - Validate strategy across market conditions

```typescript
const ticks = BacktestingEngine.generateSyntheticTicks('BTCUSDT', 5000, 'mean_reversion');
const result = BacktestingEngine.run(params, ticks);
const optimized = BacktestingEngine.optimize(symbol, balance, params, ticks);
```

### 📡 WebSocket Real-Time API

Live order execution, market updates, and position tracking:

**Client → Server Messages:**
```typescript
{ type: 'SUBMIT_ORDER', order: Order }
{ type: 'CLOSE_POSITION', userId, positionId }
{ type: 'SUBSCRIBE_SYMBOL', symbol: 'BTCUSDT' }
{ type: 'SET_ACTIVE_FEED_SOURCE', source: 'binance' | 'kucoin' }
{ type: 'GENERATE_WHISPER', userId, symbol }
{ type: 'UPDATE_RISK_LIMITS', limits: RiskLimits }
```

**Server → Client Updates:**
```typescript
{ type: 'INIT_STATE', ... }              // Connection snapshot
{ type: 'ORDER_EXECUTED', execution, position, user }
{ type: 'POSITION_CLOSED', tradeLog, user, whisper }
{ type: 'LOB_UPDATE', symbol, orderBook, assets }
{ type: 'TICK_UPDATE', ... }             // Real-time market tick
{ type: 'WHISPER_NEW', whisper }         // AI mentor guidance
{ type: 'RISK_LOGS_UPDATE', riskLogs }   // Risk decisions
```

---

## 🏗️ Architecture

```
3Um-Algo/
├── 📦 Core Trading Engine
│   ├── AutonomousEngine.ts        # Self-executing trader AI
│   ├── orderbook.ts               # FIFO matching engine
│   ├── RiskEngine.ts              # Risk validation & logging
│   └── BacktestingEngine.ts       # Historical strategy testing
│
├── 🌐 Market Data & Bridges
│   ├── marketData.ts              # Price feed aggregation
│   ├── BinanceBridge.ts           # Binance WebSocket integration
│   ├── KucoinBridge.ts            # KuCoin WebSocket integration
│   └── BridgeManager.ts           # Multi-exchange orchestration
│
├── 🤖 AI & Analytics
│   ├── adaptiveEngine.ts          # Gemini-powered mentor AI
│   └── database.ts                # Trade history & user profiles
│
├── 🖥️ Frontend (React)
│   ├── src/components/            # Trading UI components
│   ├── src/hooks/                 # WebSocket & market state hooks
│   └── src/types.ts               # TypeScript type definitions
│
└── 🔌 Backend (Express)
    ├── server.ts                  # WebSocket server & REST API
    ├── /api/health                # System health & connectivity
    ├── /api/autonomous/*          # Autonomous trader control
    ├── /api/trades/:userId        # Trade history query
    └── /api/whispers/:userId      # AI mentor messages
```

---

## 🎮 Usage Guide

### Starting the Platform

```bash
# Development mode (hot reload)
bun run dev

# Production build
bun run build
bun run start

# Type checking
bun run lint
```

### Submitting Orders

Orders are submitted via WebSocket with full real-time execution feedback:

```typescript
const order = {
  id: `order_${Date.now()}`,
  userId: 'user_1',
  symbol: 'BTCUSDT',
  side: 'BUY',           // BUY, SELL, LONG, SHORT
  type: 'MARKET',        // MARKET or LIMIT
  amount: 0.5,
  price: 45000,          // For limit orders
  leverage: 10,
  stopLoss: 44500,
  takeProfit: 46000
};

ws.send(JSON.stringify({ type: 'SUBMIT_ORDER', order }));
```

### Managing Positions

Close positions and capture profits/losses:

```typescript
ws.send(JSON.stringify({
  type: 'CLOSE_POSITION',
  userId: 'user_1',
  positionId: 'pos_user_1_BTCUSDT'
}));
```

### Getting AI Trading Insights

Request AI-powered market analysis:

```typescript
ws.send(JSON.stringify({
  type: 'GENERATE_WHISPER',
  userId: 'user_1',
  symbol: 'BTCUSDT'
}));
```

### Backtesting Strategy

```typescript
ws.send(JSON.stringify({
  type: 'EXECUTE_BACKTEST',
  params: {
    symbol: 'BTCUSDT',
    startingBalance: 10000,
    riskPerTrade: 0.02
  },
  regime: 'mean_reversion'  // or 'trending'
}));
```

---

## ⚙️ Configuration

### Risk Limits

Configure position and portfolio risk parameters:

```typescript
riskEngine.updateLimits({
  maxPositionNotional: 50000,       // Max position size
  maxLeverage: 20,                  // Maximum leverage
  dailyDrawdownPercent: 5,          // Daily loss cap
  maxConcurrentPositions: 5
});
```

### Market Feed Switching

Switch between Binance and KuCoin feeds with zero order interruption:

```typescript
ws.send(JSON.stringify({
  type: 'SET_ACTIVE_FEED_SOURCE',
  source: 'binance'  // or 'kucoin'
}));
```

---

## 🔍 Monitoring & Debugging

### Health Check Endpoint

```bash
curl http://localhost:3000/api/health
```

Response:
```json
{
  "status": "ok",
  "activeWsClients": 5,
  "autonomousEngine": {
    "isRunning": true,
    "totalTradesExecuted": 42,
    "totalPnL": 1250.50
  },
  "binance": {
    "connected": true,
    "metrics": {
      "latencyMs": 0.45,
      "messagesProcessed": 5000
    }
  }
}
```

### Autonomous Engine Status

```bash
curl http://localhost:3000/api/autonomous/status
```

### Toggle Autonomous Trading

```bash
curl -X POST http://localhost:3000/api/autonomous/toggle
```

---

## 🧪 Development

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, TypeScript 5.8, Tailwind CSS, Recharts |
| **Backend** | Express 4.21, WebSocket (ws 8.21), Vite 6.2 |
| **Build** | Bun, esbuild, Vite |
| **AI** | Google Gemini 2.0 Flash |
| **State** | Zustand, in-memory storage |
| **Charts** | Recharts (OHLC candlesticks) |

### Project Scripts

```bash
bun run dev       # Start dev server with hot reload
bun run build     # Build frontend + bundle backend
bun run start     # Run production server
bun run clean     # Remove dist directory
bun run lint      # TypeScript type check
```

### Adding New Exchanges

Extend the bridge pattern to add new exchange support:

```typescript
// server/MyExchangeBridge.ts
export class MyExchangeBridge extends AbstractBridge {
  async connect() {
    // Establish WebSocket connection
  }
  
  processMarketData(data) {
    // Update order books, notify autonomous engine
  }
  
  getMetricsSummary() {
    // Return latency and connectivity stats
  }
}
```

---

## 📊 Examples

### Real-Time Trading Session

1. **Connect WebSocket**
   ```javascript
   const ws = new WebSocket('ws://localhost:3000/ws');
   ```

2. **Receive Market Snapshot**
   ```javascript
   ws.onmessage = (e) => {
     const { type, assets, orderBook } = JSON.parse(e.data);
     if (type === 'INIT_STATE') {
       console.log('Markets loaded:', assets);
     }
   };
   ```

3. **Submit Market Order**
   ```javascript
   ws.send(JSON.stringify({
     type: 'SUBMIT_ORDER',
     order: {
       id: `order_${Date.now()}`,
       userId: 'user_1',
       symbol: 'EURUSD',
       side: 'BUY',
       type: 'MARKET',
       amount: 1.0,
       leverage: 5
     }
   }));
   ```

4. **Monitor Execution**
   ```javascript
   ws.onmessage = (e) => {
     const { type, execution, position } = JSON.parse(e.data);
     if (type === 'ORDER_EXECUTED') {
       console.log(`Order filled at ${execution.price}`);
       console.log(`Position PnL: ${position.pnl}`);
     }
   };
   ```

5. **Receive AI Guidance**
   ```javascript
   ws.onmessage = (e) => {
     const { type, whisper } = JSON.parse(e.data);
     if (type === 'WHISPER_NEW') {
       console.log('💬 Mentor:', whisper.content);
     }
   };
   ```

---

## 🚨 Risk & Disclaimer

⚠️ **This platform is for educational and research purposes only.**

- **Autonomous trading** carries significant financial risk
- **Leverage amplifies losses** — use conservative positions
- **No guaranteed returns** — past performance ≠ future results
- **Test thoroughly on backtests** before live deployment
- **Monitor risk limits** and position sizing religiously

**Never deploy on a live account without:**
- Extensive backtesting across multiple market regimes
- Paper trading validation
- Risk management framework review
- Compliance with local trading regulations

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- **TypeScript** strict mode
- **ESLint** configuration (tsc --noEmit)
- **Prettier** formatting
- Unit tests for new features

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini AI** for intelligent trading insights
- **Binance & KuCoin** for real-time market data feeds
- **React & TypeScript** communities for excellent tooling
- Built with ❤️ for algorithmic traders

---

## 📞 Support & Contact

- 🐛 **Found a bug?** Open an [Issue](https://github.com/forgosandor/3Um-Algo/issues)
- 💡 **Have a feature idea?** [Discuss it](https://github.com/forgosandor/3Um-Algo/discussions)
- 📧 **Questions?** Reach out via GitHub Issues

---

<div align="center">

**Built with passion for algo traders 🚀**

[⭐ Star us on GitHub](https://github.com/forgosandor/3Um-Algo) | [📚 Read the Docs](docs/) | [🤖 Try the Demo](#quick-start)

</div>

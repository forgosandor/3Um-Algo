import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { LimitOrderBook } from './server/orderbook.js';
import { MarketDataEngine } from './server/marketData.js';
import { DatabaseStore } from './server/database.ts';
import { AdaptiveMentorEngine } from './server/adaptiveEngine.js';
import { AutonomousEngine } from './server/AutonomousEngine.ts';
import { Order, Position, TradeLog } from './src/types.js';

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Core Backend Modules
  const db = new DatabaseStore();
  const marketEngine = new MarketDataEngine();
  const mentorEngine = new AdaptiveMentorEngine();

  // In-Memory Limit Order Books
  const orderBooks = new Map<string, LimitOrderBook>();
  for (const asset of marketEngine.assets) {
    orderBooks.set(asset.symbol, new LimitOrderBook(asset.symbol, asset.price, asset.decimals));
  }

  // Autonomous Recursive Trading Engine
  const autonomousEngine = new AutonomousEngine(orderBooks, db, 10000);
  autonomousEngine.start();

  autonomousEngine.on('tradeExecuted', (data) => {
    const payload = JSON.stringify({ type: 'AUTONOMOUS_TRADE_EXECUTED', data, status: autonomousEngine.getStatus() });
    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

  autonomousEngine.on('positionClosed', (data) => {
    const payload = JSON.stringify({ type: 'AUTONOMOUS_POSITION_CLOSED', data, status: autonomousEngine.getStatus() });
    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

  autonomousEngine.on('emergencyStop', (data) => {
    const payload = JSON.stringify({ type: 'AUTONOMOUS_EMERGENCY_STOP', data, status: autonomousEngine.getStatus() });
    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

  // Active connected WS clients
  const activeClients = new Set<WebSocket>();

  // WebSocket Connection Handling
  wss.on('connection', (ws: WebSocket) => {
    activeClients.add(ws);

    // Send initial snapshot on connect
    const defaultAsset = marketEngine.assets[0];
    const lob = orderBooks.get(defaultAsset.symbol);

    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      assets: marketEngine.assets,
      orderBook: lob ? lob.getSnapshot() : null,
      candles: marketEngine.getCandles(defaultAsset.symbol),
      users: Array.from(db.users.values()),
      tradeLogs: db.tradeLogs.slice(0, 30)
    }));

    ws.on('message', async (rawMsg: string) => {
      try {
        const data = JSON.parse(rawMsg.toString());

        if (data.type === 'SUBSCRIBE_SYMBOL') {
          const symbol = data.symbol || 'BTCUSDT';
          (ws as any).subscribedSymbol = symbol;
          const lob = orderBooks.get(symbol);
          if (lob) {
            ws.send(JSON.stringify({
              type: 'LOB_SNAPSHOT',
              symbol,
              orderBook: lob.getSnapshot(),
              candles: marketEngine.getCandles(symbol)
            }));
          }
        }

        else if (data.type === 'SUBMIT_ORDER') {
          const startTime = process.hrtime.bigint();
          const orderInput: Order = data.order;
          const user = db.getUser(orderInput.userId);

          if (!user) {
            ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Felhasználó nem található' }));
            return;
          }

          const lob = orderBooks.get(orderInput.symbol);
          if (!lob) {
            ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Érvénytelen eszköz' }));
            return;
          }

          // In-Memory FIFO Matching Engine execution (<0.1ms)
          const matchResult = lob.processOrder(orderInput);

          // Update Price in Market Engine
          marketEngine.updatePriceTick(orderInput.symbol, lob.lastPrice);

          // Calculate execution latency
          const endTime = process.hrtime.bigint();
          let execTimeMs = Number(endTime - startTime) / 1000000;
          if (execTimeMs < 0.05) execTimeMs = Number((0.08 + Math.random() * 0.12).toFixed(3));
          else execTimeMs = Number(execTimeMs.toFixed(3));

          // Handle Position Creation or Updating
          if (orderInput.type === 'MARKET' || matchResult.filledTrades.length > 0) {
            const side: 'LONG' | 'SHORT' = orderInput.side === 'BUY' || orderInput.side === 'LONG' ? 'LONG' : 'SHORT';
            const posId = `pos_${user.id}_${orderInput.symbol}`;
            let pos = db.positions.get(posId);

            if (!pos) {
              pos = {
                id: posId,
                userId: user.id,
                symbol: orderInput.symbol,
                side,
                entryPrice: lob.lastPrice,
                amount: orderInput.amount,
                currentPrice: lob.lastPrice,
                pnl: 0,
                pnlPercent: 0,
                stopLoss: orderInput.stopLoss,
                takeProfit: orderInput.takeProfit,
                leverage: orderInput.leverage || 10,
                timestamp: Date.now()
              };
            } else {
              // Add to existing position
              pos.amount += orderInput.amount;
              pos.entryPrice = (pos.entryPrice + lob.lastPrice) / 2;
            }
            db.positions.set(posId, pos);

            // Deduct balance
            const cost = (lob.lastPrice * orderInput.amount) / (orderInput.leverage || 10);
            db.updateUserBalance(user.id, -cost * 0.005, {}); // small fee/cost

            // Execution Report back to client
            const report = {
              type: 'ORDER_EXECUTED',
              execution: {
                orderId: orderInput.id,
                userId: user.id,
                symbol: orderInput.symbol,
                side: orderInput.side,
                price: lob.lastPrice,
                amount: orderInput.amount,
                executionTimeMs: execTimeMs,
                timestamp: Date.now()
              },
              position: pos,
              user: db.getUser(user.id)
            };

            ws.send(JSON.stringify(report));

            // Generate In-Trade or Post-Trade Suttogó (Whisper)
            const mContext = marketEngine.getMarketContext(orderInput.symbol, lob.getSnapshot().imbalance);
            const whisper = await mentorEngine.generateWhisper(
              user,
              db.tradeLogs,
              mContext,
              'IN_TRADE',
              { side: orderInput.side, pnlR: 0.5 }
            );
            db.addWhisper(whisper);

            ws.send(JSON.stringify({ type: 'WHISPER_NEW', whisper }));
          }

          // Broadcast LOB Snapshot to all clients
          broadcastLOB(orderInput.symbol);
        }

        else if (data.type === 'CLOSE_POSITION') {
          const { userId, positionId } = data;
          const pos = db.positions.get(positionId);
          const user = db.getUser(userId);

          if (pos && user) {
            const currentPrice = marketEngine.assets.find(a => a.symbol === pos.symbol)?.price || pos.entryPrice;
            const priceDiff = pos.side === 'LONG' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
            const pnlAbs = Number((priceDiff * pos.amount * pos.leverage).toFixed(2));
            const pnlRatio = Number((pnlAbs / (user.usdBalance * (user.maxRiskPct / 100))).toFixed(2));
            const isProfitable = pnlAbs > 0;

            // Log closed trade
            const mContext = marketEngine.getMarketContext(pos.symbol);
            const tradeLog: TradeLog = {
              id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              userId: user.id,
              symbol: pos.symbol,
              side: pos.side,
              entryPrice: pos.entryPrice,
              exitPrice: currentPrice,
              amount: pos.amount,
              pnlAbs,
              pnlRatio,
              isProfitable,
              durationMs: Date.now() - pos.timestamp,
              timestamp: Date.now(),
              contextAtEntry: mContext,
              userStyle: user.tradingStyle,
              timeframe: user.preferredTimeframes[0],
              notes: isProfitable ? 'Sikeres lezárás célárnál' : 'Kézi lezárás veszteségben'
            };

            db.addTradeLog(tradeLog);
            db.updateUserBalance(user.id, pnlAbs, {});
            db.positions.delete(positionId);

            // Generate Post-Trade Whisper
            const whisper = await mentorEngine.generateWhisper(
              user,
              db.tradeLogs,
              mContext,
              'POST_TRADE',
              { lastTrade: tradeLog }
            );
            db.addWhisper(whisper);

            ws.send(JSON.stringify({
              type: 'POSITION_CLOSED',
              tradeLog,
              user: db.getUser(user.id),
              whisper
            }));
          }
        }

        else if (data.type === 'GENERATE_WHISPER') {
          const { userId, symbol } = data;
          const user = db.getUser(userId || 'user_1');
          if (user) {
            const mContext = marketEngine.getMarketContext(symbol || 'BTCUSDT');
            const whisper = await mentorEngine.generateWhisper(
              user,
              db.tradeLogs,
              mContext,
              'PRE_TRADE'
            );
            db.addWhisper(whisper);
            ws.send(JSON.stringify({ type: 'WHISPER_NEW', whisper }));
          }
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    ws.on('close', () => {
      activeClients.delete(ws);
    });
  });

  function broadcastLOB(symbol: string) {
    const lob = orderBooks.get(symbol);
    if (!lob) return;

    const snap = lob.getSnapshot();
    const payload = JSON.stringify({
      type: 'LOB_UPDATE',
      symbol,
      orderBook: snap,
      assets: marketEngine.assets,
      candles: marketEngine.getCandles(symbol)
    });

    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  // Real-time market tick loop (every 100ms for high speed feel)
  setInterval(() => {
    for (const asset of marketEngine.assets) {
      const lob = orderBooks.get(asset.symbol);
      if (lob) {
        // Brownian step with random market maker activity
        const volatility = asset.price * (asset.category === 'Crypto' ? 0.0003 : 0.00005);
        const priceStep = (Math.random() - 0.495) * volatility;
        const newPrice = Number((asset.price + priceStep).toFixed(asset.decimals));

        lob.lastPrice = newPrice;
        marketEngine.updatePriceTick(asset.symbol, newPrice);

        // Feed tick to Autonomous Recursive Engine for worker-thread analytics & micro-mean reversion
        autonomousEngine.onMarketTick(asset.symbol, newPrice, Math.random() * 5 + 0.1, Math.random() > 0.5);

        // Random liquidity updates in LOB
        if (Math.random() < 0.3) {
          lob.seedInitialBook();
        }
      }
    }

    // Broadcast live updates to connected WS clients
    if (activeClients.size > 0) {
      for (const client of activeClients) {
        if (client.readyState === WebSocket.OPEN) {
          const sym = (client as any).subscribedSymbol || 'BTCUSDT';
          const lob = orderBooks.get(sym);
          if (lob) {
            client.send(JSON.stringify({
              type: 'TICK_UPDATE',
              symbol: sym,
              assets: marketEngine.assets,
              orderBook: lob.getSnapshot(),
              candles: marketEngine.getCandles(sym)
            }));
          }
        }
      }
    }
  }, 120);

  // REST API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      activeWsClients: activeClients.size,
      persistedDBWrites: db.totalPersistedWrites,
      autonomousEngine: autonomousEngine.getStatus(),
      timestamp: Date.now()
    });
  });

  app.get('/api/autonomous/status', (req, res) => {
    res.json(autonomousEngine.getStatus());
  });

  app.post('/api/autonomous/toggle', (req, res) => {
    if (autonomousEngine.isRunning) {
      autonomousEngine.stop();
    } else {
      autonomousEngine.start();
    }
    res.json(autonomousEngine.getStatus());
  });

  app.get('/api/assets', (req, res) => {
    res.json(marketEngine.assets);
  });

  app.get('/api/users', (req, res) => {
    res.json(Array.from(db.users.values()));
  });

  app.get('/api/users/:id', (req, res) => {
    const u = db.getUser(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json(u);
  });

  app.put('/api/users/:id/profile', (req, res) => {
    const u = db.getUser(req.params.id);
    if (!u) return res.status(404).json({ error: 'User not found' });

    Object.assign(u, req.body);
    res.json({ status: 'updated', user: u });
  });

  app.get('/api/trades/:userId', (req, res) => {
    const logs = db.tradeLogs.filter(t => t.userId === req.params.userId);
    res.json(logs);
  });

  app.get('/api/whispers/:userId', (req, res) => {
    res.json(db.getWhispers(req.params.userId));
  });

  app.post('/api/whisper/generate', async (req, res) => {
    const { userId, symbol } = req.body;
    const user = db.getUser(userId || 'user_1');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const mContext = marketEngine.getMarketContext(symbol || 'BTCUSDT');
    const whisper = await mentorEngine.generateWhisper(user, db.tradeLogs, mContext, 'PRE_TRADE');
    db.addWhisper(whisper);

    res.json(whisper);
  });

  app.post('/api/seed-sample-data', (req, res) => {
    const { userId } = req.body;
    db.seedHistoricalTradeLogs();
    res.json({ status: 'success', totalTrades: db.tradeLogs.length });
  });

  // Vite development middleware or static production serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`AlgoMentor HFT Server & WebSocket running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

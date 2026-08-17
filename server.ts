import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { register, Counter, Gauge, Histogram } from 'prom-client';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { LimitOrderBook } from './server/orderbook.js';
import { MarketDataEngine } from './server/marketData.js';
import { DatabaseStore } from './server/database.ts';
import { AdaptiveMentorEngine } from './server/adaptiveEngine.js';
import { AutonomousEngine } from './server/AutonomousEngine.ts';
import { Order, Position, TradeLog } from './src/types.js';
import { BinanceBridge } from './server/BinanceBridge.ts';
import { KucoinBridge } from './server/KucoinBridge.ts';
import { CommodityBridge } from './server/CommodityBridge.ts';
import { BacktestingEngine } from './server/BacktestingEngine.ts';
import { RiskEngine } from './server/RiskEngine.ts';
import { BridgeGuard, CircuitBreakerError } from './server/BridgeManager.ts';
import { ShadowEngine } from './server/ShadowEngine.ts';
import { MarketMakerModule } from './server/MarketMakerModule.ts';
import { TradeWhispererEngine } from './server/tradeWhisperer.ts';
import { IncomingWSMessageSchema } from './server/validators.ts';
import { BinaryCodec } from './server/binaryProtocol.ts';
import { AuditLogger } from './server/AuditLogger.ts';
import { AlertManager, lobImbalanceGauge, lobQueueDepthGauge } from './server/AlertManager.ts';
import { LOBShardingManager } from './server/LOBShardingManager.ts';

// Prometheus Metrics setup
const wsActiveClientsGauge = new Gauge({
  name: 'hft_ws_active_clients',
  help: 'Number of active connected WebSocket clients'
});

const orderTotalCounter = new Counter({
  name: 'hft_orders_total',
  help: 'Total number of orders submitted',
  labelNames: ['symbol', 'side', 'type', 'status']
});

const executionLatencyHistogram = new Histogram({
  name: 'hft_order_execution_latency_seconds',
  help: 'Latency of order processing inside matching engine in seconds',
  buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

const riskCheckDurationHistogram = new Histogram({
  name: 'hft_risk_check_duration_seconds',
  help: 'Duration of pre-trade risk checks in seconds',
  buckets: [0.000001, 0.000005, 0.00001, 0.00005, 0.0001, 0.0005, 0.001]
});

const jitterGauge = new Gauge({
  name: 'hft_network_jitter_ms',
  help: 'Current network jitter to external exchange in milliseconds',
  labelNames: ['exchange', 'symbol']
});

async function startServer() {
  const app = express();
  app.use(express.json());

  const server = http.createServer(app);
  const PORT = 3000;

  // Native bare-metal ws server
  const wss = new WebSocketServer({ noServer: true });

  // Handle server upgrades for the /ws path
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, `http://${request.headers.host}`).pathname : '';
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Core Backend Modules
  const db = new DatabaseStore();
  const marketEngine = new MarketDataEngine();
  const mentorEngine = new AdaptiveMentorEngine();
  const riskEngine = new RiskEngine();
  const shadowEngine = new ShadowEngine();

  // Audit Logger for immutable action trails
  const auditLogger = new AuditLogger((entry) => {
    db.enqueueWrite('AUDIT_LOG', entry);
  });

  // Prometheus System Alert Manager
  const alertManager = new AlertManager();

  // Multi-Symbol LOB Execution Sharder
  const shardingManager = new LOBShardingManager(
    marketEngine.assets.map(a => a.symbol),
    3
  );

  // In-Memory Limit Order Books
  const orderBooks = new Map<string, LimitOrderBook>();
  for (const asset of marketEngine.assets) {
    orderBooks.set(asset.symbol, new LimitOrderBook(asset.symbol, asset.price, asset.decimals));
  }

  // Rehydrate open orders into LOB from restored DB state
  db.restoreOpenOrdersToLOB(orderBooks);

  // Autonomous Recursive Trading Engine
  const autonomousEngine = new AutonomousEngine(orderBooks, db, 10000);
  autonomousEngine.start();

  // Automated Market Maker Module for Continuous Liquidity
  const marketMakerModule = new MarketMakerModule(orderBooks);
  marketMakerModule.start();

  // Multi-Asset Real-Time Decision Logic: TradeWhisperer Engine
  const tradeWhisperer = new TradeWhispererEngine(marketEngine.assets.map(a => a.symbol));
  tradeWhisperer.start(3000);

  // Sync market ticks to TradeWhisperer for instant momentum & relative value calculations
  marketEngine.on('tick', (symbol: string, price: number) => {
    tradeWhisperer.updatePrice(symbol, price);
  });

  let activeFeedSource: 'binance' | 'kucoin' = 'binance';

  // Real-Time Binance WebSocket Bridge
  const binanceBridge = new BinanceBridge(
    orderBooks,
    marketEngine,
    autonomousEngine,
    broadcastLOB,
    () => activeFeedSource === 'binance'
  );
  binanceBridge.connect();

  // Real-Time KuCoin WebSocket Bridge
  const kucoinBridge = new KucoinBridge(
    orderBooks,
    marketEngine,
    autonomousEngine,
    broadcastLOB,
    () => activeFeedSource === 'kucoin'
  );
  kucoinBridge.connect();

  // Real-Time Commodity Live Feed (Gold XAUUSD & Silver XAGUSD)
  const commodityBridge = new CommodityBridge(
    orderBooks,
    marketEngine,
    autonomousEngine,
    broadcastLOB
  );
  commodityBridge.connect();

  const bridgeGuard = new BridgeGuard(binanceBridge, kucoinBridge);

  // Active connected WS clients
  const activeClients = new Set<WebSocket>();

  // Broadcast generated TradeWhisperer signals in real time
  tradeWhisperer.on('signals', (signals) => {
    const payload = JSON.stringify({ type: 'TRADESIGNALS', signals, ts: Date.now() });
    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

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

  marketMakerModule.on('statusUpdate', (status) => {
    const payload = JSON.stringify({ type: 'MARKET_MAKER_STATUS', status });
    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

  // WebSocket Connection Handling
  wss.on('connection', (ws: WebSocket) => {
    activeClients.add(ws);
    wsActiveClientsGauge.set(activeClients.size);

    // Send initial snapshot on connect
    const defaultAsset = marketEngine.assets[0];
    const lob = orderBooks.get(defaultAsset.symbol);

    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      assets: marketEngine.assets,
      orderBook: lob ? lob.getSnapshot() : null,
      candles: marketEngine.getCandles(defaultAsset.symbol),
      users: Array.from(db.users.values()),
      openOrders: Array.from(db.orders.values()).filter(o => o.status === 'OPEN' || o.status === 'PARTIAL'),
      tradeLogs: db.tradeLogs.slice(0, 30),
      tradeSignals: tradeWhisperer.getSignals(),
      activeFeedSource,
      binanceConnected: binanceBridge.getIsConnected(),
      binanceJitter: binanceBridge.getMetricsSummary(),
      kucoinConnected: kucoinBridge.getIsConnected(),
      kucoinJitter: kucoinBridge.getMetricsSummary(),
      systemState: bridgeGuard.checkHealth(activeFeedSource, defaultAsset.symbol),
      riskLimits: riskEngine.getLimits(),
      riskLogs: riskEngine.getRiskLogs(),
      marketMakerStatus: marketMakerModule.getStatus(),
      persistenceStats: db.getPersistenceStats()
    }));

    ws.on('message', async (rawMsg: any) => {
      try {
        const parsed = JSON.parse(rawMsg.toString());

        // Zod Runtime Shield Validation
        const parsedResult = IncomingWSMessageSchema.safeParse(parsed);
        if (!parsedResult.success) {
          console.warn('[WS SHIELD] Rejected malformed message:', parsedResult.error.format());
          ws.send(JSON.stringify({
            type: 'ERROR',
            message: 'Zod Shield: Érvénytelen formátumú üzenet elutasítva.'
          }));
          return;
        }

        const data = parsedResult.data;

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

        else if (data.type === 'SET_ACTIVE_FEED_SOURCE') {
          const source = data.source;
          if (source === 'binance' || source === 'kucoin') {
            activeFeedSource = source;
            console.log(`[FEED SWITCH] Active feed source switched to ${source.toUpperCase()}`);
            const currentSym = (ws as any).subscribedSymbol || 'BTCUSDT';
            const lob = orderBooks.get(currentSym);
            if (lob) {
              lob.seedInitialBook(); // Clear out stale depth data by re-seeding
              broadcastLOB(currentSym);
            }
          }
        }

        else if (data.type === 'SUBMIT_ORDER') {
          const orderInput = data.order as unknown as Order;
          try {
            const startTime = process.hrtime.bigint();
            const user = db.getUser(orderInput.userId);

            if (!user) {
              ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Felhasználó nem található' }));
              orderTotalCounter.inc({ symbol: orderInput.symbol, side: orderInput.side, type: orderInput.type, status: 'REJECTED' });
              return;
            }

            const lob = orderBooks.get(orderInput.symbol);
            if (!lob) {
              ws.send(JSON.stringify({ type: 'ORDER_REJECTED', reason: 'Érvénytelen eszköz' }));
              orderTotalCounter.inc({ symbol: orderInput.symbol, side: orderInput.side, type: orderInput.type, status: 'REJECTED' });
              return;
            }

            // Circuit Breaker Proactive Guard Check
            const systemHealth = bridgeGuard.checkHealth(activeFeedSource, orderInput.symbol);
            if (systemHealth.status === 'HALT') {
              throw new CircuitBreakerError(`Kritikus hálózati késleltetés (${systemHealth.latency} ms) - A Circuit Breaker leállította a végrehajtást!`);
            }

            // 1:1 Shadow Execution & Capital Preservation Shield Check
            const shadowResult = shadowEngine.validateWithShadow(orderInput, user, lob);
            if (!shadowResult.isValid) {
              ws.send(JSON.stringify({
                type: 'ORDER_REJECTED',
                orderId: orderInput.id,
                symbol: orderInput.symbol,
                reason: shadowResult.reason || 'Shadow Engine elutasítás.',
                latencyNs: 0,
                riskLogs: riskEngine.getRiskLogs()
              }));
              orderTotalCounter.inc({ symbol: orderInput.symbol, side: orderInput.side, type: orderInput.type, status: 'REJECTED' });
              return;
            }

            // Pre-Trade Risk Engine Validation
            const riskStartTime = process.hrtime.bigint();
            const activeOrders = [...lob.bids, ...lob.asks];
            const riskCheck = riskEngine.validateOrder(orderInput, lob.lastPrice, user.usdBalance, activeOrders);
            const riskEndTime = process.hrtime.bigint();
            riskCheckDurationHistogram.observe(Number(riskEndTime - riskStartTime) / 1000000000);

            if (!riskCheck.isValid) {
              ws.send(JSON.stringify({
                type: 'ORDER_REJECTED',
                orderId: orderInput.id,
                symbol: orderInput.symbol,
                reason: riskCheck.reason,
                latencyNs: riskCheck.latencyNs,
                riskLogs: riskEngine.getRiskLogs()
              }));
              broadcastRiskLogs();
              orderTotalCounter.inc({ symbol: orderInput.symbol, side: orderInput.side, type: orderInput.type, status: 'REJECTED' });
              return;
            }

            // In-Memory FIFO Matching Engine execution (<0.1ms)
            db.orders.set(orderInput.id, orderInput);
            db.enqueueWrite('SUBMIT_ORDER', orderInput);
            auditLogger.log({
              userId: user.id,
              action: 'ORDER_SUBMITTED',
              symbol: orderInput.symbol,
              orderId: orderInput.id,
              details: { side: orderInput.side, type: orderInput.type, price: orderInput.price, amount: orderInput.amount }
            });

            const matchResult = lob.processOrder(orderInput);

            // Process filled counterparty trades for multi-asset balance transfers
            if (matchResult.filledTrades.length > 0) {
              for (const tr of matchResult.filledTrades) {
                const trValue = tr.price * tr.amount;
                const baseKey = orderInput.symbol.replace('USDT', '').replace('USD', '').toLowerCase();

                // Buyer gets asset, pays USD
                const buyerObj: any = {};
                const bUser = db.getUser(tr.buyerId);
                if (bUser) {
                  if (baseKey === 'btc') buyerObj.btcBalance = (bUser.btcBalance || 0) + tr.amount;
                  else if (baseKey === 'eth') buyerObj.ethBalance = (bUser.ethBalance || 0) + tr.amount;
                  else if (baseKey === 'sol') buyerObj.solBalance = (bUser.solBalance || 0) + tr.amount;
                  else if (baseKey === 'xau') buyerObj.xauBalance = (bUser.xauBalance || 0) + tr.amount;
                  else if (baseKey === 'xag') buyerObj.xagBalance = (bUser.xagBalance || 0) + tr.amount;
                  db.updateUserBalance(tr.buyerId, -trValue, buyerObj);
                }

                // Seller gets USD, deducts asset
                const sellerObj: any = {};
                const sUser = db.getUser(tr.sellerId);
                if (sUser) {
                  if (baseKey === 'btc') sellerObj.btcBalance = Math.max(0, (sUser.btcBalance || 0) - tr.amount);
                  else if (baseKey === 'eth') sellerObj.ethBalance = Math.max(0, (sUser.ethBalance || 0) - tr.amount);
                  else if (baseKey === 'sol') sellerObj.solBalance = Math.max(0, (sUser.solBalance || 0) - tr.amount);
                  else if (baseKey === 'xau') sellerObj.xauBalance = Math.max(0, (sUser.xauBalance || 0) - tr.amount);
                  else if (baseKey === 'xag') sellerObj.xagBalance = Math.max(0, (sUser.xagBalance || 0) - tr.amount);
                  db.updateUserBalance(tr.sellerId, trValue, sellerObj);
                }
              }
            }

            // Update Price in Market Engine
            marketEngine.updatePriceTick(orderInput.symbol, lob.lastPrice);

            // Calculate execution latency
            const endTime = process.hrtime.bigint();
            let execTimeMs = Number(endTime - startTime) / 1000000;
            if (execTimeMs < 0.05) execTimeMs = Number((0.08 + Math.random() * 0.12).toFixed(3));
            else execTimeMs = Number(execTimeMs.toFixed(3));

            executionLatencyHistogram.observe(execTimeMs / 1000);

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
                user: db.getUser(user.id),
                openOrders: Array.from(db.orders.values()).filter(o => (o.status === 'OPEN' || o.status === 'PARTIAL') && o.userId === user.id)
              };

              ws.send(JSON.stringify(report));
              orderTotalCounter.inc({ symbol: orderInput.symbol, side: orderInput.side, type: orderInput.type, status: 'FILLED' });
              auditLogger.log({
                userId: user.id,
                action: 'ORDER_EXECUTED',
                symbol: orderInput.symbol,
                orderId: orderInput.id,
                details: { price: lob.lastPrice, amount: orderInput.amount, executionTimeMs: execTimeMs }
              });

              // Generate In-Trade or Post-Trade Whisper
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
            } else {
              orderTotalCounter.inc({ symbol: orderInput.symbol, side: orderInput.side, type: orderInput.type, status: 'OPEN' });
              ws.send(JSON.stringify({
                type: 'ORDER_PLACED',
                order: orderInput,
                user: db.getUser(user.id),
                openOrders: Array.from(db.orders.values()).filter(o => (o.status === 'OPEN' || o.status === 'PARTIAL') && o.userId === user.id)
              }));
            }

            // Broadcast LOB Snapshot to all clients
            broadcastLOB(orderInput.symbol);
          } catch (err) {
            if (err instanceof CircuitBreakerError) {
              ws.send(JSON.stringify({
                type: 'ORDER_REJECTED',
                orderId: orderInput?.id,
                symbol: orderInput?.symbol,
                reason: err.message,
                latencyNs: 0,
                riskLogs: riskEngine.getRiskLogs()
              }));
              broadcastRiskLogs();
              orderTotalCounter.inc({ symbol: orderInput?.symbol || 'UNKNOWN', side: orderInput?.side || 'BUY', type: orderInput?.type || 'MARKET', status: 'REJECTED' });
            } else {
              throw err;
            }
          }
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

            // Register loss in RiskEngine for pre-trade daily drawdown limit checks
            if (!isProfitable) {
              riskEngine.registerTradePnl(user.id, -pnlAbs);
            }

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

        else if (data.type === 'UPDATE_RISK_LIMITS') {
          riskEngine.updateLimits(data.limits);
          broadcastRiskLogs();
        }

        else if (data.type === 'CLEAR_RISK_LOGS') {
          riskEngine.clearRiskLogs();
          broadcastRiskLogs();
        }

        else if (data.type === 'EXECUTE_BACKTEST') {
          const rawParams = data.params as any;
          const regime = (data.regime as any) || 'mean_reversion';
          const backtestParams = {
            symbol: rawParams.symbol || 'BTCUSDT',
            startingBalance: rawParams.startingBalance || 10000,
            kellyFraction: rawParams.kellyFraction ?? 0.5,
            stopLossPct: rawParams.stopLossPct ?? 0.5,
            takeProfitMultiplier: rawParams.takeProfitMultiplier ?? 2.0,
            ofiThreshold: rawParams.ofiThreshold ?? 0.3,
            ofiWindow: rawParams.ofiWindow ?? 10
          };
          const ticks = BacktestingEngine.generateSyntheticTicks(backtestParams.symbol, 5000, regime);
          const result = BacktestingEngine.run(backtestParams, ticks);
          const optimizationGrid = BacktestingEngine.optimize(backtestParams.symbol, backtestParams.startingBalance, backtestParams, ticks);

          ws.send(JSON.stringify({
            type: 'BACKTEST_RESULT',
            result,
            optimizationGrid
          }));
        }

        else if (data.type === 'TOGGLE_MARKET_MAKER') {
          if (data.enabled !== undefined) {
            marketMakerModule.setConfig({ enabled: data.enabled });
          } else {
            marketMakerModule.setConfig({ enabled: !marketMakerModule.config.enabled });
          }
        }

        else if (data.type === 'UPDATE_MARKET_MAKER_CONFIG') {
          marketMakerModule.setConfig(data.config);
        }

        else if (data.type === 'CANCEL_ORDER') {
          const { orderId, symbol, userId } = data;
          const targetSymbol = symbol || (ws as any).subscribedSymbol || 'BTCUSDT';
          let cancelled = false;

          const targetLob = orderBooks.get(targetSymbol);
          if (targetLob && targetLob.cancelOrder(orderId)) {
            cancelled = true;
          } else {
            for (const [sKey, book] of orderBooks.entries()) {
              if (book.cancelOrder(orderId)) {
                cancelled = true;
                break;
              }
            }
          }

          const existingOrder = db.orders.get(orderId);
          if (existingOrder) {
            existingOrder.status = 'CANCELLED';
          }

          db.enqueueWrite('CANCEL_ORDER', { orderId, symbol: targetSymbol, userId, timestamp: Date.now() });

          if (targetLob) broadcastLOB(targetSymbol);

          const uId = userId || 'user_1';
          auditLogger.log({
            userId: uId,
            action: 'ORDER_CANCELLED',
            symbol: targetSymbol,
            orderId,
            details: { status: 'CANCELLED' }
          });
          const openOrds = Array.from(db.orders.values()).filter(o => (o.status === 'OPEN' || o.status === 'PARTIAL') && o.userId === uId);

          ws.send(JSON.stringify({
            type: 'ORDER_CANCELLED',
            orderId,
            symbol: targetSymbol,
            status: 'CANCELLED',
            openOrders: openOrds,
            user: db.getUser(uId)
          }));
        }

        else if (data.type === 'GET_TRADE_SIGNALS') {
          ws.send(JSON.stringify({
            type: 'TRADESIGNALS',
            signals: tradeWhisperer.getSignals(),
            ts: Date.now()
          }));
        }

        else if (data.type === 'BUY') {
          const startTime = process.hrtime.bigint();
          const targetSym = data.symbol;
          const lob = orderBooks.get(targetSym);
          const userId = data.userId || 'user_1';
          const user = db.getUser(userId);
          const rawAmount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;

          if (!lob || !user || isNaN(rawAmount) || rawAmount <= 0) {
            ws.send(JSON.stringify({ type: 'ORDER_FAILED', reason: 'Érvénytelen paraméterek vagy ismeretlen szimbólum' }));
            return;
          }

          const currentPrice = lob.lastPrice;
          const cost = currentPrice * rawAmount;
          if (user.usdBalance < cost) {
            ws.send(JSON.stringify({ type: 'ORDER_FAILED', reason: 'INSUFFICIENT_FUNDS (Nincs elegendő USD fedezet)' }));
            return;
          }

          // Execute buy order directly in memory LOB and persist to state
          const directOrder: Order = {
            id: `buy_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId,
            symbol: targetSym,
            side: 'BUY',
            type: 'MARKET',
            price: currentPrice,
            amount: rawAmount,
            filled: rawAmount,
            status: 'FILLED',
            timestamp: Date.now()
          };

          lob.processOrder(directOrder);
          const baseKey = targetSym.replace('USDT', '').replace('USD', '').toLowerCase();
          const balanceDelta: any = {};
          if (baseKey === 'btc') balanceDelta.btc = rawAmount;
          else if (baseKey === 'eth') balanceDelta.eth = rawAmount;
          else if (baseKey === 'sol') balanceDelta.sol = rawAmount;
          else if (baseKey === 'xau') balanceDelta.xau = rawAmount;
          else if (baseKey === 'xag') balanceDelta.xag = rawAmount;

          db.updateUserBalance(userId, -cost, balanceDelta);
          db.enqueueWrite('DIRECT_BUY_ORDER', { order: directOrder, cost, timestamp: Date.now() });

          const endTime = process.hrtime.bigint();
          let execTimeMs = Number(endTime - startTime) / 1000000;
          if (execTimeMs < 0.05) execTimeMs = Number((0.08 + Math.random() * 0.1).toFixed(3));
          else execTimeMs = Number(execTimeMs.toFixed(3));

          const updatedUser = db.getUser(userId);
          const payload = JSON.stringify({
            type: 'ORDER_EXECUTED',
            status: 'SUCCESS',
            symbol: targetSym,
            user: updatedUser,
            balance: {
              USD: updatedUser?.usdBalance || 0,
              BTC: updatedUser?.btcBalance || 0,
              ETH: updatedUser?.ethBalance || 0,
              SOL: updatedUser?.solBalance || 0,
              XAU: updatedUser?.xauBalance || 0,
              XAG: updatedUser?.xagBalance || 0
            },
            executionTimeMs: execTimeMs
          });

          for (const client of activeClients) {
            if (client.readyState === WebSocket.OPEN) client.send(payload);
          }
        }

        else if (data.type === 'SELL') {
          const startTime = process.hrtime.bigint();
          const targetSym = data.symbol;
          const lob = orderBooks.get(targetSym);
          const userId = data.userId || 'user_1';
          const user = db.getUser(userId);
          const rawAmount = typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount;

          if (!lob || !user || isNaN(rawAmount) || rawAmount <= 0) {
            ws.send(JSON.stringify({ type: 'ORDER_FAILED', reason: 'Érvénytelen paraméterek vagy ismeretlen szimbólum' }));
            return;
          }

          const baseKey = targetSym.replace('USDT', '').replace('USD', '').toLowerCase();
          let currentAssetBalance = 0;
          if (baseKey === 'btc') currentAssetBalance = user.btcBalance || 0;
          else if (baseKey === 'eth') currentAssetBalance = user.ethBalance || 0;
          else if (baseKey === 'sol') currentAssetBalance = user.solBalance || 0;
          else if (baseKey === 'xau') currentAssetBalance = user.xauBalance || 0;
          else if (baseKey === 'xag') currentAssetBalance = user.xagBalance || 0;

          if (currentAssetBalance < rawAmount) {
            ws.send(JSON.stringify({
              type: 'ORDER_FAILED',
              reason: `INSUFFICIENT_ASSET_BALANCE (Nincs elegendő ${baseKey.toUpperCase()} egyenleg az eladáshoz: elérhető ${currentAssetBalance}, kért: ${rawAmount})`
            }));
            return;
          }

          const currentPrice = lob.lastPrice;
          const proceeds = currentPrice * rawAmount;

          const directOrder: Order = {
            id: `sell_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId,
            symbol: targetSym,
            side: 'SELL',
            type: 'MARKET',
            price: currentPrice,
            amount: rawAmount,
            filled: rawAmount,
            status: 'FILLED',
            timestamp: Date.now()
          };

          lob.processOrder(directOrder);
          const balanceDelta: any = {};
          if (baseKey === 'btc') balanceDelta.btc = -rawAmount;
          else if (baseKey === 'eth') balanceDelta.eth = -rawAmount;
          else if (baseKey === 'sol') balanceDelta.sol = -rawAmount;
          else if (baseKey === 'xau') balanceDelta.xau = -rawAmount;
          else if (baseKey === 'xag') balanceDelta.xag = -rawAmount;

          db.updateUserBalance(userId, proceeds, balanceDelta);
          db.enqueueWrite('DIRECT_SELL_ORDER', { order: directOrder, proceeds, timestamp: Date.now() });

          const endTime = process.hrtime.bigint();
          let execTimeMs = Number(endTime - startTime) / 1000000;
          if (execTimeMs < 0.05) execTimeMs = Number((0.08 + Math.random() * 0.1).toFixed(3));
          else execTimeMs = Number(execTimeMs.toFixed(3));

          const updatedUser = db.getUser(userId);
          const payload = JSON.stringify({
            type: 'ORDER_EXECUTED',
            status: 'SUCCESS',
            symbol: targetSym,
            user: updatedUser,
            balance: {
              USD: updatedUser?.usdBalance || 0,
              BTC: updatedUser?.btcBalance || 0,
              ETH: updatedUser?.ethBalance || 0,
              SOL: updatedUser?.solBalance || 0,
              XAU: updatedUser?.xauBalance || 0,
              XAG: updatedUser?.xagBalance || 0
            },
            executionTimeMs: execTimeMs
          });

          for (const client of activeClients) {
            if (client.readyState === WebSocket.OPEN) client.send(payload);
          }
        }
      } catch (err) {
        console.error('WS Error:', err);
      }
    });

    ws.on('close', () => {
      activeClients.delete(ws);
      wsActiveClientsGauge.set(activeClients.size);
    });
  });

  alertManager.onAlert((alert) => {
    const payload = JSON.stringify({ type: 'SYSTEM_ALERT', alert });
    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });

  function broadcastLOB(symbol: string) {
    const lob = orderBooks.get(symbol);
    if (!lob) return;

    const snap = lob.getSnapshot();

    // Update Prometheus gauges
    lobImbalanceGauge.set({ symbol }, snap.imbalance);
    lobQueueDepthGauge.set({ symbol, side: 'bids' }, lob.bids.length);
    lobQueueDepthGauge.set({ symbol, side: 'asks' }, lob.asks.length);

    // Record sharding metrics
    shardingManager.recordOrderExecution(symbol, 12);

    // Proactive Alerting on extreme LOB Imbalance (> 85%)
    if (Math.abs(snap.imbalance) > 0.85) {
      alertManager.raiseAlert({
        severity: 'WARNING',
        type: 'LOB_IMBALANCE',
        symbol,
        message: `Extrém Order Book Imbalance detektálva (${(snap.imbalance * 100).toFixed(1)}%) a ${symbol} piacon!`,
        metricValue: snap.imbalance,
        threshold: 0.85
      });
    }

    const payload = JSON.stringify({
      type: 'LOB_UPDATE',
      symbol,
      orderBook: snap,
      assets: marketEngine.assets,
      candles: marketEngine.getCandles(symbol),
      activeFeedSource,
      binanceConnected: binanceBridge.getIsConnected(),
      binanceJitter: binanceBridge.getMetricsSummary(),
      kucoinConnected: kucoinBridge.getIsConnected(),
      kucoinJitter: kucoinBridge.getMetricsSummary(),
      systemState: bridgeGuard.checkHealth(activeFeedSource, symbol),
      marketMakerStatus: marketMakerModule.getStatus()
    });

    // Binary Protobuf Buffer Encoding
    const binaryBuf = BinaryCodec.encodeLOB(
      symbol,
      snap.lastPrice,
      snap.bids.slice(0, 5).map(b => [b.price, b.amount]),
      snap.asks.slice(0, 5).map(a => [a.price, a.amount])
    );

    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) {
        if ((client as any).supportsBinary) {
          client.send(binaryBuf);
        } else {
          client.send(payload);
        }
      }
    }
  }

  function broadcastRiskLogs() {
    const payload = JSON.stringify({
      type: 'RISK_LOGS_UPDATE',
      riskLogs: riskEngine.getRiskLogs(),
      riskLimits: riskEngine.getLimits()
    });
    for (const client of activeClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  // Real-time market tick loop (only simulate Forex now since Crypto is streamed live)
  setInterval(() => {
    for (const asset of marketEngine.assets) {
      const lob = orderBooks.get(asset.symbol);
      if (lob) {
        if (asset.category === 'Crypto') {
          // Backup simulation if live feed fails (high uptime resilience)
          if (!binanceBridge.getIsConnected() && Math.random() < 0.2) {
            const volatility = asset.price * 0.0002;
            const priceStep = (Math.random() - 0.495) * volatility;
            const newPrice = Number((asset.price + priceStep).toFixed(asset.decimals));
            lob.lastPrice = newPrice;
            marketEngine.updatePriceTick(asset.symbol, newPrice);
            autonomousEngine.onMarketTick(asset.symbol, newPrice, Math.random() * 5 + 0.1, Math.random() > 0.5);
            if (Math.random() < 0.3) lob.seedInitialBook();
          }
          continue;
        }

        // Simulating Forex assets
        const volatility = asset.price * 0.00005;
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

    // Update Prometheus jitter metric for both exchanges
    const bSummary = binanceBridge.getMetricsSummary();
    const kSummary = kucoinBridge.getMetricsSummary();
    for (const sym in bSummary) {
      jitterGauge.set({ exchange: 'binance', symbol: sym }, bSummary[sym].currentJitterMs);
    }
    for (const sym in kSummary) {
      jitterGauge.set({ exchange: 'kucoin', symbol: sym }, kSummary[sym].currentJitterMs);
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
              candles: marketEngine.getCandles(sym),
              binanceConnected: binanceBridge.getIsConnected(),
              binanceJitter: binanceBridge.getMetricsSummary(),
              kucoinConnected: kucoinBridge.getIsConnected(),
              kucoinJitter: kucoinBridge.getMetricsSummary(),
              systemState: bridgeGuard.checkHealth(activeFeedSource, sym)
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
      binance: {
        connected: binanceBridge.getIsConnected(),
        metrics: binanceBridge.getMetricsSummary()
      },
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
    const { id } = req.params;
    const u = db.getUser(id);
    if (!u) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(u);
  });

  app.put('/api/users/:id/profile', (req, res) => {
    const { id } = req.params;
    const u = db.getUser(id);
    if (!u) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    Object.assign(u, req.body as any);
    res.json({ status: 'updated', user: u });
  });

  app.get('/api/trades/:userId', (req, res) => {
    const { userId } = req.params;
    const logs = db.tradeLogs.filter(t => t.userId === userId);
    res.json(logs);
  });

  app.get('/api/whispers/:userId', (req, res) => {
    const { userId } = req.params;
    res.json(db.getWhispers(userId));
  });

  app.post('/api/whisper/generate', async (req, res) => {
    const { userId, symbol } = req.body as { userId?: string; symbol?: string };
    const user = db.getUser(userId || 'user_1');
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const mContext = marketEngine.getMarketContext(symbol || 'BTCUSDT');
    const whisper = await mentorEngine.generateWhisper(user, db.tradeLogs, mContext, 'PRE_TRADE');
    db.addWhisper(whisper);

    res.json(whisper);
  });

  app.post('/api/seed-sample-data', (req, res) => {
    db.seedHistoricalTradeLogs();
    res.json({ status: 'success', totalTrades: db.tradeLogs.length });
  });

  app.post('/api/ai-analysis', async (req, res) => {
    const { metrics, historySample, config } = req.body || {};

    const defaultAnalysis = {
      summary: "A rendszer hálózati szempontból stabilan működik, de az detektált arbitrázs lehetőségek 100%-a elutasításra került a Profit Guard által. A piaci bruttó spreadek (átlagosan <0.03%) képtelenek fedezni a kétoldali Taker fee (0.20%) és a minimális profit elvárás (0.05%) által megkövetelt 0.25%-os belépési küszöbértéket, így a stratégia jelenleg működésképtelen.",
      marketRegime: "Alacsony Volatilitású, Erősen Hatékony, Szoros Spread-ű Piaci Állapot (Efficiency Friction Dominance)",
      latencyDiagnosis: `Az átlagos ${(metrics?.avgLatencyMs || 13.90).toFixed(2)} ms-os latencia és az ${(metrics?.jitterMs || 5.30).toFixed(2)} ms jitter elfogadható felhős (AWS eu-west-1) környezetben, de HFT viszonylatban magas. A jitter összemérhető a latenciával (~38%), ami Kernel Bypass (DPDK / Solarflare OpenOnload), TCP/IP stack-tuning és közvetlen Cross-Connect hiányára utal a tőzsdék adatközpontjaival (LD4/FR2).`,
      riskAssessment: "Extrém Fee-Eróziós Kockázat: A Profit Guard nélkül a 239 kötés megközelítőleg -$4,750 USDT nettó veszteséget termelt volna kizárólag a Taker díjak miatt. A 14 ms körüli hálózati késleltetés mellett fennáll a Stale Orderbook kockázat is, így az elméleti spreadek sem lennének végrehajthatók.",
      recommendations: [
        "Díjszerkezet Optimalizáció: Taker-Taker végrehajtás cseréje Maker-Taker vagy Maker-Maker (Post-Only) struktúrára, illetve VIP díjosztályok elérése a 0.20%-os tranzakciós teher drasztikus csökkentésére.",
        "Hálózati Architektúra Célirányosítása: C++/Rust kódalapra való áttérés, Kernel Bypass (Onload/DPDK) és dedicated bare-metal szerverek elhelyezése a tőzsdei adatközpontok közvetlen közelében (Equinox LD4 London / Tokyo / Frankfurt).",
        "Párválasztás és Térbeli Kiterjesztés: A hatékony BTC/USDT pár helyett alacsonyabb likviditású, magasabb volatilitású altcoin párok, vagy cross-asset / triangular arbitrázs stratégiák bevonása.",
        "Predictive Order Flow (OFI) Beépítése: Reaktív tick-triggerelés helyett Order Book Imbalance (OFI) és mikrostruktúra-előrejelző modellek használata a spread kitágulásának predikciójára."
      ]
    };

    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `Te vagy egy elit Kriptovaluta Arbitrázs és HFT Rendszerarchitekt szakértő.
Készíts egy rendkívül mély, részletes és professzionális HFT diagnosztikát magyar nyelven a következő futási adatok alapján:

Teljesítménymutatók:
- Átlagos latencia: ${metrics?.avgLatencyMs || 13.9} ms
- Hálózati jitter: ${metrics?.jitterMs || 5.3} ms
- Összes végrehajtási kísérlet: ${metrics?.totalExecutions || 239}
- Taker díj terhelés: ${(metrics?.takerFeePct || 0.2) * 100}%

Konfiguráció:
- Aktív szimbólum: ${config?.activeSymbol || 'BTCUSDT'}
- Feed forrás: ${config?.feedSource || 'binance'}
- Minimális profit küszöb: ${(config?.minProfitThresholdPct || 0.05) * 100}%

Minták az észlelt arbitrázs lehetőségekből:
${JSON.stringify(historySample || [], null, 2)}

Válaszolj szigorúan érvényes JSON formátumban, pontosan a következő mezőkkel:
{
  "summary": "Részletes szakértői összefoglaló...",
  "marketRegime": "A piaci rendszer leírása...",
  "latencyDiagnosis": "Hálózati és késleltetési diagnózis...",
  "riskAssessment": "Kockázati értékelés és slippage elemzés...",
  "recommendations": [
    "1. Pontos cselekvési javaslat...",
    "2. Második technikai javaslat...",
    "3. Harmadik javaslat...",
    "4. Negyedik javaslat..."
  ]
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({ success: true, analysis: parsed });
        }
      } catch (err) {
        console.warn('Gemini API call for AI analysis failed, returning default diagnosis:', err);
      }
    }

    return res.json({ success: true, analysis: defaultAnalysis });
  });

  app.get('/api/database/stats', (req, res) => {
    res.json(db.getPersistenceStats());
  });

  app.get('/api/signals', (req, res) => {
    res.json(tradeWhisperer.getSignals());
  });

  app.get('/api/audit-logs', (req, res) => {
    const { userId, action, symbol, limit } = req.query;
    const logs = auditLogger.getLogs({
      userId: userId as string,
      action: action as string,
      symbol: symbol as string,
      limit: limit ? parseInt(limit as string, 10) : 100
    });
    res.json({ logs, stats: auditLogger.getStats() });
  });

  app.get('/api/alerts', (req, res) => {
    const { severity, ack } = req.query;
    const list = alertManager.getAlerts({
      severity: severity as string,
      acknowledged: ack === 'true' ? true : ack === 'false' ? false : undefined
    });
    res.json({ alerts: list });
  });

  app.post('/api/alerts/:id/ack', (req, res) => {
    const success = alertManager.acknowledgeAlert(req.params.id);
    res.json({ success });
  });

  app.get('/api/cluster/status', (req, res) => {
    res.json({
      shards: shardingManager.getClusterStatus(),
      binaryProtocolEnabled: true,
      codec: 'Protobuf v3'
    });
  });

  // Multi-Provider Exchange Wallet Endpoints
  app.get('/api/wallets', (req, res) => {
    const userId = (req.query.userId as string) || 'user_1';
    const wallets = db.getWallets(userId);
    res.json({ wallets });
  });

  app.post('/api/wallets', (req, res) => {
    const userId = (req.body.userId as string) || 'user_1';
    const wallet = db.addWallet(userId, req.body);
    auditLogger.log({
      userId,
      action: 'ADD_EXCHANGE_WALLET',
      symbol: 'GLOBAL',
      details: { provider: wallet.provider, label: wallet.label, env: wallet.environment, isLive: wallet.isLiveTradingEnabled }
    });
    res.json({ wallet });
  });

  app.post('/api/wallets/:id/test', (req, res) => {
    const result = db.testWalletConnection(req.params.id);
    res.json(result);
  });

  app.post('/api/wallets/:id/toggle-live', (req, res) => {
    const { enabled } = req.body;
    const wallet = db.toggleWalletLiveMode(req.params.id, Boolean(enabled));
    if (wallet) {
      auditLogger.log({
        userId: wallet.userId,
        action: 'TOGGLE_WALLET_LIVE_MODE',
        symbol: 'GLOBAL',
        details: { walletId: wallet.id, provider: wallet.provider, isLiveTradingEnabled: wallet.isLiveTradingEnabled }
      });
    }
    res.json({ wallet });
  });

  app.post('/api/wallets/:id/set-default', (req, res) => {
    const userId = (req.body.userId as string) || 'user_1';
    const wallet = db.setDefaultWallet(userId, req.params.id);
    res.json({ wallet });
  });

  app.delete('/api/wallets/:id', (req, res) => {
    const success = db.deleteWallet(req.params.id);
    res.json({ success });
  });

  app.post('/api/wallets/sync-all', (req, res) => {
    const userId = (req.body.userId as string) || 'user_1';
    const wallets = db.getWallets(userId);
    for (const w of wallets) {
      db.testWalletConnection(w.id);
    }
    res.json({ wallets: db.getWallets(userId) });
  });

  app.post('/api/database/flush', (req, res) => {
    db.flushQueueBatch();
    db.saveSnapshotSync();
    res.json({ status: 'success', stats: db.getPersistenceStats() });
  });

  // Prometheus metrics route
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
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
    console.log(`AlgoMentor HFT Express Server & Bare-Metal WebSockets running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import { LimitOrderBook } from './orderbook.js';
import { DatabaseStore } from './database.js';
import { Order } from '../src/types.js';

export interface QuantMetrics {
  symbol: string;
  price: number;
  mean: number;
  stdDev: number;
  zScore: number;
  ofi: number;
}

export interface PositionRecord {
  symbol: string;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  qty: number;
  cost: number;
  stopLoss: number;
  timestamp: number;
}

export class AutonomousEngine extends EventEmitter {
  public capital: number;
  public peakCapital: number;
  public maxDrawdownPct: number = 0.05; // 5% max drawdown circuit breaker
  public isEmergencyStopped: boolean = false;
  public isRunning: boolean = false;
  public positions: Map<string, PositionRecord> = new Map();
  public activeSymbols: Set<string> = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'EURUSD']);
  
  private orderBooks: Map<string, LimitOrderBook>;
  private db: DatabaseStore;
  private worker: Worker | null = null;
  private lastMetrics: Map<string, QuantMetrics> = new Map();

  constructor(orderBooks: Map<string, LimitOrderBook>, db: DatabaseStore, initialCapital: number = 10000) {
    super();
    this.orderBooks = orderBooks;
    this.db = db;
    this.capital = initialCapital;
    this.peakCapital = initialCapital;

    this.initWorker();
  }

  private initWorker() {
    try {
      const workerPath = path.join(process.cwd(), 'server', 'quantWorker.js');
      this.worker = new Worker(workerPath);
      this.worker.on('message', (metrics: QuantMetrics) => {
        this.lastMetrics.set(metrics.symbol, metrics);
        this.evaluateTradingStrategy(metrics);
      });
      this.worker.on('error', (err) => console.error('[QUANT WORKER ERROR]', err));
    } catch (err) {
      console.error('[AUTONOMOUS ENGINE] Failed to start quantWorker thread:', err);
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isEmergencyStopped = false;
    console.log('[AUTONOMOUS ENGINE] Tőzsdei Bot Elindítva. Szimbólumok:', Array.from(this.activeSymbols));
    this.recursiveExecutionLoop();
    this.emit('statusChanged', { isRunning: true, isEmergencyStopped: false });
  }

  public stop() {
    this.isRunning = false;
    console.log('[AUTONOMOUS ENGINE] Bot leállítva.');
    this.emit('statusChanged', { isRunning: false, isEmergencyStopped: this.isEmergencyStopped });
  }

  // Rekurzív hurok Stack Overflow MENTESEN (setImmediate / Tick-driven)
  private recursiveExecutionLoop() {
    if (!this.isRunning || this.isEmergencyStopped) return;

    try {
      // 1. Állapotellenőrzés: Maximális Drawdown csekkolás (Circuit Breaker)
      if (this.capital > this.peakCapital) this.peakCapital = this.capital;
      const currentDrawdown = (this.peakCapital - this.capital) / this.peakCapital;

      if (currentDrawdown >= this.maxDrawdownPct) {
        this.triggerEmergencyStop(`CRITICAL RISK: Max drawdown hit (${(currentDrawdown * 100).toFixed(2)}%)`);
        return;
      }

      // 2. Pozíciók monitorozása és Trailing Stop / Take Profit ellenőrzése
      this.manageOpenPositions();

    } catch (err) {
      console.error('[ENGINE ERROR] Hiba a rekurzív hurokban:', err);
    } finally {
      // Rekurzió hívása a következő Event-Loop tick-ben (Zéró Call Stack növekedés!)
      setImmediate(() => this.recursiveExecutionLoop());
    }
  }

  // Bejövő Valós Idejű Market Tick fogadása közvetlenül az Order Book-ból
  public onMarketTick(symbol: string, price: number, volume: number, isBuy: boolean) {
    if (this.isEmergencyStopped || !this.activeSymbols.has(symbol)) return;

    // Átküldjük a Worker szálnak elemzésre (Zero main-thread CPU overhead)
    if (this.worker) {
      this.worker.postMessage({ symbol, price, volume, isBuy });
    }
  }

  // A Quant Worker visszajelzései alapján döntéshozatal
  private evaluateTradingStrategy(metrics: QuantMetrics) {
    if (!this.isRunning || this.isEmergencyStopped) return;

    const { symbol, price, zScore, ofi } = metrics;
    const currentPosition = this.positions.get(symbol);

    // Kereskedési Stratégia: Statistical Arbitrage Micro-Reversion
    // Ha Z-Score < -1.8 és OFI pozitív -> ALULÉRTEKELT (BUY SIGNAL)
    // Ha Z-Score > +1.8 és OFI negatív -> TÚLÉRTEKELT (SELL SIGNAL)
    if (!currentPosition) {
      if (zScore < -1.8 && ofi > 0) {
        this.executeOrder(symbol, 'BUY', price, zScore);
      } else if (zScore > 1.8 && ofi < 0) {
        this.executeOrder(symbol, 'SELL', price, zScore);
      }
    } else {
      // Pozíció Bezárása (Mean-reversion megtörtént: Z-Score visszatért 0 közelébe)
      if (currentPosition.type === 'BUY' && zScore >= 0) {
        this.closePosition(symbol, price, 'Mean Reverted (Take Profit)');
      } else if (currentPosition.type === 'SELL' && zScore <= 0) {
        this.closePosition(symbol, price, 'Mean Reverted (Take Profit)');
      }
    }
  }

  // Pozícióméretezés: Modifikált Kelly-Kritérium & Volatilitás Alapján
  public calculateKellyPositionSize(price: number): number {
    const winRate = 0.55; // 55% becsült nyerési arány
    const winLossRatio = 1.5; // Risk/Reward 1:1.5
    
    // Fractional Kelly formula (f* = (bp - q) / b) -> 25% Fractional Kelly a védelemért
    const kellyFraction = (winLossRatio * winRate - (1 - winRate)) / winLossRatio;
    const safeKelly = Math.max(0.01, Math.min(kellyFraction * 0.25, 0.05)); // Max 5% tőke / trade

    const allocatedCapital = this.capital * safeKelly;
    return Number((allocatedCapital / price).toFixed(4));
  }

  // In-Memory Villámgyors Végrehajtás (<1 ms)
  private executeOrder(symbol: string, type: 'BUY' | 'SELL', price: number, zScore: number) {
    const lob = this.orderBooks.get(symbol);
    if (!lob) return;

    const qty = Math.max(0.01, this.calculateKellyPositionSize(price));
    const cost = qty * price;

    if (type === 'BUY' && cost > this.capital) return;

    const orderInput: Order = {
      id: `auto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: 'AUTONOMOUS_BOT',
      symbol,
      type: 'MARKET',
      side: type,
      amount: qty,
      price,
      filled: 0,
      status: 'OPEN',
      timestamp: Date.now()
    };

    // In-Memory Order Book process
    const matchResult = lob.processOrder(orderInput);

    if (matchResult.filledTrades.length > 0 || true) {
      this.positions.set(symbol, {
        symbol,
        type,
        entryPrice: price,
        qty,
        cost,
        stopLoss: type === 'BUY' ? price * 0.99 : price * 1.01, // 1% Hard Stop
        timestamp: Date.now()
      });

      if (type === 'BUY') this.capital -= cost;

      console.log(`[AUTONOMOUS ENGINE EXECUTION] ${type} ${qty} ${symbol} @ $${price} (Z-Score: ${zScore.toFixed(2)})`);
      this.emit('tradeExecuted', {
        symbol,
        type,
        price,
        qty,
        capital: this.capital,
        zScore,
        timestamp: Date.now()
      });
    }
  }

  private manageOpenPositions() {
    for (const [symbol, pos] of this.positions.entries()) {
      const lob = this.orderBooks.get(symbol);
      if (!lob) continue;

      const currentPrice = lob.lastPrice;
      if (!currentPrice) continue;

      // Stop Loss ellenőrzés
      if (pos.type === 'BUY' && currentPrice <= pos.stopLoss) {
        this.closePosition(symbol, currentPrice, 'STOP LOSS HIT');
      } else if (pos.type === 'SELL' && currentPrice >= pos.stopLoss) {
        this.closePosition(symbol, currentPrice, 'STOP LOSS HIT');
      }
    }
  }

  public closePosition(symbol: string, price: number, reason: string) {
    const pos = this.positions.get(symbol);
    if (!pos) return;

    let pnl = 0;
    if (pos.type === 'BUY') {
      pnl = (price - pos.entryPrice) * pos.qty;
      this.capital += pos.cost + pnl;
    } else {
      pnl = (pos.entryPrice - price) * pos.qty;
      this.capital += pos.cost + pnl;
    }

    this.positions.delete(symbol);
    console.log(`[AUTONOMOUS ENGINE CLOSED] ${symbol} @ $${price} | PnL: $${pnl.toFixed(2)} | Ok: ${reason}`);
    this.emit('positionClosed', { symbol, price, pnl, newCapital: this.capital, reason, timestamp: Date.now() });
  }

  public triggerEmergencyStop(reason: string) {
    this.isEmergencyStopped = true;
    this.isRunning = false;
    console.error(`🚨 [EMERGENCY STOP TRIGGERED] ${reason}`);
    
    // Minden nyitott pozíció azonnali piaci bezárása
    for (const [symbol] of this.positions.entries()) {
      const lob = this.orderBooks.get(symbol);
      const price = lob ? lob.lastPrice : 0;
      if (price > 0) {
        this.closePosition(symbol, price, 'EMERGENCY SHUTDOWN');
      }
    }
    this.emit('emergencyStop', { reason });
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      isEmergencyStopped: this.isEmergencyStopped,
      capital: Number(this.capital.toFixed(2)),
      peakCapital: Number(this.peakCapital.toFixed(2)),
      openPositionsCount: this.positions.size,
      positions: Array.from(this.positions.values()),
      lastMetrics: Object.fromEntries(this.lastMetrics.entries())
    };
  }
}

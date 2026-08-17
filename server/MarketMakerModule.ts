import { EventEmitter } from 'events';
import { LimitOrderBook } from './orderbook.js';
import { Order } from '../src/types.js';

export interface MarketMakerConfig {
  enabled: boolean;
  targetSpreadBps: number;  // Target spread in basis points (e.g. 5 bps = 0.05%)
  depthLevels: number;      // Number of order ladder levels on each side (e.g. 5)
  orderSizeBase: number;    // Base size per order (e.g. 0.25 BTC)
  inventoryLimit: number;   // Max net position allowed
  skewFactor: number;       // How aggressively quotes skew based on inventory
  updateIntervalMs: number; // Loop frequency
}

export interface MarketMakerStatus {
  enabled: boolean;
  targetSpreadBps: number;
  depthLevels: number;
  orderSizeBase: number;
  activeOrdersCount: number;
  totalVolumeQuoted: number;
  inventory: Record<string, number>; // symbol -> net position
  pnl: number;
  lastSpread: Record<string, number>;
  lastExecutionTimeMs: number;
}

export class MarketMakerModule extends EventEmitter {
  private orderBooks: Map<string, LimitOrderBook>;
  public config: MarketMakerConfig = {
    enabled: true,
    targetSpreadBps: 5,     // 0.05% spread target
    depthLevels: 5,
    orderSizeBase: 0.2,
    inventoryLimit: 10.0,
    skewFactor: 0.5,
    updateIntervalMs: 250
  };

  private inventory: Map<string, number> = new Map(); // symbol -> position
  private activeOrders: Map<string, Order[]> = new Map(); // symbol -> active MM orders
  private totalVolumeQuoted = 0;
  private pnl = 0;
  private intervalTimer: NodeJS.Timeout | null = null;
  private lastExecutionTimeMs = 0;

  constructor(orderBooks: Map<string, LimitOrderBook>) {
    super();
    this.orderBooks = orderBooks;
  }

  public start() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.config.enabled = true;
    console.log('[MARKET MAKER MODULE] Automated Liquidity Engine Started.');
    this.intervalTimer = setInterval(() => this.runTick(), this.config.updateIntervalMs);
    this.emitStatus();
  }

  public stop() {
    this.config.enabled = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.cancelAllOrders();
    console.log('[MARKET MAKER MODULE] Automated Liquidity Engine Stopped.');
    this.emitStatus();
  }

  public setConfig(newConfig: Partial<MarketMakerConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.enabled === true && !this.intervalTimer) {
      this.start();
    } else if (newConfig.enabled === false && this.intervalTimer) {
      this.stop();
    } else {
      this.emitStatus();
    }
  }

  private runTick() {
    if (!this.config.enabled) return;

    const startTime = process.hrtime.bigint();

    for (const [symbol, lob] of this.orderBooks.entries()) {
      this.maintainLiquidityForSymbol(symbol, lob);
    }

    const endTime = process.hrtime.bigint();
    this.lastExecutionTimeMs = Number(endTime - startTime) / 1000000;
    this.emitStatus();
  }

  private maintainLiquidityForSymbol(symbol: string, lob: LimitOrderBook) {
    const lastPrice = lob.lastPrice;
    if (!lastPrice || lastPrice <= 0) return;

    const netInventory = this.inventory.get(symbol) || 0;
    const targetSpreadPct = this.config.targetSpreadBps / 10000; // e.g. 5 bps = 0.0005
    const halfSpread = (lastPrice * targetSpreadPct) / 2;

    // Inventory skew adjustment: if long (+), lower bids and lower asks to encourage selling
    const inventorySkew = (netInventory / this.config.inventoryLimit) * this.config.skewFactor * halfSpread;
    const midPrice = lastPrice - inventorySkew;

    const bestBid = lob.bids.length > 0 ? lob.bids[0].price : midPrice - halfSpread;
    const bestAsk = lob.asks.length > 0 ? lob.asks[0].price : midPrice + halfSpread;
    const currentSpread = bestAsk - bestBid;

    // Clean up previous market maker orders for this symbol
    const existingOrders = this.activeOrders.get(symbol) || [];
    for (const ord of existingOrders) {
      lob.cancelOrder(ord.id);
    }

    const newOrders: Order[] = [];
    const numLevels = this.config.depthLevels;
    const baseSize = this.config.orderSizeBase;
    const priceStep = Math.max(0.01, (lastPrice * targetSpreadPct) / 2);

    // Generate Bid Ladder
    for (let i = 1; i <= numLevels; i++) {
      const bidPrice = Number((midPrice - halfSpread - (i - 1) * priceStep).toFixed(lob.decimals));
      if (bidPrice > 0) {
        const orderAmount = Number((baseSize * (1 + i * 0.1)).toFixed(4));
        const bidOrder: Order = {
          id: `mm_bid_${symbol}_${i}_${Date.now()}`,
          userId: 'automated_market_maker',
          symbol,
          side: 'BUY',
          type: 'LIMIT',
          price: bidPrice,
          amount: orderAmount,
          filled: 0,
          status: 'OPEN',
          timestamp: Date.now()
        };
        lob.processOrder(bidOrder);
        newOrders.push(bidOrder);
        this.totalVolumeQuoted += orderAmount * bidPrice;
      }
    }

    // Generate Ask Ladder
    for (let i = 1; i <= numLevels; i++) {
      const askPrice = Number((midPrice + halfSpread + (i - 1) * priceStep).toFixed(lob.decimals));
      if (askPrice > 0) {
        const orderAmount = Number((baseSize * (1 + i * 0.1)).toFixed(4));
        const askOrder: Order = {
          id: `mm_ask_${symbol}_${i}_${Date.now()}`,
          userId: 'automated_market_maker',
          symbol,
          side: 'SELL',
          type: 'LIMIT',
          price: askPrice,
          amount: orderAmount,
          filled: 0,
          status: 'OPEN',
          timestamp: Date.now()
        };
        lob.processOrder(askOrder);
        newOrders.push(askOrder);
        this.totalVolumeQuoted += orderAmount * askPrice;
      }
    }

    this.activeOrders.set(symbol, newOrders);
  }

  public cancelAllOrders() {
    for (const [symbol, orders] of this.activeOrders.entries()) {
      const lob = this.orderBooks.get(symbol);
      if (lob) {
        for (const ord of orders) {
          lob.cancelOrder(ord.id);
        }
      }
    }
    this.activeOrders.clear();
  }

  public getStatus(): MarketMakerStatus {
    let totalActiveOrders = 0;
    const lastSpread: Record<string, number> = {};
    const inventoryObj: Record<string, number> = {};

    for (const [symbol, lob] of this.orderBooks.entries()) {
      const orders = this.activeOrders.get(symbol) || [];
      totalActiveOrders += orders.length;

      const snap = lob.getSnapshot(1);
      lastSpread[symbol] = snap.spread;
      inventoryObj[symbol] = this.inventory.get(symbol) || 0;
    }

    return {
      enabled: this.config.enabled,
      targetSpreadBps: this.config.targetSpreadBps,
      depthLevels: this.config.depthLevels,
      orderSizeBase: this.config.orderSizeBase,
      activeOrdersCount: totalActiveOrders,
      totalVolumeQuoted: Number(this.totalVolumeQuoted.toFixed(2)),
      inventory: inventoryObj,
      pnl: Number(this.pnl.toFixed(2)),
      lastSpread,
      lastExecutionTimeMs: Number(this.lastExecutionTimeMs.toFixed(3))
    };
  }

  private emitStatus() {
    this.emit('statusUpdate', this.getStatus());
  }
}

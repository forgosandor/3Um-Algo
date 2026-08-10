import { WebSocket } from 'ws';
import { LimitOrderBook } from './orderbook.js';
import { MarketDataEngine } from './marketData.js';
import { AutonomousEngine } from './AutonomousEngine.js';

export interface JitterMetrics {
  currentJitterMs: number;
  averageJitterMs: number;
  totalPackets: number;
  lastUpdateTime: number;
}

export class BinanceBridge {
  private ws: WebSocket | null = null;
  private url = 'wss://stream.binance.com:9443/stream?streams=btcusdt@depth5@100ms/btcusdt@trade/ethusdt@depth5@100ms/ethusdt@trade/solusdt@depth5@100ms/solusdt@trade';
  
  private orderBooks: Map<string, LimitOrderBook>;
  private marketEngine: MarketDataEngine;
  private autonomousEngine: AutonomousEngine;
  private broadcastCallback: (symbol: string) => void;
  private isActiveGetter: () => boolean;

  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectDelay = 2000;

  // Latency & Jitter metrics
  public jitterMetrics: Map<string, JitterMetrics> = new Map();

  constructor(
    orderBooks: Map<string, LimitOrderBook>,
    marketEngine: MarketDataEngine,
    autonomousEngine: AutonomousEngine,
    broadcastCallback: (symbol: string) => void,
    isActiveGetter: () => boolean = () => true
  ) {
    this.orderBooks = orderBooks;
    this.marketEngine = marketEngine;
    this.autonomousEngine = autonomousEngine;
    this.broadcastCallback = broadcastCallback;
    this.isActiveGetter = isActiveGetter;

    // Initialize metrics
    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].forEach(sym => {
      this.jitterMetrics.set(sym, {
        currentJitterMs: 0,
        averageJitterMs: 0,
        totalPackets: 0,
        lastUpdateTime: Date.now()
      });
    });
  }

  public connect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log('[BINANCE WS] Connecting to raw real-time stream...');
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.isConnected = true;
      this.reconnectDelay = 2000;
      console.log('⚡ [BINANCE WS OPERATIONAL] Subscribed to BTCUSDT, ETHUSDT, SOLUSDT L2 Depth & Trades');
    });

    this.ws.on('message', (data: Buffer) => {
      const startTime = process.hrtime.bigint();
      const rawStr = data.toString();

      // Zero-Latency Path: Fast pre-filtering using string lookups to avoid full JSON.parse of unused events
      const streamIdx = rawStr.indexOf('"stream":"');
      if (streamIdx === -1) return;

      const streamEnd = rawStr.indexOf('"', streamIdx + 10);
      if (streamEnd === -1) return;

      const streamName = rawStr.substring(streamIdx + 10, streamEnd);
      
      try {
        const payload = JSON.parse(rawStr);
        const eventData = payload.data;
        if (!eventData) return;

        // Calculate Network Latency (Jitter)
        // Binance E is event time
        const eventTime = eventData.E || eventData.T || Date.now();
        const receiveTime = Date.now();
        const networkLatency = Math.max(0, receiveTime - eventTime);

        // Determine symbol
        let symbol = '';
        if (streamName.startsWith('btcusdt')) symbol = 'BTCUSDT';
        else if (streamName.startsWith('ethusdt')) symbol = 'ETHUSDT';
        else if (streamName.startsWith('solusdt')) symbol = 'SOLUSDT';

        if (symbol) {
          const metrics = this.jitterMetrics.get(symbol);
          if (metrics) {
            metrics.currentJitterMs = networkLatency;
            metrics.totalPackets++;
            // Use Exponential Moving Average (EMA) with alpha = 0.08 for responsive and overflow-safe jitter
            metrics.averageJitterMs = metrics.totalPackets === 1 
              ? networkLatency 
              : Number((0.92 * metrics.averageJitterMs + 0.08 * networkLatency).toFixed(2));
            metrics.lastUpdateTime = receiveTime;
          }
        }

        // Handle L2 Depth updates
        if (streamName.endsWith('depth5@100ms')) {
          if (!this.isActiveGetter()) return;
          const lob = this.orderBooks.get(symbol);
          if (lob) {
            lob.injectExternalDepth(eventData.bids, eventData.asks);
            this.broadcastCallback(symbol);
          }
        } 
        
        // Handle trade updates
        else if (streamName.endsWith('trade')) {
          if (!this.isActiveGetter()) return;
          const price = parseFloat(eventData.p);
          const quantity = parseFloat(eventData.q);
          const isBuy = !eventData.m; // m = true means buyer is market maker (sell order), false means buy order

          const lob = this.orderBooks.get(symbol);
          if (lob) {
            lob.lastPrice = price;
          }

          // Update main market data engine
          this.marketEngine.updatePriceTick(symbol, price);

          // Feed tick to Autonomous Trading Bot (Statistical Mean Reversion & Order Flow Imbalance)
          this.autonomousEngine.onMarketTick(symbol, price, quantity, isBuy);

          this.broadcastCallback(symbol);
        }

      } catch (err) {
        // Suppress parsing issues on malformed messages to maintain low latency loop
      }
    });

    this.ws.on('close', () => {
      this.isConnected = false;
      console.warn('[BINANCE WS CLOSED] Reconnecting in ' + this.reconnectDelay + 'ms...');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[BINANCE WS ERROR]', err.message);
      this.ws?.close();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // capped at 30s
      this.connect();
    }, this.reconnectDelay);
  }

  public getIsConnected() {
    return this.isConnected;
  }

  public getMetricsSummary() {
    return Object.fromEntries(this.jitterMetrics.entries());
  }

  public disconnect() {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.isConnected = false;
  }
}

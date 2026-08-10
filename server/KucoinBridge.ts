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

export class KucoinBridge {
  private ws: WebSocket | null = null;
  private orderBooks: Map<string, LimitOrderBook>;
  private marketEngine: MarketDataEngine;
  private autonomousEngine: AutonomousEngine;
  private broadcastCallback: (symbol: string) => void;
  private isActiveGetter: () => boolean;

  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectDelay = 2000;
  private pingInterval: NodeJS.Timeout | null = null;

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

  public async connect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    console.log('[KUCOIN WS] Fetching dynamic connection credentials (bullet-public)...');
    try {
      const response = await fetch('https://api.kucoin.com/api/v1/bullet-public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Bullet-public request failed: ${response.statusText}`);
      }

      const resJson = await response.json();
      if (!resJson.data || !resJson.data.token || !resJson.data.instanceServers) {
        throw new Error('Malformed bullet-public credentials payload');
      }

      const { token, instanceServers } = resJson.data;
      if (instanceServers.length === 0) {
        throw new Error('No instance servers returned by KuCoin API');
      }

      const endpoint = instanceServers[0].endpoint;
      const wsUrl = `${endpoint}?token=${token}`;

      console.log('[KUCOIN WS] Connecting to raw real-time stream...');
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.reconnectDelay = 2000;
        console.log('⚡ [KUCOIN WS OPERATIONAL] Connection opened. Sending subscriptions...');

        // Start ping interval (KuCoin expects ping every 10 seconds)
        this.startPingLoop();

        // Subscribe to Level 2 orderbook (Depth)
        this.ws?.send(JSON.stringify({
          id: Date.now().toString() + '_l2',
          type: 'subscribe',
          topic: '/market/level2:BTC-USDT,ETH-USDT,SOL-USDT',
          privateChannel: false,
          response: true
        }));

        // Subscribe to Trades (Match)
        this.ws?.send(JSON.stringify({
          id: Date.now().toString() + '_match',
          type: 'subscribe',
          topic: '/market/match:BTC-USDT,ETH-USDT,SOL-USDT',
          privateChannel: false,
          response: true
        }));
      });

      this.ws.on('message', (data: Buffer) => {
        const rawStr = data.toString();
        try {
          const payload = JSON.parse(rawStr);
          if (payload.type === 'pong') return; // handle pong response silently

          const eventData = payload.data;
          const topic = payload.topic || '';
          if (!eventData || !topic) return;

          // Latency Calculation
          const receiveTime = Date.now();
          const eventTime = eventData.time ? Math.floor(eventData.time / 1000000) : receiveTime; // KuCoin uses nanosecond timestamps
          const networkLatency = Math.max(0, receiveTime - eventTime);

          // Determine symbol
          let symbol = '';
          if (topic.includes('BTC-USDT')) symbol = 'BTCUSDT';
          else if (topic.includes('ETH-USDT')) symbol = 'ETHUSDT';
          else if (topic.includes('SOL-USDT')) symbol = 'SOLUSDT';

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
          if (topic.startsWith('/market/level2')) {
            if (!this.isActiveGetter()) return;
            const lob = this.orderBooks.get(symbol);
            if (lob && eventData.changes) {
              const bids = (eventData.changes.bids || []).map((b: any) => [b[0], b[1]] as [string, string]);
              const asks = (eventData.changes.asks || []).map((a: any) => [a[0], a[1]] as [string, string]);
              
              if (bids.length > 0 || asks.length > 0) {
                lob.injectExternalDepth(bids, asks);
                this.broadcastCallback(symbol);
              }
            }
          } 
          
          // Handle trade updates (match)
          else if (topic.startsWith('/market/match')) {
            if (!this.isActiveGetter()) return;
            const price = parseFloat(eventData.price);
            const quantity = parseFloat(eventData.size);
            const isBuy = eventData.side === 'buy';

            const lob = this.orderBooks.get(symbol);
            if (lob) {
              lob.lastPrice = price;
            }

            // Update main market data engine
            this.marketEngine.updatePriceTick(symbol, price);

            // Feed tick to Autonomous Trading Bot
            this.autonomousEngine.onMarketTick(symbol, price, quantity, isBuy);

            this.broadcastCallback(symbol);
          }

        } catch (err) {
          // Suppress parsing issues on malformed messages to maintain low latency loop
        }
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        this.stopPingLoop();
        console.warn('[KUCOIN WS CLOSED] Reconnecting in ' + this.reconnectDelay + 'ms...');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[KUCOIN WS ERROR]', err.message);
        this.ws?.close();
      });

    } catch (err: any) {
      console.error('[KUCOIN Bullet-Public connection failed]', err.message || err);
      this.scheduleReconnect();
    }
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          id: Date.now().toString(),
          type: 'ping'
        }));
      }
    }, 10000);
  }

  private stopPingLoop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
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
    this.stopPingLoop();
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

import { EventEmitter } from 'events';
import { Asset, Candlestick, MarketContext, MarketTrend } from '../src/types.js';

export interface IndicatorValues {
  rsi: number;
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  volatility: number;
  trend: MarketTrend;
}

export const INITIAL_ASSETS: Asset[] = [
  {
    symbol: 'BTCUSDT',
    name: 'Bitcoin / Tether',
    category: 'Crypto',
    price: 94850.00,
    change24h: 3.42,
    high24h: 96200.00,
    low24h: 91400.00,
    volume24h: 24810.45,
    spread: 0.50,
    decimals: 2
  },
  {
    symbol: 'ETHUSDT',
    name: 'Ethereum / Tether',
    category: 'Crypto',
    price: 2740.50,
    change24h: -1.15,
    high24h: 2820.00,
    low24h: 2690.00,
    volume24h: 184200.10,
    spread: 0.10,
    decimals: 2
  },
  {
    symbol: 'SOLUSDT',
    name: 'Solana / Tether',
    category: 'Crypto',
    price: 184.20,
    change24h: 5.80,
    high24h: 189.50,
    low24h: 172.00,
    volume24h: 940120.00,
    spread: 0.05,
    decimals: 2
  },
  {
    symbol: 'EURUSD',
    name: 'Euro / US Dollar',
    category: 'Forex',
    price: 1.08450,
    change24h: 0.18,
    high24h: 1.08720,
    low24h: 1.08210,
    volume24h: 4820000.00,
    spread: 0.00010,
    decimals: 5
  },
  {
    symbol: 'GBPUSD',
    name: 'British Pound / US Dollar',
    category: 'Forex',
    price: 1.29800,
    change24h: -0.32,
    high24h: 1.30350,
    low24h: 1.29400,
    volume24h: 3120000.00,
    spread: 0.00015,
    decimals: 5
  },
  {
    symbol: 'XAUUSD',
    name: 'Gold / US Dollar (Arany)',
    category: 'Commodity',
    price: 2715.40,
    change24h: 0.84,
    high24h: 2732.10,
    low24h: 2698.50,
    volume24h: 6850000.00,
    spread: 0.25,
    decimals: 2
  },
  {
    symbol: 'XAGUSD',
    name: 'Silver / US Dollar (Ezüst)',
    category: 'Commodity',
    price: 31.85,
    change24h: 1.62,
    high24h: 32.40,
    low24h: 31.20,
    volume24h: 2450000.00,
    spread: 0.02,
    decimals: 3
  }
];

export class MarketDataEngine extends EventEmitter {
  private candlesMap: Map<string, Candlestick[]> = new Map();
  // Pre-allocated Float64Array buffers for zero-allocation performance (120 candles * 6 parameters each)
  private candleBuffers: Map<string, Float64Array> = new Map();
  private candleCounts: Map<string, number> = new Map();
  public assets: Asset[] = [...INITIAL_ASSETS];

  constructor() {
    super();
    this.seedCandles();
  }

  private packCandles(symbol: string, candles: Candlestick[]) {
    let buffer = this.candleBuffers.get(symbol);
    if (!buffer) {
      buffer = new Float64Array(120 * 6);
      this.candleBuffers.set(symbol, buffer);
    }
    const slice = candles.slice(-120);
    this.candleCounts.set(symbol, slice.length);
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      const offset = i * 6;
      buffer[offset] = c.timestamp;
      buffer[offset + 1] = c.open;
      buffer[offset + 2] = c.high;
      buffer[offset + 3] = c.low;
      buffer[offset + 4] = c.close;
      buffer[offset + 5] = c.volume;
    }
  }

  private unpackCandles(symbol: string): Candlestick[] {
    const buffer = this.candleBuffers.get(symbol);
    const count = this.candleCounts.get(symbol) || 0;
    if (!buffer || count === 0) return [];
    
    const candles: Candlestick[] = [];
    for (let i = 0; i < count; i++) {
      const offset = i * 6;
      candles.push({
        timestamp: buffer[offset],
        open: buffer[offset + 1],
        high: buffer[offset + 2],
        low: buffer[offset + 3],
        close: buffer[offset + 4],
        volume: buffer[offset + 5]
      });
    }
    return candles;
  }

  private seedCandles() {
    for (const asset of this.assets) {
      const candles: Candlestick[] = [];
      let basePrice = asset.price;
      const now = Date.now();
      const intervalMs = 60 * 1000; // 1 min candles

      for (let i = 60; i >= 0; i--) {
        const time = now - i * intervalMs;
        const volatility = asset.price * (asset.category === 'Crypto' ? 0.0015 : 0.0003);
        const change = (Math.random() - 0.49) * volatility;
        const open = basePrice;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * volatility * 0.5;
        const low = Math.min(open, close) - Math.random() * volatility * 0.5;
        const volume = Number((Math.random() * 50 + 10).toFixed(2));

        candles.push({
          timestamp: time,
          open: Number(open.toFixed(asset.decimals)),
          high: Number(high.toFixed(asset.decimals)),
          low: Number(low.toFixed(asset.decimals)),
          close: Number(close.toFixed(asset.decimals)),
          volume
        });

        basePrice = close;
      }
      this.candlesMap.set(asset.symbol, candles);
      this.packCandles(asset.symbol, candles);
    }
  }

  public getCandles(symbol: string): Candlestick[] {
    return this.unpackCandles(symbol);
  }

  public updatePriceTick(symbol: string, newPrice: number) {
    const asset = this.assets.find(a => a.symbol === symbol);
    if (!asset) return;

    asset.price = newPrice;
    asset.high24h = Math.max(asset.high24h, newPrice);
    asset.low24h = Math.min(asset.low24h, newPrice);

    let buffer = this.candleBuffers.get(symbol);
    let count = this.candleCounts.get(symbol) || 0;
    if (!buffer) {
      buffer = new Float64Array(120 * 6);
      this.candleBuffers.set(symbol, buffer);
    }

    const now = Date.now();
    if (count > 0) {
      const lastOffset = (count - 1) * 6;
      const lastTimestamp = buffer[lastOffset];

      if (now - lastTimestamp < 60000) {
        // High-speed, zero-allocation updates inside Float64Array
        buffer[lastOffset + 2] = Math.max(buffer[lastOffset + 2], newPrice);
        buffer[lastOffset + 3] = Math.min(buffer[lastOffset + 3], newPrice);
        buffer[lastOffset + 4] = newPrice;
        buffer[lastOffset + 5] += Number((Math.random() * 0.5).toFixed(2));
      } else {
        // Roll-over window logic using copyWithin to keep V8 memory clean and persistent
        if (count >= 120) {
          buffer.copyWithin(0, 6, 120 * 6);
          count = 120;
        } else {
          count++;
        }
        this.candleCounts.set(symbol, count);
        const lastOffset = (count - 1) * 6;
        buffer[lastOffset] = now;
        buffer[lastOffset + 1] = newPrice;
        buffer[lastOffset + 2] = newPrice;
        buffer[lastOffset + 3] = newPrice;
        buffer[lastOffset + 4] = newPrice;
        buffer[lastOffset + 5] = Number((Math.random() * 1.5 + 0.1).toFixed(2));
      }
    } else {
      count = 1;
      this.candleCounts.set(symbol, count);
      buffer[0] = now;
      buffer[1] = newPrice;
      buffer[2] = newPrice;
      buffer[3] = newPrice;
      buffer[4] = newPrice;
      buffer[5] = Number((Math.random() * 1.5 + 0.1).toFixed(2));
    }

    // Keep candlesMap in sync for any standard references
    const candlesList = this.unpackCandles(symbol);
    this.candlesMap.set(symbol, candlesList);
    this.emit('tick', symbol, newPrice, now);
  }

  public computeIndicators(symbol: string): IndicatorValues {
    const candles = this.getCandles(symbol);
    const asset = this.assets.find(a => a.symbol === symbol);
    const decimals = asset ? asset.decimals : 2;

    if (candles.length < 15) {
      return {
        rsi: 50,
        macdLine: 0,
        macdSignal: 0,
        macdHist: 0,
        bbUpper: asset ? asset.price * 1.01 : 100,
        bbMiddle: asset ? asset.price : 100,
        bbLower: asset ? asset.price * 0.99 : 100,
        volatility: 0.005,
        trend: 'NEUTRAL'
      };
    }

    const closes = candles.map(c => c.close);
    const n = closes.length;

    // RSI 14
    let gains = 0;
    let losses = 0;
    for (let i = n - 14; i < n; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = Number((100 - 100 / (1 + rs)).toFixed(1));

    // Simple Moving Average (SMA 20)
    const sma20Slice = closes.slice(-20);
    const sma20 = sma20Slice.reduce((sum, val) => sum + val, 0) / sma20Slice.length;

    // Standard Deviation for Bollinger Bands
    const variance = sma20Slice.reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / sma20Slice.length;
    const stdDev = Math.sqrt(variance);

    const bbUpper = Number((sma20 + 2 * stdDev).toFixed(decimals));
    const bbMiddle = Number(sma20.toFixed(decimals));
    const bbLower = Number((sma20 - 2 * stdDev).toFixed(decimals));

    // MACD (12, 26, 9)
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;
    const macdSignal = macdLine * 0.8; // simplified
    const macdHist = Number((macdLine - macdSignal).toFixed(decimals));

    // Volatility (ATR-like ratio)
    const volatility = Number((stdDev / (asset ? asset.price : 1)).toFixed(4));

    // Trend identification
    let trend: MarketTrend = 'NEUTRAL';
    const lastPrice = closes[n - 1];
    if (lastPrice > bbUpper * 0.998 && rsi > 60) {
      trend = 'BULLISH';
    } else if (lastPrice < bbLower * 1.002 && rsi < 40) {
      trend = 'BEARISH';
    } else if (volatility < 0.0015) {
      trend = 'CONSOLIDATION';
    } else {
      trend = rsi > 52 ? 'BULLISH' : rsi < 48 ? 'BEARISH' : 'NEUTRAL';
    }

    return {
      rsi,
      macdLine: Number(macdLine.toFixed(decimals)),
      macdSignal: Number(macdSignal.toFixed(decimals)),
      macdHist,
      bbUpper,
      bbMiddle,
      bbLower,
      volatility,
      trend
    };
  }

  private calculateEMA(data: number[], period: number): number {
    const k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    return ema;
  }

  public getMarketContext(symbol: string, obImbalance: number = 0): MarketContext {
    const asset = this.assets.find(a => a.symbol === symbol) || this.assets[0];
    const ind = this.computeIndicators(symbol);

    const newsOptions: ('POSITIVE' | 'NEGATIVE' | 'NEUTRAL')[] = ['NEUTRAL', 'POSITIVE', 'NEUTRAL', 'NEGATIVE', 'NEUTRAL'];
    const newsSentiment = newsOptions[Math.floor(Math.abs(Math.sin(Date.now() / 30000)) * newsOptions.length)];

    return {
      symbol: asset.symbol,
      price: asset.price,
      rsi: ind.rsi,
      macdHist: ind.macdHist,
      volatility: ind.volatility,
      volume: asset.volume24h,
      trend: ind.trend,
      obImbalance,
      newsSentiment
    };
  }
}

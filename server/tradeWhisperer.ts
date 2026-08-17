import { EventEmitter } from 'events';
import { TradeSignal } from '../src/types.js';

export interface PriceTick {
  price: number;
  ts: number;
}

export interface SymbolStateForWhisperer {
  symbol: string;
  price: number;
  priceHistory: PriceTick[];
  lastUpdate: number;
}

export class TradeWhispererEngine extends EventEmitter {
  private symbolsState: Map<string, SymbolStateForWhisperer> = new Map();
  private signalsHistory: TradeSignal[] = [];
  private intervalTimer: NodeJS.Timeout | null = null;

  // Reference ratios for cross-asset synthetic arbitrage / relative value
  private referenceRatios = {
    XAU_BTC: 0.038, // 1 XAUUSD / 1 BTCUSDT (~$2350 / ~$62000)
    ETH_BTC: 0.050, // 1 ETHUSDT / 1 BTCUSDT (~$3100 / ~$62000)
    XAG_XAU: 0.012, // 1 XAGUSD / 1 XAUUSD (~$28 / ~$2350)
    SOL_ETH: 0.045  // 1 SOLUSDT / 1 ETHUSDT (~$140 / ~$3100)
  };

  private deviationThresholds = {
    XAU_BTC: 0.0005, // 0.05%
    ETH_BTC: 0.0002, // 0.02%
    XAG_XAU: 0.0003,
    SOL_ETH: 0.0004
  };

  constructor(trackedSymbols: string[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSD', 'XAGUSD', 'EURUSD', 'GBPUSD']) {
    super();
    trackedSymbols.forEach(sym => {
      this.symbolsState.set(sym, {
        symbol: sym,
        price: 0,
        priceHistory: [],
        lastUpdate: Date.now()
      });
    });
  }

  public start(intervalMs: number = 3000) {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.analyzeAndRecommend();
    }, intervalMs);
    console.log(`[TradeWhisperer] Inicializálva, ${intervalMs}ms-enként elemzi a multi-asset piacokat.`);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public updatePrice(symbol: string, price: number, timestamp: number = Date.now()) {
    if (price <= 0) return;
    let state = this.symbolsState.get(symbol);
    if (!state) {
      state = {
        symbol,
        price,
        priceHistory: [],
        lastUpdate: timestamp
      };
      this.symbolsState.set(symbol, state);
    }

    state.price = price;
    state.lastUpdate = timestamp;
    state.priceHistory.push({ price, ts: timestamp });

    // Keep last 120 ticks (sliding memory window)
    if (state.priceHistory.length > 120) {
      state.priceHistory.shift();
    }
  }

  public getSignals(limit: number = 20): TradeSignal[] {
    return this.signalsHistory.slice(0, limit);
  }

  public analyzeAndRecommend(): TradeSignal[] {
    const signals: TradeSignal[] = [];
    const now = Date.now();

    // 1. --- Momentum Elemzés (egyedi szimbólumokra) ---
    const MOMENTUM_WINDOW_MS = 5000; // 5 másodperc
    const MOMENTUM_THRESHOLD_PERCENT = 0.08; // 0.08% elmozdulás HFT-ben már szignifikáns

    for (const [symbol, state] of this.symbolsState.entries()) {
      if (!state || state.price === 0 || state.priceHistory.length < 2) continue;

      // Árkeresés a momentum ablak elejéről
      const oldPriceEntry = state.priceHistory.find(entry => now - entry.ts >= MOMENTUM_WINDOW_MS) || state.priceHistory[0];
      if (oldPriceEntry && oldPriceEntry.price > 0 && oldPriceEntry !== state.priceHistory[state.priceHistory.length - 1]) {
        const priceChange = ((state.price - oldPriceEntry.price) / oldPriceEntry.price) * 100;

        if (priceChange >= MOMENTUM_THRESHOLD_PERCENT) {
          const strength = Math.min(98, Math.round(65 + Math.abs(priceChange) * 40));
          signals.push({
            type: 'MOMENTUM_BUY',
            symbol: symbol,
            action: 'BUY',
            confidence: strength,
            strength,
            message: `${symbol} erős VÉTELI momentumot mutat (+${priceChange.toFixed(2)}% ${Math.round((now - oldPriceEntry.ts)/1000)}mp alatt). Vételi nyomás dominál.`,
            timestamp: now,
            metrics: {
              priceChange15s: priceChange,
              spreadPct: 0.01
            }
          });
        } else if (priceChange <= -MOMENTUM_THRESHOLD_PERCENT) {
          const strength = Math.min(98, Math.round(65 + Math.abs(priceChange) * 40));
          signals.push({
            type: 'MOMENTUM_SELL',
            symbol: symbol,
            action: 'SELL',
            confidence: strength,
            strength,
            message: `${symbol} erős ELADÁSI momentumot mutat (${priceChange.toFixed(2)}% ${Math.round((now - oldPriceEntry.ts)/1000)}mp alatt). Eladási hullám aktív.`,
            timestamp: now,
            metrics: {
              priceChange15s: priceChange,
              spreadPct: 0.01
            }
          });
        }
      }
    }

    // 2. --- Arany-Kripto és Kereszt-eszköz Relatív Érték / Arbitrázs Elemzés ---
    const xauState = this.symbolsState.get('XAUUSD');
    const btcState = this.symbolsState.get('BTCUSDT');
    const ethState = this.symbolsState.get('ETHUSDT');
    const xagState = this.symbolsState.get('XAGUSD');

    // XAU / BTC kalkulált arány
    if (xauState?.price && btcState?.price && xauState.price > 0 && btcState.price > 0) {
      const impliedXauToBtc = xauState.price / btcState.price; // Hány BTC ér 1 uncia XAU-t
      const deviation = impliedXauToBtc - this.referenceRatios.XAU_BTC;

      if (Math.abs(deviation) > this.deviationThresholds.XAU_BTC) {
        let message = `[ARBITRÁZS FIGYELMEZTETÉS] XAU/BTC kalkulált arány (${impliedXauToBtc.toFixed(5)}) eltér a referencia (${this.referenceRatios.XAU_BTC.toFixed(5)}) értéktől.`;
        const action = impliedXauToBtc > this.referenceRatios.XAU_BTC ? 'SELL' : 'BUY';
        if (impliedXauToBtc > this.referenceRatios.XAU_BTC) {
          message += ` XAU relatíve túlértékelt BTC-hez képest. Javaslat: XAU eladása BTC vétellel szemben.`;
        } else {
          message += ` XAU relatíve alulértékelt BTC-hez képest. Javaslat: XAU vétele BTC fedezéssel.`;
        }
        signals.push({
          type: 'ARBITRAGE',
          symbol: 'XAUUSD',
          action,
          confidence: 88,
          strength: 88,
          message,
          timestamp: now,
          metrics: {
            xauBtcRatio: impliedXauToBtc
          }
        });
      }
    }

    // ETH / BTC kalkulált arány
    if (ethState?.price && btcState?.price && ethState.price > 0 && btcState.price > 0) {
      const impliedEthToBtc = ethState.price / btcState.price;
      const deviation = impliedEthToBtc - this.referenceRatios.ETH_BTC;

      if (Math.abs(deviation) > this.deviationThresholds.ETH_BTC) {
        let message = `[RELATÍV ÉRTÉK FIGYELMEZTETÉS] ETH/BTC kalkulált arány (${impliedEthToBtc.toFixed(5)}) eltér a referencia (${this.referenceRatios.ETH_BTC.toFixed(5)}) szinttől.`;
        const action = impliedEthToBtc > this.referenceRatios.ETH_BTC ? 'SELL' : 'BUY';
        if (impliedEthToBtc > this.referenceRatios.ETH_BTC) {
          message += ` ETH relatíve drágább BTC-hez képest. Fontold meg ETH realizálását.`;
        } else {
          message += ` ETH relatíve olcsóbb BTC-hez képest. Értéknövekedési vételi zóna.`;
        }
        signals.push({
          type: 'RELATIVE_VALUE',
          symbol: 'ETHUSDT',
          action,
          confidence: 78,
          strength: 78,
          message,
          timestamp: now,
          metrics: {
            ethBtcRatio: impliedEthToBtc
          }
        });
      }
    }

    // XAG / XAU (Arany-Ezüst arány)
    if (xagState?.price && xauState?.price && xagState.price > 0 && xauState.price > 0) {
      const impliedAgAu = xagState.price / xauState.price;
      const deviation = impliedAgAu - this.referenceRatios.XAG_XAU;
      if (Math.abs(deviation) > this.deviationThresholds.XAG_XAU) {
        const action = impliedAgAu > this.referenceRatios.XAG_XAU ? 'SELL' : 'BUY';
        signals.push({
          type: 'RELATIVE_VALUE',
          symbol: 'XAGUSD',
          action,
          confidence: 72,
          strength: 72,
          message: `[ARANY-EZÜST DIVERGENCIA] XAG/XAU arány: ${impliedAgAu.toFixed(5)}. Ezüst relatív elmozdulás az aranyhoz képest.`,
          timestamp: now,
          metrics: {
            spreadPct: 0.02
          }
        });
      }
    }

    // Mentés a történetbe és eseményküldés
    if (signals.length > 0) {
      // Prepend newest signals
      this.signalsHistory = [...signals, ...this.signalsHistory].slice(0, 50);
      this.emit('signals', signals);
    }

    return signals;
  }
}

export type { TradeSignal };

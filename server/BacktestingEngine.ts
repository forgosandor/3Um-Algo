import { MarketContext, TradeSide } from '../src/types.js';

export interface BacktestParams {
  symbol: string;
  startingBalance: number;
  kellyFraction: number; // 0.1 to 1.0
  stopLossPct: number;   // 0.1 to 2.0%
  takeProfitMultiplier: number; // 1.0 to 5.0 (R:R ratio)
  ofiThreshold: number;  // Imbalance threshold (e.g. 0.3)
  ofiWindow: number;     // Window size (e.g. 10 ticks)
}

export interface BacktestTrade {
  id: string;
  timestamp: number;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnlAbs: number;
  pnlRatio: number;
  isProfitable: boolean;
  notes: string;
  balanceAfter: number;
}

export interface BacktestResult {
  params: BacktestParams;
  initialBalance: number;
  finalBalance: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  sharpeRatio: number;
  trades: BacktestTrade[];
  executionTimeMs: number;
  throughputTps: number;
}

export interface OptimizationGridPoint {
  stopLossPct: number;
  kellyFraction: number;
  finalBalance: number;
  winRate: number;
}

export class BacktestingEngine {
  /**
   * Generates a high-fidelity synthetic historical L2 tick dataset (e.g. 5000 ticks)
   * simulating realistic high-frequency microstructure: Brownian price movement,
   * orderbook imbalance shifts, and momentum across various market regimes.
   */
  public static generateSyntheticTicks(
    symbol: string,
    length = 5000,
    regime: 'mean_reversion' | 'bull_run' | 'flash_crash' | 'high_frequency_noise' = 'mean_reversion'
  ): { price: number; obImbalance: number; timestamp: number }[] {
    const ticks: { price: number; obImbalance: number; timestamp: number }[] = [];
    let price = symbol === 'BTCUSDT' ? 95000 : symbol === 'ETHUSDT' ? 3400 : 180;
    const volatility = symbol === 'BTCUSDT' ? 12 : symbol === 'ETHUSDT' ? 0.6 : 0.05;
    let trendMomentum = 0;
    let timestamp = Date.now() - length * 100; // 100ms intervals backwards

    const initialPrice = price;

    for (let i = 0; i < length; i++) {
      let obImbalance = 0;
      let trendBias = 0;
      let volMultiplier = 1.0;

      // Adapt parameters based on historical market regime profile
      switch (regime) {
        case 'bull_run':
          // Strong positive demand, bid-side loaded orderbook
          obImbalance = Math.sin(i * 0.02) * 0.3 + 0.25 + (Math.random() - 0.4) * 0.5;
          trendBias = 0.08;
          volMultiplier = 0.9;
          break;

        case 'flash_crash':
          // Severe liquidity drain, high panic, massive selling pressure
          if (i > length * 0.3 && i < length * 0.5) {
            // Main crash phase
            obImbalance = -0.7 - Math.random() * 0.3;
            trendBias = -0.65;
            volMultiplier = 3.5;
          } else if (i >= length * 0.5 && i < length * 0.7) {
            // High volatility bounce & recovery
            obImbalance = 0.5 + Math.random() * 0.5;
            trendBias = 0.45;
            volMultiplier = 2.5;
          } else {
            // Normal sideways preceding/following
            obImbalance = Math.sin(i * 0.05) * 0.2 + (Math.random() - 0.5) * 0.4;
            trendBias = -0.02;
            volMultiplier = 1.1;
          }
          break;

        case 'high_frequency_noise':
          // Pure erratic microstructure jitter, thin spread, high-frequency oscillations
          obImbalance = (Math.random() - 0.5) * 0.9;
          trendBias = 0;
          volMultiplier = 1.6;
          break;

        case 'mean_reversion':
        default:
          // Low volatility, high oscillation, pulls prices back to mean level
          obImbalance = Math.sin(i * 0.08) * 0.45 + (Math.random() - 0.5) * 0.3;
          // Soft pull back to initial price level if price deviates too far
          const deviation = (initialPrice - price) / initialPrice;
          trendBias = deviation * 0.15;
          volMultiplier = 0.7;
          break;
      }

      // Constrain imbalance between -1 and 1
      obImbalance = Math.max(-1, Math.min(1, obImbalance));

      // Momentum is influenced by orderbook imbalance (OFI effect)
      trendMomentum = trendMomentum * 0.85 + (obImbalance * 0.15) + trendBias;
      
      const change = trendMomentum * (volatility * volMultiplier) + (Math.random() - 0.5) * (volatility * volMultiplier);
      price = Math.max(1, price + change);
      
      ticks.push({
        price: Number(price.toFixed(symbol === 'BTCUSDT' ? 2 : 4)),
        obImbalance,
        timestamp: timestamp + i * 100
      });
    }

    return ticks;
  }

  /**
   * High-throughput backtest simulator running entirely in-memory (Hot Path)
   */
  public static run(params: BacktestParams, ticks: { price: number; obImbalance: number; timestamp: number }[]): BacktestResult {
    const start = performance.now();
    let balance = params.startingBalance;
    const trades: BacktestTrade[] = [];
    
    let activePosition: {
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      amount: number;
      stopPrice: number;
      takeProfitPrice: number;
      entryTime: number;
    } | null = null;

    let peakBalance = balance;
    let maxDrawdown = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let grossProfits = 0;
    let grossLosses = 0;

    // Moving average of Order Flow Imbalance (OFI Window)
    const ofiWindowSize = params.ofiWindow;
    const recentImbalances: number[] = [];

    // Main event loop (microsecond in-memory matching replay)
    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i];
      recentImbalances.push(tick.obImbalance);
      if (recentImbalances.length > ofiWindowSize) {
        recentImbalances.shift();
      }

      const avgOFI = recentImbalances.reduce((sum, v) => sum + v, 0) / recentImbalances.length;

      // 1. Check if existing position SL / TP was hit
      if (activePosition) {
        let closed = false;
        let exitPrice = tick.price;
        let isProfitable = false;
        let pnlRatio = 0;
        let pnlAbs = 0;

        if (activePosition.side === 'LONG') {
          if (tick.price <= activePosition.stopPrice) {
            // SL hit
            exitPrice = activePosition.stopPrice;
            pnlRatio = -params.stopLossPct / 100;
            pnlAbs = activePosition.amount * (exitPrice - activePosition.entryPrice);
            closed = true;
          } else if (tick.price >= activePosition.takeProfitPrice) {
            // TP hit
            exitPrice = activePosition.takeProfitPrice;
            pnlRatio = (params.stopLossPct * params.takeProfitMultiplier) / 100;
            pnlAbs = activePosition.amount * (exitPrice - activePosition.entryPrice);
            closed = true;
          }
        } else if (activePosition.side === 'SHORT') {
          if (tick.price >= activePosition.stopPrice) {
            // SL hit
            exitPrice = activePosition.stopPrice;
            pnlRatio = -params.stopLossPct / 100;
            pnlAbs = activePosition.amount * (activePosition.entryPrice - exitPrice);
            closed = true;
          } else if (tick.price <= activePosition.takeProfitPrice) {
            // TP hit
            exitPrice = activePosition.takeProfitPrice;
            pnlRatio = (params.stopLossPct * params.takeProfitMultiplier) / 100;
            pnlAbs = activePosition.amount * (activePosition.entryPrice - exitPrice);
            closed = true;
          }
        }

        if (closed) {
          isProfitable = pnlAbs > 0;
          balance += pnlAbs;

          if (isProfitable) {
            totalWins++;
            grossProfits += pnlAbs;
          } else {
            totalLosses++;
            grossLosses += Math.abs(pnlAbs);
          }

          // Track Max Drawdown
          if (balance > peakBalance) {
            peakBalance = balance;
          }
          const dd = (peakBalance - balance) / peakBalance;
          if (dd > maxDrawdown) {
            maxDrawdown = dd;
          }

          trades.push({
            id: `bt_${trades.length + 1}_${tick.timestamp}`,
            timestamp: tick.timestamp,
            side: activePosition.side,
            entryPrice: activePosition.entryPrice,
            exitPrice: exitPrice,
            amount: activePosition.amount,
            pnlAbs: Number(pnlAbs.toFixed(2)),
            pnlRatio: Number((pnlRatio * 100).toFixed(2)),
            isProfitable,
            notes: isProfitable 
              ? `Célár teljesült (TP: $${exitPrice.toFixed(2)})` 
              : `Stop Loss aktiválódott (SL: $${exitPrice.toFixed(2)})`,
            balanceAfter: Number(balance.toFixed(2))
          });

          activePosition = null;
        }
      }

      // 2. Signal Generation (OFI Trigger)
      if (!activePosition) {
        let triggerSide: 'LONG' | 'SHORT' | null = null;
        if (avgOFI > params.ofiThreshold) {
          triggerSide = 'LONG';
        } else if (avgOFI < -params.ofiThreshold) {
          triggerSide = 'SHORT';
        }

        if (triggerSide) {
          // Calculate Kelly Fraction size
          // Risking fraction of balance
          const riskAmount = balance * (params.stopLossPct / 100) * params.kellyFraction;
          
          // Stop distance
          const stopDistance = tick.price * (params.stopLossPct / 100);
          const amount = riskAmount / stopDistance;

          if (amount > 0 && balance > riskAmount) {
            const entryPrice = tick.price;
            let stopPrice = 0;
            let takeProfitPrice = 0;

            if (triggerSide === 'LONG') {
              stopPrice = entryPrice - stopDistance;
              takeProfitPrice = entryPrice + stopDistance * params.takeProfitMultiplier;
            } else {
              stopPrice = entryPrice + stopDistance;
              takeProfitPrice = entryPrice - stopDistance * params.takeProfitMultiplier;
            }

            activePosition = {
              side: triggerSide,
              entryPrice,
              amount,
              stopPrice: Number(stopPrice.toFixed(4)),
              takeProfitPrice: Number(takeProfitPrice.toFixed(4)),
              entryTime: tick.timestamp
            };
          }
        }
      }
    }

    const end = performance.now();
    const executionTimeMs = end - start;
    const winRate = trades.length > 0 ? (totalWins / trades.length) * 100 : 0;
    const profitFactor = grossLosses > 0 ? grossProfits / grossLosses : grossProfits > 0 ? 999 : 0;
    
    // Simple Sharpe Ratio estimation (returns / variance)
    const returns = trades.map(t => t.pnlRatio);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / (returns.length || 1);
    const stdDev = Math.sqrt(variance) || 1;
    const sharpeRatio = avgReturn / stdDev * Math.sqrt(trades.length || 1);

    return {
      params,
      initialBalance: params.startingBalance,
      finalBalance: Number(balance.toFixed(2)),
      totalTrades: trades.length,
      wins: totalWins,
      losses: totalLosses,
      winRate: Number(winRate.toFixed(2)),
      profitFactor: Number(profitFactor.toFixed(2)),
      maxDrawdownPct: Number((maxDrawdown * 100).toFixed(2)),
      sharpeRatio: Number(sharpeRatio.toFixed(2)),
      trades,
      executionTimeMs,
      throughputTps: Math.round(ticks.length / (executionTimeMs / 1000))
    };
  }

  /**
   * Run 3D Grid parameter optimization for Kelly and Stop Loss
   */
  public static optimize(symbol: string, initialBalance: number, currentParams: BacktestParams, ticks: { price: number; obImbalance: number; timestamp: number }[]): OptimizationGridPoint[] {
    const stopLosses = [0.2, 0.5, 0.8, 1.2, 1.5];
    const kellyFractions = [0.1, 0.2, 0.5, 0.8, 1.0];
    const grid: OptimizationGridPoint[] = [];

    for (const sl of stopLosses) {
      for (const k of kellyFractions) {
        const testResult = this.run({
          ...currentParams,
          startingBalance: initialBalance,
          stopLossPct: sl,
          kellyFraction: k
        }, ticks);

        grid.push({
          stopLossPct: sl,
          kellyFraction: k,
          finalBalance: testResult.finalBalance,
          winRate: testResult.winRate
        });
      }
    }

    return grid;
  }
}

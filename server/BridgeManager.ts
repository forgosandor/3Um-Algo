import { BinanceBridge } from './BinanceBridge.js';
import { KucoinBridge } from './KucoinBridge.js';

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export interface SystemState {
  status: 'OK' | 'WARN' | 'HALT';
  latency: number;
}

export class BridgeGuard {
  private binanceBridge: BinanceBridge;
  private kucoinBridge: KucoinBridge;
  private thresholdWarn = 200; // ms
  private thresholdCritical = 500; // ms

  constructor(binanceBridge: BinanceBridge, kucoinBridge: KucoinBridge) {
    this.binanceBridge = binanceBridge;
    this.kucoinBridge = kucoinBridge;
  }

  public checkHealth(activeFeedSource: 'binance' | 'kucoin', symbol: string): SystemState {
    const bridge = activeFeedSource === 'binance' ? this.binanceBridge : this.kucoinBridge;
    
    // If bridge is not connected, it is a halt state
    if (!bridge.getIsConnected()) {
      return { status: 'HALT', latency: 9999 };
    }

    const metrics = bridge.getMetricsSummary();
    const symbolMetrics = metrics[symbol];

    // If no metrics yet, we are OK with 0 latency
    if (!symbolMetrics) {
      return { status: 'OK', latency: 0 };
    }

    // Use currentJitterMs or averageJitterMs? The user says: "jitter-adatait figyeli... THRESHOLD_WARN = 200ms, THRESHOLD_CRITICAL = 500ms"
    // Let's use the current jitter, or the max of current and average for resilience. Let's use currentJitterMs as the immediate metric.
    const latency = symbolMetrics.currentJitterMs;

    if (latency >= this.thresholdCritical) {
      return { status: 'HALT', latency };
    } else if (latency >= this.thresholdWarn) {
      return { status: 'WARN', latency };
    } else {
      return { status: 'OK', latency };
    }
  }
}

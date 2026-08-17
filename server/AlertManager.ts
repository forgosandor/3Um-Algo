import { Gauge, Counter } from 'prom-client';

export interface SystemAlert {
  id: string;
  timestamp: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  type: 'LATENCY_SPIKE' | 'LOB_IMBALANCE' | 'DRAWDOWN_RISK' | 'HIGH_JITTER' | 'HIGH_QPS';
  symbol?: string;
  message: string;
  metricValue: number;
  threshold: number;
  acknowledged: boolean;
}

export const alertCounter = new Counter({
  name: 'hft_system_alerts_total',
  help: 'Total number of system alerts triggered',
  labelNames: ['severity', 'type']
});

export const lobImbalanceGauge = new Gauge({
  name: 'hft_lob_imbalance_ratio',
  help: 'Current Order Book Bid/Ask imbalance ratio',
  labelNames: ['symbol']
});

export const lobQueueDepthGauge = new Gauge({
  name: 'hft_lob_orders_count',
  help: 'Total active resting orders in LOB queue',
  labelNames: ['symbol', 'side']
});

export class AlertManager {
  private activeAlerts: SystemAlert[] = [];
  private alertListeners: ((alert: SystemAlert) => void)[] = [];

  constructor() {
    console.log('🔔 [ALERT & MONITORING MANAGER OPERATIONAL] Real-time Prometheus Alerting Pipeline Initialized');
  }

  public onAlert(listener: (alert: SystemAlert) => void) {
    this.alertListeners.push(listener);
  }

  public raiseAlert(params: {
    severity: SystemAlert['severity'];
    type: SystemAlert['type'];
    symbol?: string;
    message: string;
    metricValue: number;
    threshold: number;
  }): SystemAlert {
    const alert: SystemAlert = {
      id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      severity: params.severity,
      type: params.type,
      symbol: params.symbol,
      message: params.message,
      metricValue: params.metricValue,
      threshold: params.threshold,
      acknowledged: false
    };

    // Deduplicate recent identical active alerts within 5 seconds
    const recent = this.activeAlerts.find(
      a => a.type === alert.type && a.symbol === alert.symbol && Date.now() - a.timestamp < 5000
    );
    if (recent) return recent;

    this.activeAlerts.unshift(alert);
    if (this.activeAlerts.length > 200) {
      this.activeAlerts.pop();
    }

    alertCounter.inc({ severity: alert.severity, type: alert.type });

    // Notify WS clients
    for (const listener of this.alertListeners) {
      listener(alert);
    }

    return alert;
  }

  public getAlerts(filter?: { severity?: string; acknowledged?: boolean }): SystemAlert[] {
    let list = this.activeAlerts;
    if (filter?.severity) {
      list = list.filter(a => a.severity === filter.severity);
    }
    if (filter?.acknowledged !== undefined) {
      list = list.filter(a => a.acknowledged === filter.acknowledged);
    }
    return list;
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }
}

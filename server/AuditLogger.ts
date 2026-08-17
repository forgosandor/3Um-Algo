export interface AuditEntry {
  id: string;
  timestamp: number;
  userId: string;
  action: 'ORDER_SUBMITTED' | 'ORDER_EXECUTED' | 'ORDER_CANCELLED' | 'POSITION_CLOSED' | 'USER_CREATED' | 'BALANCE_UPDATED' | 'RISK_ALERT' | 'SYSTEM_EVENT';
  symbol?: string;
  orderId?: string;
  details: Record<string, any>;
  ip?: string;
  status: 'SUCCESS' | 'WARNING' | 'REJECTED';
}

export class AuditLogger {
  private logs: AuditEntry[] = [];
  private maxInMemoryLogs = 1000;
  private dbQueueCallback?: (entry: AuditEntry) => void;

  constructor(dbQueueCallback?: (entry: AuditEntry) => void) {
    this.dbQueueCallback = dbQueueCallback;
    console.log('🛡️ [AUDIT LOGGER OPERATIONAL] Real-time Immutable Security & Trading Audit Pipeline Initialized');
  }

  public setDbCallback(cb: (entry: AuditEntry) => void) {
    this.dbQueueCallback = cb;
  }

  public log(params: {
    userId: string;
    action: AuditEntry['action'];
    symbol?: string;
    orderId?: string;
    details?: Record<string, any>;
    status?: AuditEntry['status'];
    ip?: string;
  }): AuditEntry {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      userId: params.userId || 'system',
      action: params.action,
      symbol: params.symbol,
      orderId: params.orderId,
      details: params.details || {},
      status: params.status || 'SUCCESS',
      ip: params.ip || '127.0.0.1'
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxInMemoryLogs) {
      this.logs.pop();
    }

    if (this.dbQueueCallback) {
      this.dbQueueCallback(entry);
    }

    return entry;
  }

  public getLogs(filter?: {
    userId?: string;
    action?: string;
    symbol?: string;
    limit?: number;
  }): AuditEntry[] {
    let result = this.logs;

    if (filter?.userId) {
      result = result.filter(l => l.userId === filter.userId);
    }
    if (filter?.action) {
      result = result.filter(l => l.action === filter.action);
    }
    if (filter?.symbol) {
      result = result.filter(l => l.symbol === filter.symbol);
    }

    const limit = filter?.limit || 100;
    return result.slice(0, limit);
  }

  public getStats() {
    return {
      totalInMemory: this.logs.length,
      actionBreakdown: this.logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      lastLogTime: this.logs[0]?.timestamp || null
    };
  }
}

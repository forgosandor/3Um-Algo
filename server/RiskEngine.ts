import { Order } from '../src/types.js';

export interface RiskLimits {
  maxOrderValueUsd: number;      // Fat-finger protection: Maximum value of a single order (e.g., $100,000)
  maxOrderQty: number;            // Fat-finger protection: Maximum amount/qty in a single order
  priceCollarPct: number;        // Maximum deviation from last traded price (e.g., 5.0%)
  maxLeverage: number;           // Maximum leverage allowed (e.g., 20x)
  maxDailyLossPct: number;       // Circuit breaker: Maximum daily drawdown/loss (e.g., 5.0%)
  rateLimitPerSecond: number;    // High-frequency protection: Max orders per second (e.g., 100)
  washTradingPrevention: boolean; // Prevent self-matching (matching with own orders)
}

export interface RiskValidationResult {
  isValid: boolean;
  reason?: string;
  latencyNs: number; // Verification execution time in nanoseconds
  metrics: {
    orderValueUsd: number;
    priceDeviationPct: number;
    currentRateTps: number;
  };
}

export interface RiskLog {
  id: string;
  timestamp: number;
  userId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  price: number;
  amount: number;
  isValid: boolean;
  reason?: string;
  latencyNs: number;
}

export class RiskEngine {
  private limits: RiskLimits;
  
  // High-speed O(1) in-memory lookups
  private userExposures: Map<string, number> = new Map(); // userId -> current open total position exposure (USD)
  private userRateLimiters: Map<string, { count: number; windowStart: number }> = new Map(); // userId -> rate limit data
  private userDailyLosses: Map<string, number> = new Map(); // userId -> daily realized loss (USD)
  private activeOrders: Map<string, Order[]> = new Map(); // userId -> open orders list for wash trading check
  private riskLogs: RiskLog[] = [];

  constructor(customLimits?: Partial<RiskLimits>) {
    this.limits = {
      maxOrderValueUsd: 100000,       // $100,000 USD limit per single order
      maxOrderQty: 50,                // 50 Qty limit
      priceCollarPct: 5.0,            // Max 5% deviation from current price
      maxLeverage: 10,                // 10x Max leverage
      maxDailyLossPct: 10.0,          // 10% maximum daily balance loss before circuit breaker
      rateLimitPerSecond: 100,        // 100 orders per second limit
      washTradingPrevention: true,    // Prevent self-matching
      ...customLimits
    };
  }

  /**
   * Returns current active risk limits configuration
   */
  public getLimits(): RiskLimits {
    return this.limits;
  }

  /**
   * Updates risk limits on the fly (Zero downtime)
   */
  public updateLimits(newLimits: Partial<RiskLimits>) {
    this.limits = {
      ...this.limits,
      ...newLimits
    };
  }

  /**
   * Get all registered risk violation logs
   */
  public getRiskLogs(): RiskLog[] {
    return this.riskLogs;
  }

  /**
   * Clears risk violation logs to avoid high memory usage over time
   */
  public clearRiskLogs() {
    this.riskLogs = [];
  }

  /**
   * Reset stats (e.g. on new trading day)
   */
  public resetDailyLosses() {
    this.userDailyLosses.clear();
  }

  /**
   * Track realized trades PnL to verify Daily Loss boundaries
   */
  public registerTradePnl(userId: string, pnlUsd: number) {
    if (pnlUsd < 0) {
      const currentLoss = this.userDailyLosses.get(userId) || 0;
      this.userDailyLosses.set(userId, currentLoss + Math.abs(pnlUsd));
    }
  }

  /**
   * Register currently open orders for a user (used for wash trading detection)
   */
  public registerOpenOrder(userId: string, order: Order) {
    if (!this.activeOrders.has(userId)) {
      this.activeOrders.set(userId, []);
    }
    this.activeOrders.get(userId)!.push(order);
  }

  /**
   * Remove open order from tracking
   */
  public removeOpenOrder(userId: string, orderId: string) {
    const orders = this.activeOrders.get(userId);
    if (orders) {
      this.activeOrders.set(userId, orders.filter(o => o.id !== orderId));
    }
  }

  /**
   * Pre-Trade ultra-low-latency verification gate (<10 microseconds target)
   */
  public validateOrder(
    order: Order,
    lastPrice: number,
    userBalance: number,
    activeBookOrders?: Order[]
  ): RiskValidationResult {
    const startTimeNs = process.hrtime.bigint();
    const userId = order.userId;
    const orderPrice = order.type === 'LIMIT' ? order.price : lastPrice;
    const orderValueUsd = order.amount * orderPrice;

    // Default return parameters
    let isValid = true;
    let reason: string | undefined = undefined;
    let priceDeviationPct = 0;
    let currentRateTps = 0;

    // Calculate Price Deviation for Collar Check
    if (lastPrice > 0) {
      priceDeviationPct = Math.abs((orderPrice - lastPrice) / lastPrice) * 100;
    }

    // 1. Rate Limiting Check (Spam Filter)
    const nowMs = Date.now();
    let rateTracker = this.userRateLimiters.get(userId);
    if (!rateTracker || nowMs - rateTracker.windowStart >= 1000) {
      // New 1-second window
      rateTracker = { count: 1, windowStart: nowMs };
      this.userRateLimiters.set(userId, rateTracker);
    } else {
      rateTracker.count++;
    }
    currentRateTps = rateTracker.count;

    if (rateTracker.count > this.limits.rateLimitPerSecond) {
      isValid = false;
      reason = `RATE_LIMIT_EXCEEDED: Max ${this.limits.rateLimitPerSecond} orders/sec. Current: ${rateTracker.count} TPS`;
    }

    // 2. Fat-Finger Protection: Single Order Quantity Limit
    if (isValid && order.amount > this.limits.maxOrderQty) {
      isValid = false;
      reason = `FAT_FINGER_QTY: Order quantity ${order.amount} exceeds maximum allowed of ${this.limits.maxOrderQty}`;
    }

    // 3. Fat-Finger Protection: Single Order Value Limit
    if (isValid && orderValueUsd > this.limits.maxOrderValueUsd) {
      isValid = false;
      reason = `FAT_FINGER_VALUE: Order value $${orderValueUsd.toFixed(2)} exceeds maximum allowed of $${this.limits.maxOrderValueUsd.toLocaleString()}`;
    }

    // 4. Price Collar Check (Deviation from best market price)
    if (isValid && order.type === 'LIMIT' && lastPrice > 0 && priceDeviationPct > this.limits.priceCollarPct) {
      isValid = false;
      reason = `PRICE_COLLAR_VIOLATION: Order price $${orderPrice} deviates by ${priceDeviationPct.toFixed(2)}% from market price $${lastPrice} (Max: ${this.limits.priceCollarPct}%)`;
    }

    // 5. Daily Drawdown Circuit Breaker check
    if (isValid) {
      const dailyLoss = this.userDailyLosses.get(userId) || 0;
      const maxAllowedLoss = userBalance * (this.limits.maxDailyLossPct / 100);
      if (dailyLoss >= maxAllowedLoss) {
        isValid = false;
        reason = `CIRCUIT_BREAKER_ACTIVE: Daily realized loss $${dailyLoss.toFixed(2)} hit max drawdown limit of $${maxAllowedLoss.toFixed(2)} (${this.limits.maxDailyLossPct}%)`;
      }
    }

    // 6. Leverage & Balance Constraint validation
    if (isValid) {
      // Required margin is (Value / Leverage)
      const requiredMargin = orderValueUsd / this.limits.maxLeverage;
      if (requiredMargin > userBalance) {
        isValid = false;
        reason = `INSUFFICIENT_MARGIN: Required margin $${requiredMargin.toFixed(2)} (Leverage: ${this.limits.maxLeverage}x) exceeds user balance $${userBalance.toFixed(2)}`;
      }
    }

    // 7. Wash Trading Prevention (Self-Match Protection)
    if (isValid && this.limits.washTradingPrevention && order.type === 'LIMIT') {
      const openOrders = activeBookOrders || this.activeOrders.get(userId) || [];
      const potentialSelfMatch = openOrders.some(
        o => o.userId === userId && o.symbol === order.symbol && o.side !== order.side && o.price === order.price
      );
      if (potentialSelfMatch) {
        isValid = false;
        reason = `SELF_MATCH_PREVENTION: Limit order at $${order.price} would instantly self-match with an existing open order on the opposite side`;
      }
    }

    const endTimeNs = process.hrtime.bigint();
    const latencyNs = Number(endTimeNs - startTimeNs);

    // Record Log in memory
    const riskLog: RiskLog = {
      id: `rl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      userId,
      symbol: order.symbol,
      side: order.side as any,
      type: order.type,
      price: orderPrice,
      amount: order.amount,
      isValid,
      reason,
      latencyNs
    };

    // Keep logs size capped at 1000
    this.riskLogs.unshift(riskLog);
    if (this.riskLogs.length > 1000) {
      this.riskLogs.pop();
    }

    return {
      isValid,
      reason,
      latencyNs,
      metrics: {
        orderValueUsd,
        priceDeviationPct,
        currentRateTps
      }
    };
  }
}

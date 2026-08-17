import { Order, UserProfile } from '../src/types.js';
import { LimitOrderBook } from './orderbook.js';

export interface ShadowResult {
  isValid: boolean;
  expectedAvgPrice: number;
  expectedSlippagePercent: number;
  expectedFilledAmount: number;
  requiredMargin: number;
  reason?: string;
}

export class ShadowEngine {
  private peakBalances: Map<string, number> = new Map();
  private maxDrawdownLimit = 0.03; // Hardcoded 3% drawdown limit

  public validateWithShadow(order: Order, user: UserProfile, lob: LimitOrderBook): ShadowResult {
    // 1. Maintain peak balance for Capital Preservation Shield
    const currentBalance = user.usdBalance;
    let peak = this.peakBalances.get(user.id);
    if (!peak || currentBalance > peak) {
      peak = currentBalance;
      this.peakBalances.set(user.id, peak);
    }

    // 2. Capital Preservation Shield: Drawdown check
    const currentDrawdown = (peak - currentBalance) / peak;
    if (currentDrawdown >= this.maxDrawdownLimit) {
      return {
        isValid: false,
        expectedAvgPrice: 0,
        expectedSlippagePercent: 0,
        expectedFilledAmount: 0,
        requiredMargin: 0,
        reason: `Capital Preservation Shield aktiválódott: A(z) ${(currentDrawdown * 100).toFixed(2)}%-os tőkeveszteség meghaladta a fix 3%-os limitet! A kereskedés leállt.`
      };
    }

    // 3. Shadow Execution simulation against current bids/asks
    const isBuy = order.side === 'BUY' || order.side === 'LONG';
    const amount = order.amount;
    const leverage = order.leverage || 10;

    const bids = [...lob.bids];
    const asks = [...lob.asks];
    const currentPrice = lob.lastPrice;

    let remainingAmount = amount;
    let totalCost = 0;
    let filledAmount = 0;

    if (order.type === 'MARKET') {
      const orderBookSide = isBuy ? asks : bids;
      for (const level of orderBookSide) {
        if (remainingAmount <= 0) break;
        const fillQty = Math.min(remainingAmount, level.amount);
        totalCost += fillQty * level.price;
        filledAmount += fillQty;
        remainingAmount -= fillQty;
      }

      // If market order has leftover unfilled quantity, simulate the tail at current price with spread premium
      if (remainingAmount > 0) {
        const premium = isBuy ? currentPrice * 1.002 : currentPrice * 0.998;
        totalCost += remainingAmount * premium;
        filledAmount += remainingAmount;
      }
    } else {
      // LIMIT order
      const limitPrice = order.price || currentPrice;
      if (isBuy) {
        if (limitPrice >= currentPrice) {
          for (const level of asks) {
            if (level.price > limitPrice || remainingAmount <= 0) break;
            const fillQty = Math.min(remainingAmount, level.amount);
            totalCost += fillQty * level.price;
            filledAmount += fillQty;
            remainingAmount -= fillQty;
          }
        }
      } else {
        if (limitPrice <= currentPrice) {
          for (const level of bids) {
            if (level.price < limitPrice || remainingAmount <= 0) break;
            const fillQty = Math.min(remainingAmount, level.amount);
            totalCost += fillQty * level.price;
            filledAmount += fillQty;
            remainingAmount -= fillQty;
          }
        }
      }

      if (remainingAmount > 0) {
        totalCost += remainingAmount * limitPrice;
        filledAmount += remainingAmount;
      }
    }

    const expectedAvgPrice = filledAmount > 0 ? totalCost / filledAmount : currentPrice;
    const expectedSlippagePercent = currentPrice > 0 ? Math.abs(expectedAvgPrice - currentPrice) / currentPrice : 0;

    // High slippage protection filter (max 1.5% slippage on HFT orders)
    if (expectedSlippagePercent > 0.015) {
      return {
        isValid: false,
        expectedAvgPrice,
        expectedSlippagePercent,
        expectedFilledAmount: filledAmount,
        requiredMargin: (expectedAvgPrice * amount) / leverage,
        reason: `Slippage hiba: A becsült csúszás ${(expectedSlippagePercent * 100).toFixed(2)}%, ami meghaladja a megengedett 1.5% limitet.`
      };
    }

    // Required margin check
    const requiredMargin = (expectedAvgPrice * amount) / leverage;
    if (requiredMargin > currentBalance) {
      return {
        isValid: false,
        expectedAvgPrice,
        expectedSlippagePercent,
        expectedFilledAmount: filledAmount,
        requiredMargin,
        reason: `Fedezethiány: A megbízáshoz ${requiredMargin.toFixed(2)} USD szükséges, de a számlaegyenleg csak ${currentBalance.toFixed(2)} USD.`
      };
    }

    return {
      isValid: true,
      expectedAvgPrice,
      expectedSlippagePercent,
      expectedFilledAmount: filledAmount,
      requiredMargin
    };
  }
}

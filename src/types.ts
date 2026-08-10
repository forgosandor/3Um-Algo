export type TradeSide = 'BUY' | 'SELL' | 'LONG' | 'SHORT';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
export type OrderStatus = 'OPEN' | 'FILLED' | 'CANCELLED' | 'PARTIAL';
export type MarketTrend = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'CONSOLIDATION';
export type TradingStyle = 'Trendkövető' | 'Range Trade' | 'Kitörés' | 'Mean Reversion' | 'Scalping';
export type WhisperType = 'PRE_TRADE' | 'IN_TRADE' | 'POST_TRADE' | 'RISK_ALERT';

export interface Asset {
  symbol: string;
  name: string;
  category: 'Forex' | 'Crypto';
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  spread: number;
  decimals: number;
}

export interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
  cumulative: number;
  type: 'bid' | 'ask';
}

export interface OrderBookState {
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread: number;
  spreadPct: number;
  lastPrice: number;
  imbalance: number; // Positive = bid heavy, negative = ask heavy
}

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  side: TradeSide;
  type: OrderType;
  price: number;
  amount: number;
  filled: number;
  status: OrderStatus;
  timestamp: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
}

export interface Position {
  id: string;
  userId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  amount: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  timestamp: number;
}

export interface MarketContext {
  symbol: string;
  price: number;
  rsi: number;
  macdHist: number;
  volatility: number; // e.g. ATR or StdDev
  volume: number;
  trend: MarketTrend;
  obImbalance: number; // -1 to +1
  newsSentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface TradeLog {
  id: string;
  userId: string;
  symbol: string;
  side: TradeSide;
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnlAbs: number;
  pnlRatio: number; // in R multiples (e.g. +1.5R, -0.7R)
  isProfitable: boolean;
  durationMs: number;
  timestamp: number;
  contextAtEntry: MarketContext;
  userStyle: TradingStyle;
  timeframe: string;
  notes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  usdBalance: number;
  btcBalance: number;
  ethBalance: number;
  preferredAssets: string[];
  preferredTimeframes: string[];
  maxRiskPct: number;
  maxRiskPerTradePct?: number;
  targetRR: number;
  tradingStyle: TradingStyle;
  winRate: number;
  totalTrades: number;
}

export interface Whisper {
  id: string;
  userId: string;
  type: WhisperType;
  symbol: string;
  title: string;
  message: string;
  confidence: number; // 0 to 1
  matchReason: string;
  historicalWinRatePct?: number;
  historicalAvgR?: number;
  suggestedAction?: 'BUY' | 'SELL' | 'SET_SL' | 'TAKE_PROFIT' | 'WAIT';
  timestamp: number;
  read: boolean;
  actionTaken?: 'ACCEPTED' | 'DISMISSED';
}

export interface Candlestick {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ExecutionReport {
  orderId: string;
  userId: string;
  symbol: string;
  side: TradeSide;
  price: number;
  amount: number;
  executionTimeMs: number; // in-memory LOB match time
  timestamp: number;
}

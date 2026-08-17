import { create } from 'zustand';
import { Asset, OrderBookState, Candlestick, Position, Order, TradeLog, Whisper, UserProfile, TradeSide, OrderType, RiskLimits, RiskLog, PersistenceStats, TradeSignal, ExchangeWallet, TradingMode } from '../types';

export interface AutonomousStatus {
  isRunning: boolean;
  isEmergencyStopped: boolean;
  capital: number;
  peakCapital: number;
  openPositionsCount: number;
  positions: any[];
  lastMetrics: Record<string, { symbol: string; price: number; zScore: number; ofi: number }>;
}

interface TradeStore {
  // State
  activeUser: UserProfile | null;
  users: UserProfile[];
  selectedSymbol: string;
  assets: Asset[];
  orderBook: OrderBookState | null;
  candles: Candlestick[];
  positions: Position[];
  openOrders: Order[];
  tradeLogs: TradeLog[];
  tradeSignals: TradeSignal[];
  whispers: Whisper[];
  unreadWhispersCount: number;
  latencyMs: number;
  isConnected: boolean;
  reconnectAttempt: number;
  isAiStandbyActive: boolean;
  aiStandbyReason: string;
  aiStandbyLastExecutedTime: number;
  autonomousStatus: AutonomousStatus | null;
  soundEnabled: boolean;
  activeTab: 'terminal' | 'orderbook' | 'whispers' | 'journal' | 'analytics' | 'profile' | 'backtest' | 'risk' | 'ai-diagnostics' | 'cluster' | 'wallets';
  timeframe: string;
  socket: WebSocket | null;
  binanceConnected: boolean;
  binanceJitter: Record<string, { currentJitterMs: number; averageJitterMs: number; totalPackets: number; lastUpdateTime: number }> | null;
  kucoinConnected: boolean;
  kucoinJitter: Record<string, { currentJitterMs: number; averageJitterMs: number; totalPackets: number; lastUpdateTime: number }> | null;
  activeFeedSource: 'binance' | 'kucoin';
  systemState: { status: 'OK' | 'WARN' | 'HALT'; latency: number } | null;
  backtestResult: any | null;
  backtestOptimizationGrid: any[] | null;
  backtestRunning: boolean;
  riskLimits: RiskLimits | null;
  riskLogs: RiskLog[];
  marketMakerStatus: any | null;
  persistenceStats: PersistenceStats | null;
  latencyAlertThresholdMs: number;
  jitterAlertThresholdMs: number;

  // Wallet & Multi-Exchange Live Trading State
  wallets: ExchangeWallet[];
  globalTradingMode: TradingMode;
  isAddWalletModalOpen: boolean;

  // Actions
  setAddWalletModalOpen: (open: boolean) => void;
  setGlobalTradingMode: (mode: TradingMode) => void;
  fetchWallets: () => Promise<void>;
  addWallet: (data: any) => Promise<void>;
  testWallet: (walletId: string) => Promise<{ success: boolean; latencyMs: number; message: string }>;
  toggleWalletLiveMode: (walletId: string, enabled: boolean) => Promise<void>;
  setDefaultWallet: (walletId: string) => Promise<void>;
  deleteWallet: (walletId: string) => Promise<void>;
  syncAllWallets: () => Promise<void>;

  fetchPersistenceStats: () => Promise<void>;
  flushDatabase: () => Promise<void>;
  setActiveFeedSource: (source: 'binance' | 'kucoin') => void;
  toggleMarketMaker: (enabled?: boolean) => void;
  updateMarketMakerConfig: (config: any) => void;
  setLatencyAlertThresholdMs: (val: number) => void;
  setJitterAlertThresholdMs: (val: number) => void;
  updateRiskLimits: (limits: Partial<RiskLimits>) => void;
  clearRiskLogs: () => void;
  connectWebSocket: () => void;
  initWebSocket: () => void;
  switchUser: (userId: string) => void;
  toggleAiStandby: () => void;
  toggleAutonomousEngine: () => void;
  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: string) => void;
  setTab: (tab: 'terminal' | 'orderbook' | 'whispers' | 'journal' | 'analytics' | 'profile' | 'backtest' | 'risk' | 'ai-diagnostics' | 'cluster' | 'wallets') => void;
  toggleSound: () => void;
  executeBacktest: (params: {
    symbol: string;
    startingBalance: number;
    kellyFraction: number;
    stopLossPct: number;
    takeProfitMultiplier: number;
    ofiThreshold: number;
    ofiWindow: number;
  }, regime: 'mean_reversion' | 'bull_run' | 'flash_crash' | 'high_frequency_noise') => void;
  submitOrder: (order: {
    side: TradeSide;
    type: OrderType;
    price: number;
    amount: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
  }) => void;
  cancelOrder: (orderId: string) => void;
  closePosition: (positionId: string) => void;
  requestWhisper: () => void;
  markWhispersRead: () => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updateUserSettings: (profile: Partial<UserProfile>) => void;
  triggerRetrain: () => Promise<void>;
  seedSampleData: () => Promise<void>;
  executeBuy: (symbol: string, amount: number) => void;
  executeSell: (symbol: string, amount: number) => void;
  executeSignalTrade: (signal: TradeSignal, customAmount?: number) => void;
  fetchTradeSignals: () => Promise<void>;
}

// Robust numeric data sanitization helpers
function sanitizeNum(val: any, defaultVal = 0): number {
  if (val === null || val === undefined) return defaultVal;
  const parsed = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(parsed) || !isFinite(parsed) ? defaultVal : parsed;
}

function sanitizeAsset(asset: Asset): Asset {
  return {
    ...asset,
    price: sanitizeNum(asset.price, 0),
    change24h: sanitizeNum(asset.change24h, 0),
    volume24h: sanitizeNum(asset.volume24h, 0),
    decimals: Math.max(0, Math.min(8, Math.round(sanitizeNum(asset.decimals, 2)))),
    high24h: sanitizeNum(asset.high24h, asset.price || 0),
    low24h: sanitizeNum(asset.low24h, asset.price || 0)
  };
}

function sanitizeOrderBook(ob: OrderBookState): OrderBookState {
  return {
    ...ob,
    lastPrice: sanitizeNum(ob.lastPrice, 0),
    imbalance: sanitizeNum(ob.imbalance, 0),
    spread: sanitizeNum(ob.spread, 0),
    spreadPct: sanitizeNum(ob.spreadPct, 0),
    bids: (ob.bids || []).map(b => ({
      ...b,
      price: sanitizeNum(b.price, 0),
      amount: sanitizeNum(b.amount, 0),
      total: sanitizeNum(b.total, 0),
      cumulative: sanitizeNum(b.cumulative, 0),
      type: 'bid'
    })),
    asks: (ob.asks || []).map(a => ({
      ...a,
      price: sanitizeNum(a.price, 0),
      amount: sanitizeNum(a.amount, 0),
      total: sanitizeNum(a.total, 0),
      cumulative: sanitizeNum(a.cumulative, 0),
      type: 'ask'
    }))
  };
}

function sanitizeCandle(c: Candlestick): Candlestick {
  return {
    ...c,
    open: sanitizeNum(c.open, 0),
    high: sanitizeNum(c.high, 0),
    low: sanitizeNum(c.low, 0),
    close: sanitizeNum(c.close, 0),
    volume: sanitizeNum(c.volume, 0),
    timestamp: sanitizeNum(c.timestamp, Date.now())
  };
}

function sanitizeUser(u: UserProfile): UserProfile {
  return {
    ...u,
    usdBalance: sanitizeNum(u.usdBalance, 10000),
    btcBalance: sanitizeNum(u.btcBalance, 0),
    ethBalance: sanitizeNum(u.ethBalance, 0),
    winRate: sanitizeNum(u.winRate, 50),
    totalTrades: sanitizeNum(u.totalTrades, 0),
    maxRiskPct: sanitizeNum(u.maxRiskPct, 2),
    maxRiskPerTradePct: u.maxRiskPerTradePct !== undefined ? sanitizeNum(u.maxRiskPerTradePct, 2) : undefined,
    targetRR: sanitizeNum(u.targetRR, 2)
  };
}

function sanitizeTradeLog(t: TradeLog): TradeLog {
  return {
    ...t,
    entryPrice: sanitizeNum(t.entryPrice, 0),
    exitPrice: sanitizeNum(t.exitPrice, 0),
    amount: sanitizeNum(t.amount, 0),
    pnlAbs: sanitizeNum(t.pnlAbs, 0),
    pnlRatio: sanitizeNum(t.pnlRatio, 0),
    timestamp: sanitizeNum(t.timestamp, Date.now())
  };
}

function sanitizePosition(p: Position): Position {
  return {
    ...p,
    entryPrice: sanitizeNum(p.entryPrice, 0),
    amount: sanitizeNum(p.amount, 0),
    currentPrice: sanitizeNum(p.currentPrice, 0),
    pnl: sanitizeNum(p.pnl, 0),
    pnlPercent: sanitizeNum(p.pnlPercent, 0),
    leverage: sanitizeNum(p.leverage, 1),
    stopLoss: p.stopLoss !== undefined ? sanitizeNum(p.stopLoss, 0) : undefined,
    takeProfit: p.takeProfit !== undefined ? sanitizeNum(p.takeProfit, 0) : undefined
  };
}

// Throttled high-frequency updates using requestAnimationFrame to prevent render thrashing
let pendingUpdates: Partial<TradeStore> = {};
let animationFrameId: number | null = null;

const queueThrottledUpdate = (updates: Partial<TradeStore>, setStore: any, getStore: any) => {
  pendingUpdates = {
    ...pendingUpdates,
    ...updates
  };

  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(() => {
      const activePending = { ...pendingUpdates };
      pendingUpdates = {};
      animationFrameId = null;

      setStore(activePending);

      // Evaluate AI Standby Auto-Router after updating state
      if (getStore().isAiStandbyActive) {
        const ob = getStore().orderBook;
        const users = getStore().users;
        const selectedSym = getStore().selectedSymbol;
        const currentAsset = getStore().assets.find((a: any) => a.symbol === selectedSym);
        if (ob && users.length > 0 && currentAsset) {
          const imb = ob.imbalance || 0;
          const chg = Math.abs(currentAsset.change24h || 0);

          let targetId = 'user_1';
          let reason = '';

          if (chg > 3.5 || Math.abs(imb) > 0.22) {
            targetId = 'user_3'; // Csilla Breakout
            reason = `⚡ [AI Standby Router] LOB Imbalance (${(imb * 100).toFixed(0)}%) / Volatilitás! Csilla Breakout profil aktiválva!`;
          } else if (Math.abs(imb) < 0.08 && chg < 1.2) {
            targetId = 'user_4'; // Dávid Range
            reason = `📊 [AI Standby Router] Konszolidációs sáv (Low Volatility). Dávid Range profil aktiválva!`;
          } else if (chg > 2.0) {
            targetId = 'user_2'; // Bence Swing Trendkövető
            reason = `📈 [AI Standby Router] Erős iránymenti trend momentum (${chg}%). Bence Swing profil aktiválva!`;
          } else {
            targetId = 'user_1'; // Ádám Scalper
            reason = `🎯 [AI Standby Router] Alacsony spread és mikro-ingadozások. Kereskedő Ádám (Scalper) profil aktiválva!`;
          }

          const currentActive = getStore().activeUser;
          if (!currentActive || currentActive.id !== targetId) {
            const newProfile = users.find((u: any) => u.id === targetId);
            if (newProfile) {
              setStore({ activeUser: newProfile, aiStandbyReason: reason });
            }
          }
        }
      }
    });
  }
};

export const useTradeStore = create<TradeStore>((set, get) => ({
  activeUser: null,
  users: [],
  selectedSymbol: 'BTCUSDT',
  assets: [],
  orderBook: null,
  candles: [],
  positions: [],
  openOrders: [],
  tradeLogs: [],
  tradeSignals: [],
  whispers: [],
  unreadWhispersCount: 0,
  latencyMs: 0.8,
  isConnected: false,
  reconnectAttempt: 0,
  isAiStandbyActive: false,
  aiStandbyReason: '',
  aiStandbyLastExecutedTime: 0,
  autonomousStatus: null,
  soundEnabled: true,
  activeTab: 'terminal',
  timeframe: 'M5',
  socket: null,
  binanceConnected: false,
  binanceJitter: null,
  kucoinConnected: false,
  kucoinJitter: null,
  activeFeedSource: 'binance',
  systemState: null,
  backtestResult: null,
  backtestOptimizationGrid: null,
  backtestRunning: false,
  riskLimits: null,
  riskLogs: [],
  marketMakerStatus: null,
  persistenceStats: null,
  latencyAlertThresholdMs: 5.0,
  jitterAlertThresholdMs: 50.0,

  wallets: [],
  globalTradingMode: 'PAPER',
  isAddWalletModalOpen: false,

  setAddWalletModalOpen: (open: boolean) => set({ isAddWalletModalOpen: open }),
  setGlobalTradingMode: (mode: TradingMode) => set({ globalTradingMode: mode }),

  fetchWallets: async () => {
    try {
      const uId = get().activeUser?.id || 'user_1';
      const res = await fetch(`/api/wallets?userId=${uId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.wallets) set({ wallets: data.wallets });
      }
    } catch (e) {
      console.warn('Failed to fetch wallets:', e);
    }
  },

  addWallet: async (walletData: any) => {
    try {
      const uId = get().activeUser?.id || 'user_1';
      const res = await fetch('/api/wallets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...walletData, userId: uId })
      });
      if (res.ok) {
        await get().fetchWallets();
        set({ isAddWalletModalOpen: false });
      }
    } catch (e) {
      console.error('Failed to add wallet:', e);
    }
  },

  testWallet: async (walletId: string) => {
    try {
      const res = await fetch(`/api/wallets/${walletId}/test`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        await get().fetchWallets();
        return data;
      }
    } catch (e) {
      console.error('Failed to test wallet:', e);
    }
    return { success: false, latencyMs: 0, message: 'Hálózati hiba a kapcsolat tesztelésekor.' };
  },

  toggleWalletLiveMode: async (walletId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/wallets/${walletId}/toggle-live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      if (res.ok) {
        await get().fetchWallets();
      }
    } catch (e) {
      console.error('Failed to toggle wallet live mode:', e);
    }
  },

  setDefaultWallet: async (walletId: string) => {
    try {
      const uId = get().activeUser?.id || 'user_1';
      const res = await fetch(`/api/wallets/${walletId}/set-default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uId })
      });
      if (res.ok) {
        await get().fetchWallets();
      }
    } catch (e) {
      console.error('Failed to set default wallet:', e);
    }
  },

  deleteWallet: async (walletId: string) => {
    try {
      const res = await fetch(`/api/wallets/${walletId}`, { method: 'DELETE' });
      if (res.ok) {
        await get().fetchWallets();
      }
    } catch (e) {
      console.error('Failed to delete wallet:', e);
    }
  },

  syncAllWallets: async () => {
    try {
      const uId = get().activeUser?.id || 'user_1';
      const res = await fetch('/api/wallets/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uId })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.wallets) set({ wallets: data.wallets });
      }
    } catch (e) {
      console.error('Failed to sync all wallets:', e);
    }
  },

  fetchPersistenceStats: async () => {
    try {
      const res = await fetch('/api/database/stats');
      if (res.ok) {
        const stats = await res.json();
        set({ persistenceStats: stats });
      }
    } catch (e) {
      console.warn('Failed to fetch persistence stats:', e);
    }
  },

  flushDatabase: async () => {
    try {
      const res = await fetch('/api/database/flush', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) {
          set({ persistenceStats: data.stats });
        }
      }
    } catch (e) {
      console.warn('Failed to flush database:', e);
    }
  },

  connectWebSocket: () => {
    const existing = get().socket;
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    // Prevent duplicate connection calls while handshake is pending
    set({ socket: ws });

    let pingStart = 0;

    ws.onopen = () => {
      set({ isConnected: true, reconnectAttempt: 0 });
      pingStart = performance.now();
      ws.send(JSON.stringify({ type: 'SUBSCRIBE_SYMBOL', symbol: get().selectedSymbol }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const receiveTime = performance.now();
        if (pingStart > 0) {
          const roundtrip = sanitizeNum((receiveTime - pingStart).toFixed(2), 0.8);
          set({ latencyMs: Math.max(0.2, Math.min(12, roundtrip)) });
          pingStart = 0;
        }

        if (data.type === 'INIT_STATE') {
          const usersList: UserProfile[] = (data.users || []).map(sanitizeUser);
          const active = usersList.find(u => u.id === 'user_1') || usersList[0] || null;
          set({
            assets: (data.assets || []).map(sanitizeAsset),
            orderBook: data.orderBook ? sanitizeOrderBook(data.orderBook) : null,
            candles: (data.candles || []).map(sanitizeCandle),
            users: usersList,
            activeUser: active,
            openOrders: data.openOrders || [],
            tradeLogs: (data.tradeLogs || []).map(sanitizeTradeLog),
            binanceConnected: !!data.binanceConnected,
            binanceJitter: data.binanceJitter || null,
            kucoinConnected: !!data.kucoinConnected,
            kucoinJitter: data.kucoinJitter || null,
            activeFeedSource: data.activeFeedSource || 'binance',
            systemState: data.systemState || null,
            tradeSignals: data.tradeSignals || [],
            riskLimits: data.riskLimits || null,
            riskLogs: data.riskLogs || [],
            marketMakerStatus: data.marketMakerStatus || null,
            persistenceStats: data.persistenceStats || null
          });
          get().fetchWallets();

          // Fetch whispers for active user
          if (active) {
            fetch(`/api/whispers/${active.id}`)
              .then(res => res.json())
              .then(wList => set({ whispers: wList, unreadWhispersCount: wList.filter((w: Whisper) => !w.read).length }))
              .catch(() => {});
          }
        }

        else if (data.type === 'TICK_UPDATE' || data.type === 'LOB_UPDATE') {
          const updates: Partial<TradeStore> = {};
          if (data.assets) updates.assets = data.assets.map(sanitizeAsset);
          if (data.binanceConnected !== undefined) updates.binanceConnected = !!data.binanceConnected;
          if (data.binanceJitter) updates.binanceJitter = data.binanceJitter;
          if (data.kucoinConnected !== undefined) updates.kucoinConnected = !!data.kucoinConnected;
          if (data.kucoinJitter) updates.kucoinJitter = data.kucoinJitter;
          if (data.activeFeedSource !== undefined) updates.activeFeedSource = data.activeFeedSource;
          if (data.systemState !== undefined) updates.systemState = data.systemState;
          if (data.marketMakerStatus !== undefined) updates.marketMakerStatus = data.marketMakerStatus;
          if ((!data.symbol || data.symbol === get().selectedSymbol) && data.orderBook) {
            updates.orderBook = sanitizeOrderBook(data.orderBook);
          }
          if ((!data.symbol || data.symbol === get().selectedSymbol) && data.candles) {
            updates.candles = data.candles.map(sanitizeCandle);
          }
          if (Object.keys(updates).length > 0) {
            queueThrottledUpdate(updates, set, get);
          }
        }

        else if (data.type === 'LOB_SNAPSHOT') {
          const updates: Partial<TradeStore> = {};
          if (data.orderBook) updates.orderBook = sanitizeOrderBook(data.orderBook);
          if (data.candles) updates.candles = data.candles.map(sanitizeCandle);
          if (Object.keys(updates).length > 0) {
            queueThrottledUpdate(updates, set, get);
          }
        }

        else if (data.type === 'MARKET_MAKER_STATUS') {
          if (data.status) set({ marketMakerStatus: data.status });
        }

        else if (data.type === 'ORDER_PLACED') {
          const updates: Partial<TradeStore> = {};
          if (data.user) updates.activeUser = sanitizeUser(data.user);
          if (data.openOrders) updates.openOrders = data.openOrders;
          else if (data.order) {
            updates.openOrders = [data.order, ...get().openOrders.filter(o => o.id !== data.order.id)];
          }
          set(updates);
          if (get().soundEnabled) {
            playBeepSound();
          }
        }

        else if (data.type === 'ORDER_EXECUTED') {
          const updates: Partial<TradeStore> = {};
          if (data.user) updates.activeUser = sanitizeUser(data.user);
          if (data.openOrders) updates.openOrders = data.openOrders;
          else if (data.execution && data.execution.orderId) {
            updates.openOrders = get().openOrders.filter(o => o.id !== data.execution.orderId);
          }
          if (data.execution && data.execution.executionTimeMs) {
            updates.latencyMs = sanitizeNum(data.execution.executionTimeMs, 0.8);
          }
          if (data.position) {
            const sanitizedPos = sanitizePosition(data.position);
            const currentPos = get().positions.filter(p => p.id !== sanitizedPos.id);
            updates.positions = [sanitizedPos, ...currentPos];
          }
          if (Object.keys(updates).length > 0) {
            set(updates);
          }
          if (get().soundEnabled) {
            playBeepSound();
          }
        }

        else if (data.type === 'POSITION_CLOSED') {
          const updates: Partial<TradeStore> = {};
          if (data.user) updates.activeUser = sanitizeUser(data.user);
          if (data.tradeLog) {
            const sanitizedLog = sanitizeTradeLog(data.tradeLog);
            updates.tradeLogs = [sanitizedLog, ...get().tradeLogs];
            updates.positions = get().positions.filter(p => p.id !== sanitizedLog.id);
          }
          if (data.whisper) {
            const currentWhispers = get().whispers;
            updates.whispers = [data.whisper, ...currentWhispers];
            updates.unreadWhispersCount = get().unreadWhispersCount + 1;
          }
          if (Object.keys(updates).length > 0) {
            set(updates);
          }
        }

        else if (data.type === 'ORDER_CANCELLED') {
          const updates: Partial<TradeStore> = {};
          if (data.user) updates.activeUser = sanitizeUser(data.user);
          if (data.openOrders) {
            updates.openOrders = data.openOrders;
          } else if (data.orderId) {
            updates.openOrders = get().openOrders.filter(o => o.id !== data.orderId);
          }
          set(updates);
        }

        else if (data.type === 'WHISPER_NEW') {
          if (data.whisper) {
            set(state => ({
              whispers: [data.whisper, ...state.whispers],
              unreadWhispersCount: state.unreadWhispersCount + 1
            }));
            if (get().soundEnabled) {
              playWhisperSound();
            }
          }
        }
        else if (data.type === 'BACKTEST_RESULT') {
          set({
            backtestResult: data.result,
            backtestOptimizationGrid: data.optimizationGrid,
            backtestRunning: false
          });
        }

        else if (data.type === 'RISK_LOGS_UPDATE') {
          set({
            riskLogs: data.riskLogs || [],
            riskLimits: data.riskLimits || get().riskLimits
          });
        }

        else if (data.type === 'ORDER_REJECTED') {
          if (data.riskLogs) {
            set({ riskLogs: data.riskLogs });
          }
          if (data.latencyNs) {
            set({ latencyMs: Number((data.latencyNs / 1000000).toFixed(3)) });
          }
          if (get().soundEnabled) {
            playBuzzerSound();
          }
          // We can also create a nice UI toast instead of window.alert, or both
          console.warn(`[ORDER REJECTED]: ${data.reason}`);
        }

        else if (data.type === 'AUTONOMOUS_TRADE_EXECUTED' || data.type === 'AUTONOMOUS_POSITION_CLOSED' || data.type === 'AUTONOMOUS_EMERGENCY_STOP') {
          if (data.status) {
            set({ autonomousStatus: data.status });
          }
        }

        else if (data.type === 'TRADESIGNALS') {
          if (Array.isArray(data.signals)) {
            set({ tradeSignals: data.signals });
          }
        }

        else if (data.type === 'ORDER_EXECUTED') {
          if (data.user) {
            set({ activeUser: sanitizeUser(data.user) });
          }
          if (data.executionTimeMs) {
            set({ latencyMs: Number(data.executionTimeMs) });
          }
          if (get().soundEnabled) {
            playBeepSound();
          }
        }

        else if (data.type === 'BALANCE_UPDATE') {
          if (data.balance) {
            const currentUser = get().activeUser;
            if (currentUser) {
              set({
                activeUser: {
                  ...currentUser,
                  usdBalance: data.balance.USD !== undefined ? Number(data.balance.USD) : currentUser.usdBalance,
                  btcBalance: data.balance.BTC !== undefined ? Number(data.balance.BTC) : currentUser.btcBalance,
                  ethBalance: data.balance.ETH !== undefined ? Number(data.balance.ETH) : currentUser.ethBalance,
                  solBalance: data.balance.SOL !== undefined ? Number(data.balance.SOL) : currentUser.solBalance,
                  xauBalance: data.balance.XAU !== undefined ? Number(data.balance.XAU) : currentUser.xauBalance,
                  xagBalance: data.balance.XAG !== undefined ? Number(data.balance.XAG) : currentUser.xagBalance
                }
              });
            }
          }
        }
      } catch (e) {
        console.error('WS Parse Error:', e);
      }
    };

    ws.onclose = () => {
      set({ isConnected: false, socket: null });
      
      // Exponential backoff reconnect strategy
      const attempts = get().reconnectAttempt || 0;
      // Exponential delay starting at 1s up to max 30s with jitter
      const baseDelay = Math.min(30000, 1000 * Math.pow(1.8, attempts));
      const jitter = Math.random() * 500;
      const delay = Math.round(baseDelay + jitter);

      set({ reconnectAttempt: attempts + 1 });

      setTimeout(() => {
        get().connectWebSocket();
      }, delay);
    };
  },

  initWebSocket: () => {
    get().connectWebSocket();
    fetch('/api/autonomous/status')
      .then(res => res.json())
      .then(status => set({ autonomousStatus: status }))
      .catch(() => {});
  },

  switchUser: (userId: string) => {
    const user = get().users.find(u => u.id === userId);
    if (user) {
      set({ activeUser: user });
      // Fetch user's positions & whispers
      fetch(`/api/whispers/${userId}`)
        .then(res => res.json())
        .then(wList => set({ whispers: wList, unreadWhispersCount: wList.filter((w: Whisper) => !w.read).length }))
        .catch(() => {});
    }
  },

  toggleAiStandby: () => {
    const nextState = !get().isAiStandbyActive;
    set({
      isAiStandbyActive: nextState,
      aiStandbyReason: nextState
        ? '🤖 AI Standby Auto-Router AKTÍV: Folyamatos mérések alapján automatikus profil- és stratégia-váltás.'
        : 'AI Standby Inaktív.'
    });
  },

  toggleAutonomousEngine: async () => {
    try {
      const res = await fetch('/api/autonomous/toggle', { method: 'POST' });
      const status = await res.json();
      set({ autonomousStatus: status });
    } catch (e) {
      console.error('Failed to toggle autonomous engine:', e);
    }
  },

  setSymbol: (symbol: string) => {
    set({ selectedSymbol: symbol });
    const ws = get().socket;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SUBSCRIBE_SYMBOL', symbol }));
    }
  },

  setTimeframe: (tf: string) => set({ timeframe: tf }),
  setTab: (tab) => set({ activeTab: tab }),
  toggleSound: () => set(state => ({ soundEnabled: !state.soundEnabled })),

  setActiveFeedSource: (source: 'binance' | 'kucoin') => {
    const ws = get().socket;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SET_ACTIVE_FEED_SOURCE', source }));
    }
  },

  toggleMarketMaker: (enabled) => {
    const ws = get().socket;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'TOGGLE_MARKET_MAKER', enabled }));
    }
  },

  updateMarketMakerConfig: (config) => {
    const ws = get().socket;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'UPDATE_MARKET_MAKER_CONFIG', config }));
    }
  },

  setLatencyAlertThresholdMs: (val) => set({ latencyAlertThresholdMs: val }),
  setJitterAlertThresholdMs: (val) => set({ jitterAlertThresholdMs: val }),

  executeBacktest: (params, regime) => {
    const ws = get().socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    set({ backtestRunning: true });
    ws.send(JSON.stringify({
      type: 'EXECUTE_BACKTEST',
      params,
      regime: regime || 'mean_reversion'
    }));
  },

  submitOrder: (order) => {
    const ws = get().socket;
    const user = get().activeUser;
    if (!ws || ws.readyState !== WebSocket.OPEN || !user) return;

    const fullOrder: Order = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: user.id,
      symbol: get().selectedSymbol,
      side: order.side,
      type: order.type,
      price: order.price,
      amount: order.amount,
      filled: 0,
      status: 'OPEN',
      timestamp: Date.now(),
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit,
      leverage: order.leverage || 10
    };

    ws.send(JSON.stringify({
      type: 'SUBMIT_ORDER',
      order: fullOrder
    }));
  },

  cancelOrder: (orderId: string) => {
    const ws = get().socket;
    const user = get().activeUser;
    if (!ws || ws.readyState !== WebSocket.OPEN || !user) return;

    ws.send(JSON.stringify({
      type: 'CANCEL_ORDER',
      userId: user.id,
      orderId,
      symbol: get().selectedSymbol
    }));
  },

  closePosition: (positionId: string) => {
    const ws = get().socket;
    const user = get().activeUser;
    if (!ws || ws.readyState !== WebSocket.OPEN || !user) return;

    ws.send(JSON.stringify({
      type: 'CLOSE_POSITION',
      userId: user.id,
      positionId
    }));
  },

  requestWhisper: () => {
    const ws = get().socket;
    const user = get().activeUser;
    if (!ws || ws.readyState !== WebSocket.OPEN || !user) return;

    ws.send(JSON.stringify({
      type: 'GENERATE_WHISPER',
      userId: user.id,
      symbol: get().selectedSymbol
    }));
  },

  markWhispersRead: () => {
    set(state => ({
      whispers: state.whispers.map(w => ({ ...w, read: true })),
      unreadWhispersCount: 0
    }));
  },

  updateUserProfile: async (profile) => {
    const active = get().activeUser;
    if (!active) return;

    const updated = { ...active, ...profile };
    set({ activeUser: updated });

    try {
      await fetch(`/api/users/${active.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
    } catch (e) {
      console.error('Update profile error:', e);
    }
  },

  updateUserSettings: (profile) => get().updateUserProfile(profile),

  triggerRetrain: async () => {
    const active = get().activeUser;
    if (!active) return;
    try {
      await fetch('/api/retrain-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: active.id })
      });
    } catch (e) {
      console.error('Trigger retrain error:', e);
    }
  },

  seedSampleData: async () => {
    const active = get().activeUser;
    if (!active) return;

    try {
      const res = await fetch('/api/seed-sample-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: active.id })
      });
      if (res.ok) {
        // Refetch trade logs
        const logsRes = await fetch(`/api/trades/${active.id}`);
        const logs = await logsRes.json();
        set({ tradeLogs: logs });
      }
    } catch (e) {
      console.error('Seed sample data error:', e);
    }
  },

  updateRiskLimits: (limits) => {
    const ws = get().socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'UPDATE_RISK_LIMITS',
      limits
    }));
  },

  clearRiskLogs: () => {
    const ws = get().socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'CLEAR_RISK_LOGS'
    }));
  },

  fetchTradeSignals: async () => {
    try {
      const res = await fetch('/api/signals');
      if (res.ok) {
        const sigs = await res.json();
        set({ tradeSignals: sigs });
      }
    } catch (e) {
      console.warn('Failed to fetch signals:', e);
    }
  },

  executeBuy: (symbol: string, amount: number) => {
    const ws = get().socket;
    const user = get().activeUser;
    if (!ws || ws.readyState !== WebSocket.OPEN || !user) return;
    ws.send(JSON.stringify({
      type: 'BUY',
      symbol,
      amount,
      userId: user.id
    }));
  },

  executeSell: (symbol: string, amount: number) => {
    const ws = get().socket;
    const user = get().activeUser;
    if (!ws || ws.readyState !== WebSocket.OPEN || !user) return;
    ws.send(JSON.stringify({
      type: 'SELL',
      symbol,
      amount,
      userId: user.id
    }));
  },

  executeSignalTrade: (signal: TradeSignal, customAmount?: number) => {
    const ws = get().socket;
    const user = get().activeUser;
    if (!ws || ws.readyState !== WebSocket.OPEN || !user) return;

    const amount = customAmount || (signal.confidence && signal.confidence > 80 ? 0.05 : 0.01);

    if (signal.action === 'BUY') {
      get().executeBuy(signal.symbol || 'BTCUSDT', amount);
    } else {
      get().executeSell(signal.symbol || 'BTCUSDT', amount);
    }
  }
}));

// Synthesize pleasant ambient web audio sound effects
function playBeepSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function playWhisperSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.2); // C6
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

function playBuzzerSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, ctx.currentTime);
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(152, ctx.currentTime); // minor frequency detune for rich warning feel
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.35);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

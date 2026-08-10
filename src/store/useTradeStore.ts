import { create } from 'zustand';
import { Asset, OrderBookState, Candlestick, Position, Order, TradeLog, Whisper, UserProfile, TradeSide, OrderType } from '../types';

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
  activeTab: 'terminal' | 'orderbook' | 'whispers' | 'journal' | 'analytics' | 'profile';
  timeframe: string;
  socket: WebSocket | null;

  // Actions
  connectWebSocket: () => void;
  initWebSocket: () => void;
  switchUser: (userId: string) => void;
  toggleAiStandby: () => void;
  toggleAutonomousEngine: () => void;
  setSymbol: (symbol: string) => void;
  setTimeframe: (tf: string) => void;
  setTab: (tab: 'terminal' | 'orderbook' | 'whispers' | 'journal' | 'analytics' | 'profile') => void;
  toggleSound: () => void;
  submitOrder: (order: {
    side: TradeSide;
    type: OrderType;
    price: number;
    amount: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
  }) => void;
  closePosition: (positionId: string) => void;
  requestWhisper: () => void;
  markWhispersRead: () => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updateUserSettings: (profile: Partial<UserProfile>) => void;
  triggerRetrain: () => Promise<void>;
  seedSampleData: () => Promise<void>;
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
            tradeLogs: (data.tradeLogs || []).map(sanitizeTradeLog)
          });

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

        else if (data.type === 'ORDER_EXECUTED') {
          const updates: Partial<TradeStore> = {};
          if (data.user) updates.activeUser = sanitizeUser(data.user);
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

        else if (data.type === 'AUTONOMOUS_TRADE_EXECUTED' || data.type === 'AUTONOMOUS_POSITION_CLOSED' || data.type === 'AUTONOMOUS_EMERGENCY_STOP') {
          if (data.status) {
            set({ autonomousStatus: data.status });
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

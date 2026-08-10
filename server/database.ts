import { UserProfile, Order, Position, TradeLog, Whisper, MarketContext } from '../src/types.js';

export const INITIAL_USER_PROFILES: UserProfile[] = [
  {
    id: 'user_1',
    name: 'Kereskedő Ádám (Scalper)',
    email: 'adam.scalper@algomentor.hu',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    usdBalance: 12500.00,
    btcBalance: 0.85,
    ethBalance: 4.20,
    preferredAssets: ['BTCUSDT', 'ETHUSDT'],
    preferredTimeframes: ['M1', 'M5'],
    maxRiskPct: 1.5,
    targetRR: 1.8,
    tradingStyle: 'Scalping',
    winRate: 68.5,
    totalTrades: 42
  },
  {
    id: 'user_2',
    name: 'Bence Swing (Trendkövető)',
    email: 'bence.swing@algomentor.hu',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    usdBalance: 24800.00,
    btcBalance: 1.25,
    ethBalance: 10.50,
    preferredAssets: ['BTCUSDT', 'EURUSD', 'GBPUSD'],
    preferredTimeframes: ['H1', 'H4'],
    maxRiskPct: 2.0,
    targetRR: 2.5,
    tradingStyle: 'Trendkövető',
    winRate: 58.0,
    totalTrades: 28
  },
  {
    id: 'user_3',
    name: 'Csilla Breakout (Kitörés)',
    email: 'csilla.breakout@algomentor.hu',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    usdBalance: 8900.00,
    btcBalance: 0.30,
    ethBalance: 2.10,
    preferredAssets: ['SOLUSDT', 'BTCUSDT'],
    preferredTimeframes: ['M15', 'H1'],
    maxRiskPct: 1.0,
    targetRR: 3.0,
    tradingStyle: 'Kitörés',
    winRate: 52.4,
    totalTrades: 35
  },
  {
    id: 'user_4',
    name: 'Dávid Range (Range Trade)',
    email: 'david.range@algomentor.hu',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    usdBalance: 18200.00,
    btcBalance: 0.50,
    ethBalance: 6.00,
    preferredAssets: ['EURUSD', 'GBPUSD', 'ETHUSDT'],
    preferredTimeframes: ['M15', 'H1'],
    maxRiskPct: 1.5,
    targetRR: 1.5,
    tradingStyle: 'Range Trade',
    winRate: 64.0,
    totalTrades: 50
  },
  {
    id: 'user_5',
    name: 'Eleonóra RiskGuard (Kockázatkezelő)',
    email: 'eleonora.risk@algomentor.hu',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    usdBalance: 35000.00,
    btcBalance: 2.10,
    ethBalance: 15.00,
    preferredAssets: ['BTCUSDT', 'EURUSD'],
    preferredTimeframes: ['H1', 'H4'],
    maxRiskPct: 0.8,
    targetRR: 2.2,
    tradingStyle: 'Trendkövető',
    winRate: 72.1,
    totalTrades: 61
  }
];

export class DatabaseStore {
  public users: Map<string, UserProfile> = new Map();
  public orders: Map<string, Order> = new Map();
  public positions: Map<string, Position> = new Map();
  public tradeLogs: TradeLog[] = [];
  public whispers: Map<string, Whisper[]> = new Map(); // userId -> Whisper[]

  // Async DB Write Queue for Event Sourcing simulation
  public dbWriteQueue: { type: string; payload: any; timestamp: number }[] = [];
  public totalPersistedWrites: number = 0;

  constructor() {
    this.seedUsers();
    this.seedHistoricalTradeLogs();
    this.startAsyncWriteWorker();
  }

  private seedUsers() {
    for (const u of INITIAL_USER_PROFILES) {
      this.users.set(u.id, { ...u });
      this.whispers.set(u.id, []);
    }
  }

  public seedHistoricalTradeLogs() {
    const assets = ['BTCUSDT', 'ETHUSDT', 'EURUSD', 'SOLUSDT', 'GBPUSD'];
    const styles = ['Trendkövető', 'Range Trade', 'Kitörés', 'Scalping'] as const;
    const now = Date.now();
    const dayMs = 24 * 3600 * 1000;

    for (const user of INITIAL_USER_PROFILES) {
      for (let i = 1; i <= 25; i++) {
        const asset = assets[i % assets.length];
        const isWin = Math.random() < (user.winRate / 100);
        const pnlRatio = isWin ? Number((Math.random() * 1.5 + 1.0).toFixed(2)) : -Number((Math.random() * 0.5 + 0.5).toFixed(2));
        const pnlAbs = Number((pnlRatio * (user.usdBalance * (user.maxRiskPct / 100))).toFixed(2));
        const side = Math.random() > 0.5 ? 'LONG' : 'SHORT';
        const style = styles[i % styles.length];

        const rsi = isWin
          ? (side === 'LONG' ? 62 + Math.random() * 12 : 35 - Math.random() * 12)
          : (side === 'LONG' ? 76 + Math.random() * 10 : 22 - Math.random() * 10); // overbought/oversold failure

        const context: MarketContext = {
          symbol: asset,
          price: asset.startsWith('BTC') ? 94000 + i * 200 : 1.0850,
          rsi: Number(rsi.toFixed(1)),
          macdHist: Number((isWin ? 0.02 : -0.015).toFixed(3)),
          volatility: Number((0.001 + Math.random() * 0.003).toFixed(4)),
          volume: 150000,
          trend: isWin ? (side === 'LONG' ? 'BULLISH' : 'BEARISH') : 'CONSOLIDATION',
          obImbalance: Number((isWin ? 0.35 : -0.25).toFixed(2)),
          newsSentiment: isWin ? 'POSITIVE' : 'NEGATIVE'
        };

        const entryPrice = asset.startsWith('BTC') ? 92000 + i * 150 : 1.0820;
        const exitPrice = entryPrice + (pnlAbs / 100);

        this.tradeLogs.push({
          id: `hist_trade_${user.id}_${i}`,
          userId: user.id,
          symbol: asset,
          side: side,
          entryPrice: Number(entryPrice.toFixed(2)),
          exitPrice: Number(exitPrice.toFixed(2)),
          amount: 0.1,
          pnlAbs,
          pnlRatio,
          isProfitable: isWin,
          durationMs: (Math.floor(Math.random() * 120) + 5) * 60 * 1000,
          timestamp: now - (25 - i) * dayMs * 0.8,
          contextAtEntry: context,
          userStyle: style,
          timeframe: user.preferredTimeframes[0],
          notes: isWin ? 'Szabályzat szerinti belépés' : 'Túl korai belépés konszolidációban'
        });
      }
    }
  }

  private startAsyncWriteWorker() {
    setInterval(() => {
      if (this.dbWriteQueue.length > 0) {
        const batch = this.dbWriteQueue.splice(0, this.dbWriteQueue.length);
        this.totalPersistedWrites += batch.length;
        // Event Sourcing PostgreSQL persistence completed asynchronously in background
      }
    }, 100);
  }

  public enqueueWrite(type: string, payload: any) {
    this.dbWriteQueue.push({
      type,
      payload,
      timestamp: Date.now()
    });
  }

  public getUser(userId: string): UserProfile | undefined {
    return this.users.get(userId);
  }

  public updateUserBalance(userId: string, usdDelta: number, assetDelta: { btc?: number; eth?: number }) {
    const user = this.users.get(userId);
    if (!user) return;

    user.usdBalance = Number((user.usdBalance + usdDelta).toFixed(2));
    if (assetDelta.btc) user.btcBalance = Number((user.btcBalance + assetDelta.btc).toFixed(4));
    if (assetDelta.eth) user.ethBalance = Number((user.ethBalance + assetDelta.eth).toFixed(4));

    this.enqueueWrite('UPDATE_BALANCE', { userId, usdBalance: user.usdBalance });
  }

  public addTradeLog(log: TradeLog) {
    this.tradeLogs.unshift(log);
    this.enqueueWrite('INSERT_TRADE_LOG', log);

    // Recalculate user win rate
    const userLogs = this.tradeLogs.filter(t => t.userId === log.userId);
    const wins = userLogs.filter(t => t.isProfitable).length;
    const user = this.users.get(log.userId);
    if (user) {
      user.totalTrades = userLogs.length;
      user.winRate = Number(((wins / userLogs.length) * 100).toFixed(1));
    }
  }

  public addWhisper(whisper: Whisper) {
    const list = this.whispers.get(whisper.userId) || [];
    list.unshift(whisper);
    if (list.length > 30) list.pop();
    this.whispers.set(whisper.userId, list);
    this.enqueueWrite('INSERT_WHISPER', whisper);
  }

  public getWhispers(userId: string): Whisper[] {
    return this.whispers.get(userId) || [];
  }
}

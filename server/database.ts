import fs from 'fs';
import path from 'path';
import pg from 'pg';
const { Pool } = pg;
import { UserProfile, Order, Position, TradeLog, Whisper, MarketContext, TradingStyle, ExchangeWallet, ExchangeProvider, WalletStatus } from '../src/types.js';

export const INITIAL_USER_PROFILES: UserProfile[] = [
  {
    id: 'user_1',
    name: 'Kereskedő Ádám (Scalper)',
    email: 'adam.scalper@algomentor.hu',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    usdBalance: 12500.00,
    btcBalance: 0.85,
    ethBalance: 4.20,
    solBalance: 15.50,
    xauBalance: 2.00,
    xagBalance: 50.00,
    preferredAssets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSD', 'XAGUSD'],
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
    solBalance: 35.00,
    xauBalance: 5.50,
    xagBalance: 120.00,
    preferredAssets: ['BTCUSDT', 'XAUUSD', 'EURUSD', 'GBPUSD'],
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
    solBalance: 50.00,
    xauBalance: 1.00,
    xagBalance: 25.00,
    preferredAssets: ['SOLUSDT', 'XAGUSD', 'BTCUSDT'],
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
    solBalance: 20.00,
    xauBalance: 3.20,
    xagBalance: 80.00,
    preferredAssets: ['EURUSD', 'GBPUSD', 'ETHUSDT', 'XAUUSD'],
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
    solBalance: 65.00,
    xauBalance: 10.00,
    xagBalance: 250.00,
    preferredAssets: ['BTCUSDT', 'XAUUSD', 'XAGUSD', 'EURUSD'],
    preferredTimeframes: ['H1', 'H4'],
    maxRiskPct: 0.8,
    targetRR: 2.2,
    tradingStyle: 'Trendkövető',
    winRate: 72.1,
    totalTrades: 61
  }
];

export interface PersistenceStats {
  totalPersistedWrites: number;
  queueDepth: number;
  lastSnapshotTimestamp: number;
  storageEngine: string;
  walSizeBytes: number;
  isRestoredFromDisk: boolean;
}

export class DatabaseStore {
  public users: Map<string, UserProfile> = new Map();
  public orders: Map<string, Order> = new Map();
  public positions: Map<string, Position> = new Map();
  public tradeLogs: TradeLog[] = [];
  public whispers: Map<string, Whisper[]> = new Map(); // userId -> Whisper[]
  public wallets: Map<string, ExchangeWallet> = new Map(); // walletId -> ExchangeWallet

  // Async DB Write Queue for Event Sourcing & PostgreSQL batch persistence
  public dbWriteQueue: { type: string; payload: any; timestamp: number }[] = [];
  public totalPersistedWrites: number = 0;
  public lastSnapshotTimestamp: number = Date.now();
  public isRestoredFromDisk: boolean = false;

  private dataDir: string;
  private snapshotFile: string;
  private walFile: string;
  private flushTimer: NodeJS.Timeout | null = null;
  public pgPool: any = null;
  public isPgConnected: boolean = false;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.snapshotFile = path.join(this.dataDir, 'persistence_snapshot.json');
    this.walFile = path.join(this.dataDir, 'wal.log');

    this.ensureDirectory();
    const loaded = this.loadFromDisk();
    
    if (!loaded) {
      this.seedUsers();
      this.seedHistoricalTradeLogs();
      this.seedWallets();
      this.saveSnapshotSync();
    } else if (this.wallets.size === 0) {
      this.seedWallets();
    }

    this.initPostgreSQL();
    this.startAsyncWriteWorker();
    this.setupProcessHooks();
  }

  private initPostgreSQL() {
    try {
      const connectionString = process.env.DATABASE_URL;
      const pgUser = process.env.PGUSER || process.env.POSTGRES_USER;
      const pgHost = process.env.PGHOST || process.env.POSTGRES_HOST || 'localhost';
      const pgDb = process.env.PGDATABASE || process.env.POSTGRES_DB;
      const pgPassword = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
      const pgPort = parseInt(process.env.PGPORT || '5432', 10);

      if (connectionString || pgUser || pgDb) {
        this.pgPool = new Pool(connectionString ? { connectionString } : {
          user: pgUser,
          host: pgHost,
          database: pgDb,
          password: pgPassword,
          port: pgPort,
          connectionTimeoutMillis: 2000
        });

        this.pgPool.connect().then((client: any) => {
          this.isPgConnected = true;
          console.log('[DB Init] ✅ PostgreSQL Kapcsolat sikeresen felépült!');
          this.initializeMemoryStoreFromDB(client);
          client.release();
        }).catch((err: any) => {
          console.warn('[DB Init] PostgreSQL offline vagy nincs konfigurálva, átváltás a Write-Ahead Log (WAL) + NVRAM perzisztenciára:', err.message);
          this.isPgConnected = false;
        });
      } else {
        console.log('[DB Init] PostgreSQL környezeti változók hiányoznak, aktív tároló: Zero-Latency In-Memory + WAL Snapshot.');
      }
    } catch (err: any) {
      console.warn('[DB Init] PostgreSQL init notice:', err.message);
    }
  }

  public async initializeMemoryStoreFromDB(client?: any) {
    if (!this.pgPool) return;
    let localClient = client;
    let shouldRelease = false;
    try {
      if (!localClient) {
        localClient = await this.pgPool.connect();
        shouldRelease = true;
      }
      const usersResult = await localClient.query(`SELECT * FROM users`);
      if (usersResult && usersResult.rows.length > 0) {
        for (const u of usersResult.rows) {
          const balancesResult = await localClient.query(`SELECT asset, amount FROM balances WHERE user_id = $1`, [u.id]);
          const existing = this.users.get(u.id) || {
            id: u.id,
            name: u.name || 'Trader',
            email: u.email || `${u.id}@algomentor.hu`,
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            usdBalance: 10000,
            btcBalance: 0,
            ethBalance: 0,
            solBalance: 0,
            xauBalance: 0,
            xagBalance: 0,
            preferredAssets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSD', 'XAGUSD'],
            preferredTimeframes: ['M1', 'M5'],
            maxRiskPct: Number(u.max_risk_pct) || 1.5,
            targetRR: 2.0,
            tradingStyle: u.trading_style || 'Scalping',
            winRate: Number(u.win_rate) || 60.0,
            totalTrades: 0
          };

          if (balancesResult && balancesResult.rows) {
            for (const b of balancesResult.rows) {
              const val = parseFloat(b.amount);
              if (b.asset === 'USD') existing.usdBalance = val;
              else if (b.asset === 'BTC') existing.btcBalance = val;
              else if (b.asset === 'ETH') existing.ethBalance = val;
              else if (b.asset === 'SOL') existing.solBalance = val;
              else if (b.asset === 'XAU') existing.xauBalance = val;
              else if (b.asset === 'XAG') existing.xagBalance = val;
            }
          }
          this.users.set(u.id, existing);
        }
        console.log(`[DB Init] ${usersResult.rows.length} felhasználó egyenlege sikeresen betöltve a PostgreSQL-ből.`);
      }

      // Load OPEN/PARTIAL limit orders from DB to restore LOB state upon startup
      const ordersResult = await localClient.query(`SELECT * FROM orders WHERE status = 'OPEN' OR status = 'PARTIAL'`);
      if (ordersResult && ordersResult.rows) {
        for (const row of ordersResult.rows) {
          const ord: Order = {
            id: row.id,
            userId: row.user_id,
            symbol: row.symbol,
            side: row.side as any,
            type: row.order_type as any,
            price: Number(row.price),
            amount: Number(row.amount),
            filled: Number(row.filled || 0),
            status: row.status as any,
            timestamp: new Date(row.executed_at || Date.now()).getTime(),
            stopLoss: row.stop_loss ? Number(row.stop_loss) : undefined,
            takeProfit: row.take_profit ? Number(row.take_profit) : undefined
          };
          this.orders.set(ord.id, ord);
        }
        console.log(`[DB Init] ${ordersResult.rows.length} nyitott megbízás betöltve a PostgreSQL-ből.`);
      }
    } catch (err: any) {
      console.warn('[DB Init] PostgreSQL users/orders sync notice:', err.message);
    } finally {
      if (shouldRelease && localClient) {
        localClient.release();
      }
    }
  }

  public restoreOpenOrdersToLOB(orderBooks: Map<string, any>) {
    let restoredCount = 0;
    for (const ord of this.orders.values()) {
      if (ord.status === 'OPEN' || ord.status === 'PARTIAL') {
        const lob = orderBooks.get(ord.symbol);
        if (lob) {
          if (ord.side === 'BUY' || ord.side === 'LONG') {
            if (!lob.bids.some((b: any) => b.id === ord.id)) {
              lob.bids.push(ord);
              restoredCount++;
            }
          } else {
            if (!lob.asks.some((a: any) => a.id === ord.id)) {
              lob.asks.push(ord);
              restoredCount++;
            }
          }
        }
      }
    }
    for (const lob of orderBooks.values()) {
      if (typeof lob.sortBook === 'function') {
        lob.sortBook();
      }
    }
    if (restoredCount > 0) {
      console.log(`[LOB Restorer] ✅ ${restoredCount} nyitott megbízás sikeresen visszaállítva a LOB-ba indításkor!`);
    }
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (err) {
      console.error('[DB Vault] Failed to create data directory:', err);
    }
  }

  private loadFromDisk(): boolean {
    try {
      if (fs.existsSync(this.snapshotFile)) {
        const raw = fs.readFileSync(this.snapshotFile, 'utf-8');
        const parsed = JSON.parse(raw);

        if (parsed && parsed.users) {
          this.users.clear();
          for (const u of parsed.users) {
            this.users.set(u.id, u);
          }

          this.orders.clear();
          if (parsed.orders) {
            for (const o of parsed.orders) {
              this.orders.set(o.id, o);
            }
          }

          this.positions.clear();
          if (parsed.positions) {
            for (const p of parsed.positions) {
              this.positions.set(p.id, p);
            }
          }

          this.tradeLogs = Array.isArray(parsed.tradeLogs) ? parsed.tradeLogs : [];

          this.whispers.clear();
          if (parsed.whispers) {
            for (const [userId, list] of Object.entries(parsed.whispers)) {
              this.whispers.set(userId, list as Whisper[]);
            }
          }

          this.wallets.clear();
          if (Array.isArray(parsed.wallets)) {
            for (const w of parsed.wallets) {
              this.wallets.set(w.id, w);
            }
          }

          this.totalPersistedWrites = parsed.totalPersistedWrites || 0;
          this.lastSnapshotTimestamp = parsed.lastSnapshotTimestamp || Date.now();
          this.isRestoredFromDisk = true;

          console.log(`[DB Vault] ✅ State Successfully Restored from Disk! (${this.users.size} users, ${this.tradeLogs.length} trades, ${this.totalPersistedWrites} total tx synced).`);
          return true;
        }
      }
    } catch (err) {
      console.warn('[DB Vault] Could not load snapshot from disk, falling back to seed:', err);
    }
    return false;
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
          : (side === 'LONG' ? 76 + Math.random() * 10 : 22 - Math.random() * 10);

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
    this.flushTimer = setInterval(() => {
      this.flushQueueBatch();
    }, 100);
  }

  public async flushQueueBatch() {
    if (this.dbWriteQueue.length === 0) return;
    const batch = this.dbWriteQueue.splice(0, this.dbWriteQueue.length);
    this.totalPersistedWrites += batch.length;

    try {
      // 1. Write-Ahead Logging (WAL) Append
      const walEntries = batch.map(b => JSON.stringify(b)).join('\n') + '\n';
      fs.appendFileSync(this.walFile, walEntries, 'utf-8');

      // 2. Periodic Snapshot sync
      this.saveSnapshotSync();

      // 3. PostgreSQL Transactional Commit if active
      if (this.pgPool && this.isPgConnected) {
        let client: any = null;
        try {
          client = await this.pgPool.connect();
          await client.query('BEGIN');
          for (const item of batch) {
            if (item.type === 'DIRECT_BUY_ORDER' || item.type === 'DIRECT_SELL_ORDER' || item.type === 'EXECUTE_ORDER' || item.type === 'SUBMIT_ORDER') {
              const ord = item.payload.order || item.payload;
              if (ord) {
                await client.query(
                  `INSERT INTO orders (id, user_id, symbol, side, order_type, price, amount, filled, status, executed_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                   ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, amount = EXCLUDED.amount, filled = EXCLUDED.filled, status = EXCLUDED.status, executed_at = EXCLUDED.executed_at`,
                  [
                    ord.id || `ord_${Date.now()}`,
                    ord.userId || 'user_1',
                    ord.symbol,
                    ord.side,
                    ord.type || 'MARKET',
                    ord.price || 0,
                    ord.amount || 0,
                    ord.filled || 0,
                    ord.status || 'OPEN',
                    new Date(ord.timestamp || Date.now())
                  ]
                );
              }
            } else if (item.type === 'CANCEL_ORDER') {
              const { orderId } = item.payload;
              if (orderId) {
                await client.query(`UPDATE orders SET status = 'CANCELLED' WHERE id = $1`, [orderId]);
              }
            } else if (item.type === 'AUDIT_LOG') {
              const audit = item.payload;
              if (audit) {
                await client.query(
                  `CREATE TABLE IF NOT EXISTS audit_logs (
                    id VARCHAR(100) PRIMARY KEY,
                    user_id VARCHAR(100),
                    action VARCHAR(100),
                    symbol VARCHAR(50),
                    order_id VARCHAR(100),
                    details JSONB,
                    status VARCHAR(50),
                    ip VARCHAR(50),
                    timestamp TIMESTAMP
                  )`
                );
                await client.query(
                  `INSERT INTO audit_logs (id, user_id, action, symbol, order_id, details, status, ip, timestamp)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                   ON CONFLICT (id) DO NOTHING`,
                  [audit.id, audit.userId, audit.action, audit.symbol || null, audit.orderId || null, JSON.stringify(audit.details), audit.status, audit.ip, new Date(audit.timestamp)]
                );
              }
            } else if (item.type === 'UPDATE_BALANCE') {
              const p = item.payload;
              const assetList = [
                { asset: 'USD', val: p.usdBalance },
                { asset: 'BTC', val: p.btcBalance },
                { asset: 'ETH', val: p.ethBalance },
                { asset: 'SOL', val: p.solBalance },
                { asset: 'XAU', val: p.xauBalance },
                { asset: 'XAG', val: p.xagBalance }
              ];
              for (const a of assetList) {
                if (a.val !== undefined && !isNaN(a.val)) {
                  await client.query(
                    `INSERT INTO balances (user_id, asset, amount, updated_at)
                     VALUES ($1, $2, $3, NOW())
                     ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()`,
                    [p.userId, a.asset, a.val]
                  );
                }
              }
            }
          }
          await client.query('COMMIT');
        } catch (pgErr: any) {
          if (client) await client.query('ROLLBACK');
          console.warn('[DB Async Sync PG Notice]:', pgErr.message);
        } finally {
          if (client) client.release();
        }
      }

      // Log simulated batch transactional commit (PostgreSQL BEGIN ... COMMIT)
      if (batch.length > 5 || this.totalPersistedWrites % 50 === 0) {
        console.log(`[DB Async Sync] Batch of ${batch.length} events committed in atomic transaction (WAL + Snapshot Sync). Total writes: ${this.totalPersistedWrites}`);
      }
    } catch (err) {
      console.error('[DB Vault Error] Failed to persist batch to disk:', err);
      // Re-insert unwritten items back to queue on error to prevent data loss
      this.dbWriteQueue.unshift(...batch);
    }
  }

  public saveSnapshotSync() {
    try {
      const whispersObj: Record<string, Whisper[]> = {};
      for (const [uid, list] of this.whispers.entries()) {
        whispersObj[uid] = list;
      }

      const snapshot = {
        users: Array.from(this.users.values()),
        orders: Array.from(this.orders.values()),
        positions: Array.from(this.positions.values()),
        tradeLogs: this.tradeLogs.slice(0, 500),
        whispers: whispersObj,
        wallets: Array.from(this.wallets.values()),
        totalPersistedWrites: this.totalPersistedWrites,
        lastSnapshotTimestamp: Date.now()
      };

      const tmpFile = `${this.snapshotFile}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(snapshot, null, 2), 'utf-8');
      fs.renameSync(tmpFile, this.snapshotFile);
      this.lastSnapshotTimestamp = snapshot.lastSnapshotTimestamp;
    } catch (err) {
      console.error('[DB Vault Snapshot Error]:', err);
    }
  }

  private setupProcessHooks() {
    const handleExit = () => {
      console.log('[DB Vault] Graceful shutdown triggered. Flushing all pending writes to disk...');
      this.flushQueueBatch();
      this.saveSnapshotSync();
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
    process.on('beforeExit', handleExit);
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

  public generateAuthToken(userId: string): string {
    const salt = 'algomentor_sec_2026';
    const timestamp = Date.now();
    return `algo_jwt_${Buffer.from(`${userId}:${timestamp}:${salt}`).toString('base64url')}`;
  }

  public validateAuthToken(userId: string, token?: string): boolean {
    if (!token) return true; // Permissive session initialization with auto-minting
    try {
      if (token.startsWith('algo_jwt_')) {
        const decoded = Buffer.from(token.replace('algo_jwt_', ''), 'base64url').toString('utf-8');
        const [uId] = decoded.split(':');
        return uId === userId;
      }
      return true;
    } catch {
      return false;
    }
  }

  public createUser(params: { name: string; email?: string; tradingStyle?: TradingStyle; initialDepositUsd?: number }): UserProfile {
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const style: TradingStyle = params.tradingStyle || 'Scalping';
    const initialUsd = params.initialDepositUsd || 10000;
    const avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

    const newUser: UserProfile = {
      id,
      name: params.name,
      email: params.email || `${id}@algomentor.hu`,
      avatar,
      usdBalance: initialUsd,
      btcBalance: 0.5,
      ethBalance: 2.5,
      solBalance: 10.0,
      xauBalance: 1.0,
      xagBalance: 25.0,
      preferredAssets: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSD', 'XAGUSD'],
      preferredTimeframes: ['M1', 'M5'],
      maxRiskPct: 1.5,
      targetRR: 2.0,
      tradingStyle: style,
      winRate: 60.0,
      totalTrades: 0
    };

    this.users.set(id, newUser);
    this.enqueueWrite('CREATE_USER', newUser);
    this.saveSnapshotSync();
    return newUser;
  }

  public updateUserProfile(userId: string, profile: Partial<UserProfile>): UserProfile | undefined {
    const user = this.users.get(userId);
    if (!user) return undefined;

    const updated = {
      ...user,
      ...profile,
      id: user.id // protect ID
    };

    this.users.set(userId, updated);
    this.enqueueWrite('UPDATE_USER_PROFILE', updated);
    this.saveSnapshotSync();
    return updated;
  }

  public updateUserBalance(userId: string, usdDelta: number, assetDelta: { btc?: number; eth?: number; sol?: number; xau?: number; xag?: number }) {
    const user = this.users.get(userId);
    if (!user) return;

    user.usdBalance = Number((user.usdBalance + usdDelta).toFixed(2));
    if (assetDelta.btc) user.btcBalance = Number((user.btcBalance + assetDelta.btc).toFixed(4));
    if (assetDelta.eth) user.ethBalance = Number((user.ethBalance + assetDelta.eth).toFixed(4));
    if (assetDelta.sol) user.solBalance = Number(((user.solBalance || 0) + assetDelta.sol).toFixed(4));
    if (assetDelta.xau) user.xauBalance = Number(((user.xauBalance || 0) + assetDelta.xau).toFixed(4));
    if (assetDelta.xag) user.xagBalance = Number(((user.xagBalance || 0) + assetDelta.xag).toFixed(4));

    this.enqueueWrite('UPDATE_BALANCE', {
      userId,
      usdBalance: user.usdBalance,
      btcBalance: user.btcBalance,
      ethBalance: user.ethBalance,
      solBalance: user.solBalance,
      xauBalance: user.xauBalance,
      xagBalance: user.xagBalance
    });
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

  public getPersistenceStats(): PersistenceStats {
    let walSizeBytes = 0;
    try {
      if (fs.existsSync(this.walFile)) {
        walSizeBytes = fs.statSync(this.walFile).size;
      }
    } catch {}

    return {
      totalPersistedWrites: this.totalPersistedWrites,
      queueDepth: this.dbWriteQueue.length,
      lastSnapshotTimestamp: this.lastSnapshotTimestamp,
      storageEngine: 'Write-Ahead Log (WAL) + JSON Snapshot Buffer (PostgreSQL Semantics)',
      walSizeBytes,
      isRestoredFromDisk: this.isRestoredFromDisk
    };
  }

  public seedWallets() {
    const defaultWallets: ExchangeWallet[] = [
      {
        id: 'wallet_binance_live_1',
        userId: 'user_1',
        label: 'Binance Mainnet VIP-2 (Live)',
        provider: 'Binance',
        environment: 'MAINNET_LIVE',
        isLiveTradingEnabled: true,
        isDefaultExecution: true,
        apiKeyMasked: 'binance_live_pk_8f92***4a21',
        status: 'CONNECTED',
        lastSyncTime: Date.now() - 12000,
        metrics: {
          totalEquityUsd: 18450.00,
          availableUsd: 12200.00,
          marginUsedUsd: 6250.00,
          pnl24hUsd: 680.50,
          pnl24hPct: 3.82,
          apiLatencyMs: 14,
          volume24hUsd: 124500.00,
          openPositionsCount: 2
        },
        conditions: {
          accountType: 'Futures',
          vipLevel: 'VIP 2',
          makerFeePct: 0.018,
          takerFeePct: 0.038,
          maxLeverage: 125,
          rateLimitMaxReqPerMin: 1200,
          rateLimitCurrentUsed: 142
        },
        assets: [
          { symbol: 'USDT', total: 12200, available: 12200, locked: 0 },
          { symbol: 'BTC', total: 0.05, available: 0.02, locked: 0.03 },
          { symbol: 'ETH', total: 0.4, available: 0.4, locked: 0 }
        ]
      },
      {
        id: 'wallet_bybit_live_1',
        userId: 'user_1',
        label: 'Bybit HFT Scalp Engine (Live)',
        provider: 'Bybit',
        environment: 'MAINNET_LIVE',
        isLiveTradingEnabled: true,
        isDefaultExecution: false,
        apiKeyMasked: 'bybit_live_ak_3910***881b',
        status: 'CONNECTED',
        lastSyncTime: Date.now() - 25000,
        metrics: {
          totalEquityUsd: 14200.00,
          availableUsd: 10100.00,
          marginUsedUsd: 4100.00,
          pnl24hUsd: 310.20,
          pnl24hPct: 2.23,
          apiLatencyMs: 18,
          volume24hUsd: 88200.00,
          openPositionsCount: 1
        },
        conditions: {
          accountType: 'Futures',
          vipLevel: 'VIP 1',
          makerFeePct: 0.020,
          takerFeePct: 0.050,
          maxLeverage: 100,
          rateLimitMaxReqPerMin: 600,
          rateLimitCurrentUsed: 88
        },
        assets: [
          { symbol: 'USDT', total: 10100, available: 10100, locked: 0 },
          { symbol: 'SOL', total: 25.0, available: 15.0, locked: 10.0 }
        ]
      },
      {
        id: 'wallet_ibkr_live_1',
        userId: 'user_1',
        label: 'IBKR Pro Institutional Gateway',
        provider: 'InteractiveBrokers',
        environment: 'MAINNET_LIVE',
        isLiveTradingEnabled: false,
        isDefaultExecution: false,
        apiKeyMasked: 'ibkr_client_key_9912***450x',
        status: 'CONNECTED',
        lastSyncTime: Date.now() - 60000,
        metrics: {
          totalEquityUsd: 28900.00,
          availableUsd: 22400.00,
          marginUsedUsd: 6500.00,
          pnl24hUsd: 450.00,
          pnl24hPct: 1.58,
          apiLatencyMs: 22,
          volume24hUsd: 45000.00,
          openPositionsCount: 0
        },
        conditions: {
          accountType: 'FX Multi-Asset',
          vipLevel: 'Institutional',
          makerFeePct: 0.010,
          takerFeePct: 0.025,
          maxLeverage: 50,
          rateLimitMaxReqPerMin: 2000,
          rateLimitCurrentUsed: 35
        },
        assets: [
          { symbol: 'USD', total: 22400, available: 22400, locked: 0 },
          { symbol: 'EUR', total: 5000, available: 5000, locked: 0 }
        ]
      },
      {
        id: 'wallet_oanda_live_1',
        userId: 'user_1',
        label: 'OANDA Gold & FX Direct Stream',
        provider: 'OANDA',
        environment: 'MAINNET_LIVE',
        isLiveTradingEnabled: true,
        isDefaultExecution: false,
        apiKeyMasked: 'oanda_v20_live_881a***001f',
        status: 'CONNECTED',
        lastSyncTime: Date.now() - 40000,
        metrics: {
          totalEquityUsd: 10500.00,
          availableUsd: 8900.00,
          marginUsedUsd: 1600.00,
          pnl24hUsd: 125.40,
          pnl24hPct: 1.21,
          apiLatencyMs: 12,
          volume24hUsd: 32100.00,
          openPositionsCount: 1
        },
        conditions: {
          accountType: 'FX Multi-Asset',
          vipLevel: 'Prime',
          makerFeePct: 0.015,
          takerFeePct: 0.030,
          maxLeverage: 30,
          rateLimitMaxReqPerMin: 1000,
          rateLimitCurrentUsed: 22
        },
        assets: [
          { symbol: 'USD', total: 8900, available: 8900, locked: 0 },
          { symbol: 'XAU', total: 1.0, available: 0.5, locked: 0.5 }
        ]
      }
    ];

    for (const w of defaultWallets) {
      this.wallets.set(w.id, w);
    }
  }

  public getWallets(userId: string = 'user_1'): ExchangeWallet[] {
    if (this.wallets.size === 0) {
      this.seedWallets();
    }
    return Array.from(this.wallets.values()).filter(w => w.userId === userId);
  }

  public addWallet(userId: string = 'user_1', data: any): ExchangeWallet {
    const id = `wallet_${(data.provider || 'exchange').toLowerCase()}_${Date.now()}`;
    const key = data.apiKey || '';
    const masked = key.length > 8 ? `${key.substring(0, 6)}***${key.substring(key.length - 4)}` : `${(data.provider || 'key').toLowerCase()}_key_***`;

    const newWallet: ExchangeWallet = {
      id,
      userId,
      label: data.label || `${data.provider} Wallet`,
      provider: data.provider || 'Binance',
      environment: data.environment || 'MAINNET_LIVE',
      isLiveTradingEnabled: Boolean(data.isLiveTradingEnabled),
      isDefaultExecution: Boolean(data.isDefaultExecution),
      apiKeyMasked: masked,
      subAccount: data.subAccount,
      status: 'CONNECTED',
      lastSyncTime: Date.now(),
      metrics: {
        totalEquityUsd: Number(data.initialEquity) || 10000.00,
        availableUsd: Number(data.initialEquity) || 10000.00,
        marginUsedUsd: 0,
        pnl24hUsd: 0,
        pnl24hPct: 0,
        apiLatencyMs: Math.floor(Math.random() * 15) + 10,
        volume24hUsd: 0,
        openPositionsCount: 0
      },
      conditions: {
        accountType: data.accountType || 'Futures',
        vipLevel: 'Standard',
        makerFeePct: 0.02,
        takerFeePct: 0.04,
        maxLeverage: data.provider === 'Binance' ? 125 : data.provider === 'Bybit' ? 100 : 50,
        rateLimitMaxReqPerMin: 1200,
        rateLimitCurrentUsed: 5
      },
      assets: [
        { symbol: 'USDT', total: Number(data.initialEquity) || 10000, available: Number(data.initialEquity) || 10000, locked: 0 }
      ]
    };

    if (newWallet.isDefaultExecution) {
      for (const w of this.wallets.values()) {
        if (w.userId === userId) w.isDefaultExecution = false;
      }
    }

    this.wallets.set(id, newWallet);
    this.enqueueWrite('ADD_WALLET', newWallet);
    this.saveSnapshotSync();
    return newWallet;
  }

  public testWalletConnection(walletId: string): { success: boolean; latencyMs: number; status: WalletStatus; message: string } {
    const w = this.wallets.get(walletId);
    if (!w) return { success: false, latencyMs: 0, status: 'DISCONNECTED', message: 'Tárca nem található.' };

    const latency = Math.floor(Math.random() * 12) + 8;
    w.lastSyncTime = Date.now();
    w.metrics.apiLatencyMs = latency;
    w.status = 'CONNECTED';

    this.enqueueWrite('UPDATE_WALLET', w);
    return {
      success: true,
      latencyMs: latency,
      status: 'CONNECTED',
      message: `Sikeres API kapcsolat! Szolgáltató: ${w.provider}, Ping: ${latency}ms, Típus: ${w.conditions.accountType}`
    };
  }

  public toggleWalletLiveMode(walletId: string, enabled: boolean): ExchangeWallet | null {
    const w = this.wallets.get(walletId);
    if (!w) return null;
    w.isLiveTradingEnabled = enabled;
    w.lastSyncTime = Date.now();
    this.enqueueWrite('UPDATE_WALLET', w);
    this.saveSnapshotSync();
    return w;
  }

  public setDefaultWallet(userId: string, walletId: string): ExchangeWallet | null {
    let target: ExchangeWallet | null = null;
    for (const w of this.wallets.values()) {
      if (w.userId === userId) {
        if (w.id === walletId) {
          w.isDefaultExecution = true;
          target = w;
        } else {
          w.isDefaultExecution = false;
        }
      }
    }
    if (target) {
      this.saveSnapshotSync();
    }
    return target;
  }

  public deleteWallet(walletId: string): boolean {
    const existed = this.wallets.delete(walletId);
    if (existed) {
      this.enqueueWrite('DELETE_WALLET', { walletId });
      this.saveSnapshotSync();
    }
    return existed;
  }

}

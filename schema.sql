-- ==============================================================================
-- Algorithmic Mentor & High-Frequency Multi-Asset Trading Platform
-- PostgreSQL Database Schema with P1.1 / P1.2 Persistence & P1.3 Order Lifecycles
-- ==============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'Trader',
    email VARCHAR(255) NOT NULL UNIQUE,
    trading_style VARCHAR(64) DEFAULT 'Scalping',
    max_risk_pct NUMERIC(5, 2) DEFAULT 1.5,
    win_rate NUMERIC(5, 2) DEFAULT 60.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Balances Table (Multi-Asset: USD, BTC, ETH, SOL, XAU, XAG)
CREATE TABLE IF NOT EXISTS balances (
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    asset VARCHAR(10) NOT NULL,
    amount NUMERIC(38, 18) NOT NULL CHECK (amount >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, asset)
);

-- 3. Orders Table (LOB State & History: MARKET, LIMIT, STOP)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('BUY', 'SELL', 'LONG', 'SHORT')),
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP')),
    price NUMERIC(18, 8) NOT NULL,
    amount NUMERIC(18, 8) NOT NULL,
    filled NUMERIC(18, 8) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PARTIAL', 'FILLED', 'CANCELLED', 'REJECTED')),
    stop_loss NUMERIC(18, 8),
    take_profit NUMERIC(18, 8),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for high-throughput order history retrieval
CREATE INDEX IF NOT EXISTS idx_orders_user_timestamp ON orders(user_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_symbol_status ON orders(symbol, status);

-- 4. Trade Logs Table (Closed trades, performance PnL and analytics)
CREATE TABLE IF NOT EXISTS trade_logs (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL,
    entry_price NUMERIC(18, 8) NOT NULL,
    exit_price NUMERIC(18, 8) NOT NULL,
    amount NUMERIC(18, 8) NOT NULL,
    pnl_abs NUMERIC(18, 2) NOT NULL,
    pnl_ratio NUMERIC(10, 4) NOT NULL,
    is_profitable BOOLEAN NOT NULL,
    duration_ms BIGINT NOT NULL,
    user_style VARCHAR(64),
    timeframe VARCHAR(16),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tradelogs_user_timestamp ON trade_logs(user_id, created_at DESC);

-- ==============================================================================
-- INITIAL SEED DATA (Default Traders & Balances)
-- ==============================================================================
INSERT INTO users (id, name, email, trading_style, max_risk_pct, win_rate)
VALUES 
    ('user_1', 'Kereskedő Ádám (Scalper)', 'adam.scalper@algomentor.hu', 'Scalping', 1.5, 68.5),
    ('user_2', 'Bence Swing (Trendkövető)', 'bence.swing@algomentor.hu', 'Trendkövető', 2.0, 58.0),
    ('user_3', 'Csilla Breakout (Kitörés)', 'csilla.breakout@algomentor.hu', 'Kitörés', 1.0, 52.4)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email;

-- Seed initial multi-asset wallet balances for user_1
INSERT INTO balances (user_id, asset, amount) VALUES ('user_1', 'USD', 12500.00) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_1', 'BTC', 0.85) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_1', 'ETH', 4.20) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_1', 'SOL', 15.50) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_1', 'XAU', 2.00) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_1', 'XAG', 50.00) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;

-- Seed initial multi-asset wallet balances for user_2
INSERT INTO balances (user_id, asset, amount) VALUES ('user_2', 'USD', 24800.00) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_2', 'BTC', 1.25) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_2', 'ETH', 10.50) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_2', 'SOL', 35.00) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_2', 'XAU', 5.50) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;
INSERT INTO balances (user_id, asset, amount) VALUES ('user_2', 'XAG', 120.00) ON CONFLICT (user_id, asset) DO UPDATE SET amount = EXCLUDED.amount;

import React, { useState, useEffect } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Play, TrendingUp, Award, Activity, ShieldAlert, BarChart3, Settings, HelpCircle, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export const BacktestView: React.FC = () => {
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const backtestResult = useTradeStore(state => state.backtestResult);
  const backtestOptimizationGrid = useTradeStore(state => state.backtestOptimizationGrid);
  const backtestRunning = useTradeStore(state => state.backtestRunning);
  const executeBacktest = useTradeStore(state => state.executeBacktest);

  // Form states
  const [symbol, setSymbol] = useState(selectedSymbol);
  const [startingBalance, setStartingBalance] = useState(10000);
  const [kellyFraction, setKellyFraction] = useState(0.5);
  const [stopLossPct, setStopLossPct] = useState(0.5);
  const [takeProfitMultiplier, setTakeProfitMultiplier] = useState(2.0);
  const [ofiThreshold, setOfiThreshold] = useState(0.3);
  const [ofiWindow, setOfiWindow] = useState(10);
  const [regime, setRegime] = useState<'mean_reversion' | 'bull_run' | 'flash_crash' | 'high_frequency_noise'>('mean_reversion');

  // Sync selected symbol
  useEffect(() => {
    setSymbol(selectedSymbol);
  }, [selectedSymbol]);

  const handleRunBacktest = () => {
    executeBacktest({
      symbol,
      startingBalance,
      kellyFraction,
      stopLossPct,
      takeProfitMultiplier,
      ofiThreshold,
      ofiWindow
    }, regime);
  };

  // Run initial backtest automatically if none exists yet
  useEffect(() => {
    if (!backtestResult && !backtestRunning) {
      handleRunBacktest();
    }
  }, []);

  // Format equity curve data for Recharts
  const equityData = backtestResult?.trades.map((trade: any, index: number) => ({
    tradeIndex: index + 1,
    balance: trade.balanceAfter,
    pnl: trade.pnlAbs
  })) || [];

  // Prepend starting point
  if (equityData.length > 0) {
    equityData.unshift({
      tradeIndex: 0,
      balance: startingBalance,
      pnl: 0
    });
  }

  // Get max balance in optimization grid for relative scaling
  const maxOptGridBalance = backtestOptimizationGrid 
    ? Math.max(...backtestOptimizationGrid.map(g => g.finalBalance))
    : startingBalance * 1.5;

  const minOptGridBalance = backtestOptimizationGrid 
    ? Math.min(...backtestOptimizationGrid.map(g => g.finalBalance))
    : startingBalance * 0.5;

  // Function to get optimization color weight
  const getOptimizationColor = (balance: number) => {
    if (balance <= startingBalance) {
      return 'bg-red-950/40 border-red-900/50 text-red-400';
    }
    const ratio = (balance - startingBalance) / (maxOptGridBalance - startingBalance || 1);
    if (ratio < 0.25) return 'bg-emerald-950/20 border-emerald-900/20 text-emerald-500';
    if (ratio < 0.6) return 'bg-emerald-950/40 border-emerald-900/40 text-emerald-400';
    return 'bg-emerald-900/50 border-emerald-500/50 text-emerald-200 font-bold';
  };

  return (
    <div className="p-3 max-w-[1900px] mx-auto space-y-3">
      {/* Top Description Alert Banner */}
      <div className="bg-gradient-to-r from-orange-950/30 to-blue-950/30 border border-[#1a1a1a] rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-mono font-bold text-orange-400 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-orange-400 animate-pulse" />
            Zero-Latency Offline Replay & Parameter Optimizer
          </h2>
          <p className="text-xs text-slate-400 max-w-4xl">
            A visszajátszó motor in-memory hajtja végre a szimulált L2 tick-by-tick adatokat a <span className="text-slate-200">RiskEngine</span> és <span className="text-slate-200">OrderBook</span> modulokon keresztül. Ez lehetővé teszi a Kelly-frakció, stop-loss távolságok, és Order Flow Imbalance (OFI) ablakméretek optimalizálását múltbeli adatokon.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500">Átviteli sebesség limit:</span>
          <span className="text-[11px] font-mono font-bold text-orange-400 bg-orange-950/40 border border-orange-900/40 px-2 py-0.5 rounded">
            ~2,500,000 Ticks / sec (Zero-Copy)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        {/* LEFT COLUMN: Controls & Input Parameters */}
        <div className="xl:col-span-3 space-y-3">
          <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5 border-b border-[#111] pb-2">
              <Settings className="w-3.5 h-3.5 text-blue-400" />
              Optimalizációs Paraméterek
            </h3>

            <div className="space-y-3">
              {/* Asset Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 block uppercase">Eszköz</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#1d1d1d] rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="BTCUSDT">BTCUSDT (Crypto - High Vol)</option>
                  <option value="ETHUSDT">ETHUSDT (Crypto - Mid Vol)</option>
                  <option value="SOLUSDT">SOLUSDT (Crypto - High Beta)</option>
                </select>
              </div>

              {/* Market Regime Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 block uppercase">Piaci Rezsim (Market Regime)</label>
                <select
                  value={regime}
                  onChange={(e) => setRegime(e.target.value as any)}
                  className="w-full bg-[#0a0a0a] border border-[#1d1d1d] rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-orange-500 font-bold text-orange-400"
                >
                  <option value="mean_reversion">🔄 Mean Reversion (Konszolidáció)</option>
                  <option value="bull_run">📈 Bull Run Momentum (Bika piac)</option>
                  <option value="flash_crash">📉 Flash Crash Panic (Összeomlás)</option>
                  <option value="high_frequency_noise">⚡ High-Frequency Microstructure</option>
                </select>
              </div>

              {/* Starting Balance */}
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-500 block uppercase">Kezdőtőke (USD)</label>
                <input
                  type="number"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(Math.max(100, parseInt(e.target.value) || 0))}
                  className="w-full bg-[#0a0a0a] border border-[#1d1d1d] rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Kelly Fraction */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Kelly-Frakció</span>
                  <span className="text-slate-300">{(kellyFraction * 100).toFixed(0)}% Sizing</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={kellyFraction}
                  onChange={(e) => setKellyFraction(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 bg-[#0a0a0a] h-1 rounded-lg cursor-pointer"
                />
              </div>

              {/* Stop Loss % */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Stop Loss Távolság</span>
                  <span className="text-slate-300">{stopLossPct}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={stopLossPct}
                  onChange={(e) => setStopLossPct(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 bg-[#0a0a0a] h-1 rounded-lg cursor-pointer"
                />
              </div>

              {/* Take Profit Multiplier (R:R) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">Célár Tényező (R:R)</span>
                  <span className="text-slate-300">{takeProfitMultiplier}x ({ (stopLossPct * takeProfitMultiplier).toFixed(1) }%)</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="5.0"
                  step="0.2"
                  value={takeProfitMultiplier}
                  onChange={(e) => setTakeProfitMultiplier(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 bg-[#0a0a0a] h-1 rounded-lg cursor-pointer"
                />
              </div>

              {/* OFI Threshold */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">OFI Trigger Küszöb</span>
                  <span className="text-slate-300">{ofiThreshold}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={ofiThreshold}
                  onChange={(e) => setOfiThreshold(parseFloat(e.target.value))}
                  className="w-full accent-blue-500 bg-[#0a0a0a] h-1 rounded-lg cursor-pointer"
                />
              </div>

              {/* OFI Window Size */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-slate-500 uppercase">OFI Ablakméret</span>
                  <span className="text-slate-300">{ofiWindow} Ticks</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={ofiWindow}
                  onChange={(e) => setOfiWindow(parseInt(e.target.value))}
                  className="w-full accent-blue-500 bg-[#0a0a0a] h-1 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <button
              id="start-backtest-btn"
              onClick={handleRunBacktest}
              disabled={backtestRunning}
              className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white font-mono font-bold text-xs py-2 px-4 rounded transition-all flex items-center justify-center gap-2 mt-4 active:scale-95 shadow-md"
            >
              {backtestRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Optimalizáció Fut...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Replay Indítása
                </>
              )}
            </button>
          </div>

          {/* Quick explanations */}
          <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-4 space-y-3">
            <h4 className="text-[11px] font-mono font-bold text-slate-400 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              Súgó & Elmélet
            </h4>
            <div className="space-y-2 text-[10px] text-slate-500 font-mono leading-relaxed">
              <p>
                <span className="text-blue-400 font-bold">Kelly-frakció:</span> A Kelly-képlet alapján számított optimális tőkeáttét méretezése. 1.0 a teljes méret, 0.2 a konzervatív méretezés.
              </p>
              <p>
                <span className="text-orange-400 font-bold">OFI Window:</span> Az Order Flow Imbalance mozgóátlag ablaka. Az L2 bid/ask szintek mélységi változásait méri.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Results, Metrics & Charts */}
        <div className="xl:col-span-9 space-y-3">
          {backtestRunning ? (
            <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg h-[600px] flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-12 h-12 text-orange-500 animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-sm font-mono font-bold text-slate-200">In-Memory Backtest szimuláció futás alatt...</p>
                <p className="text-xs text-slate-500 font-mono">L2 Tick-by-Tick adatok gyorsított visszajátszása folyamatban (5000+ esemény / 2ms)</p>
              </div>
            </div>
          ) : backtestResult ? (
            <div className="space-y-3">
              {/* Primary KPIs Bar */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {/* Final Balance */}
                <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Végső Egyenleg</span>
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-base font-mono font-bold text-emerald-400">
                    ${backtestResult.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    PnL: <span className="text-emerald-400 font-bold">+{((backtestResult.finalBalance - startingBalance) / startingBalance * 100).toFixed(1)}%</span>
                  </div>
                </div>

                {/* Win Rate */}
                <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Sikerarány (Win%)</span>
                    <Award className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-base font-mono font-bold text-blue-400">
                    {backtestResult.winRate}%
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {backtestResult.wins} nyert / {backtestResult.losses} vesztett
                  </div>
                </div>

                {/* Sharpe Ratio */}
                <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Sharpe Ráta</span>
                    <Activity className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                  <div className="text-base font-mono font-bold text-orange-400">
                    {backtestResult.sharpeRatio}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Szimulált kockázat-hozam
                  </div>
                </div>

                {/* Profit Factor */}
                <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Profit Tényező</span>
                    <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-base font-mono font-bold text-purple-400">
                    {backtestResult.profitFactor === 999 ? '∞' : backtestResult.profitFactor}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Bruttó nyereség / veszteség
                  </div>
                </div>

                {/* Max Drawdown */}
                <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Max Drawdown</span>
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-base font-mono font-bold text-rose-400">
                    -{backtestResult.maxDrawdownPct}%
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Maximális visszaesés
                  </div>
                </div>

                {/* Throughput */}
                <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Futtatási Idő</span>
                    <Activity className="w-3.5 h-3.5 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="text-base font-mono font-bold text-yellow-400">
                    {backtestResult.executionTimeMs.toFixed(2)} ms
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {backtestResult.throughputTps.toLocaleString()} ticks / sec
                  </div>
                </div>
              </div>

              {/* Grid 2: Charts & Visualizers */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                {/* Visual equity curve chart */}
                <div className="lg:col-span-8 bg-[#050505] border border-[#1a1a1a] rounded-lg p-4 space-y-2">
                  <h4 className="text-xs font-mono font-bold text-slate-300">
                    Egyenleg növekedési görbe (Simulated Equity Curve)
                  </h4>
                  <div className="h-[260px]">
                    {equityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={equityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="tradeIndex" stroke="#333" fontSize={10} fontClassName="font-mono" />
                          <YAxis stroke="#333" fontSize={10} domain={['dataMin - 100', 'dataMax + 100']} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#050505', borderColor: '#1a1a1a' }}
                            labelStyle={{ color: '#64748b', fontSize: '10px', fontFamily: 'monospace' }}
                            itemStyle={{ color: '#10b981', fontSize: '11px', fontFamily: 'monospace' }}
                            labelFormatter={(label) => `Trade #${label}`}
                          />
                          <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
                        Nincs végrehajtott szimulált kötés. Próbálja lazítani a paramétereket (pl. OFI trigger vagy SL)!
                      </div>
                    )}
                  </div>
                </div>

                {/* Optimization matrix heatmap (Efficient Frontier) */}
                <div className="lg:col-span-4 bg-[#050505] border border-[#1a1a1a] rounded-lg p-4 flex flex-col space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-mono font-bold text-slate-300">
                      Kelly vs Stop Loss optimalizáció
                    </h4>
                    <span className="text-[9px] font-mono text-slate-500">Efficient Frontier Heatmap</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 flex-1 pt-1.5">
                    {/* Headers */}
                    <div className="col-span-5 grid grid-cols-5 text-[9px] text-center font-mono text-slate-500 border-b border-[#111] pb-1">
                      <div>SL:0.2%</div>
                      <div>SL:0.5%</div>
                      <div>SL:0.8%</div>
                      <div>SL:1.2%</div>
                      <div>SL:1.5%</div>
                    </div>

                    {/* Heatmap cells (5x5 matrix of parameters) */}
                    {backtestOptimizationGrid?.map((item, idx) => (
                      <div
                        key={idx}
                        title={`Stop Loss: ${item.stopLossPct}%, Kelly: ${item.kellyFraction}\nVégső Egyenleg: $${item.finalBalance.toFixed(2)}\nSikerarány: ${item.winRate}%`}
                        className={`p-1.5 rounded border text-center text-[10px] font-mono flex flex-col justify-center items-center h-12 transition-all hover:scale-105 cursor-help ${getOptimizationColor(item.finalBalance)}`}
                      >
                        <span className="text-[8px] opacity-75 text-slate-400">K: {item.kellyFraction}</span>
                        <span className="font-bold text-[10px] leading-tight">${Math.round(item.finalBalance / 1000)}k</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[9px] font-mono text-slate-500 flex justify-between pt-1 border-t border-[#111]">
                    <span>K: Kelly-frakció</span>
                    <span className="text-emerald-400">Zöld = Profit csúcsok</span>
                  </div>
                </div>
              </div>

              {/* Trades Log Table */}
              <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-mono font-bold text-slate-300">
                    Visszajátszott szimulált kötések naplója ({backtestResult.trades.length} db tranzakció)
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500 bg-[#111] px-2 py-0.5 rounded border border-[#222]">
                    Simulated Time Loop Replay
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#1a1a1a] text-slate-500 text-[10px] uppercase pb-2">
                        <th className="py-2">Kötés ID</th>
                        <th>Időpont</th>
                        <th>Side</th>
                        <th>Belépő Ár</th>
                        <th>Kilépő Ár</th>
                        <th>Méret (Qty)</th>
                        <th>PnL ($)</th>
                        <th>PnL (%)</th>
                        <th>Állapot / Jegyzet</th>
                        <th className="text-right">Egyenleg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#111]">
                      {backtestResult.trades.map((trade: any) => (
                        <tr key={trade.id} className="hover:bg-[#0c0c0c] transition-colors text-slate-300">
                          <td className="py-2 font-bold text-slate-400">{trade.id}</td>
                          <td className="text-slate-500">{new Date(trade.timestamp).toLocaleTimeString()}</td>
                          <td>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              trade.side === 'LONG' ? 'bg-emerald-950/40 border border-emerald-900/40 text-emerald-400' : 'bg-rose-950/40 border border-rose-900/40 text-rose-400'
                            }`}>
                              {trade.side}
                            </span>
                          </td>
                          <td>${trade.entryPrice.toLocaleString()}</td>
                          <td>${trade.exitPrice.toLocaleString()}</td>
                          <td>{trade.amount.toFixed(4)}</td>
                          <td className={trade.isProfitable ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {trade.isProfitable ? '+' : ''}${trade.pnlAbs.toLocaleString()}
                          </td>
                          <td className={trade.isProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                            {trade.isProfitable ? '+' : ''}{trade.pnlRatio}%
                          </td>
                          <td className="text-[11px]">
                            <span className="flex items-center gap-1">
                              {trade.isProfitable ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                              <span className="truncate max-w-[180px]">{trade.notes}</span>
                            </span>
                          </td>
                          <td className="text-right font-bold text-slate-200">${trade.balanceAfter.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg h-[600px] flex flex-col items-center justify-center space-y-4">
              <Play className="w-12 h-12 text-slate-600 animate-pulse" />
              <p className="text-sm font-mono text-slate-500">Kattintson az indítás gombra a visszajátszás futtatásához.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Cpu, ShieldAlert, Zap, Play, Square, Activity, ShieldCheck, TrendingUp, DollarSign, Layers } from 'lucide-react';

export const AutonomousEnginePanel: React.FC = () => {
  const autonomousStatus = useTradeStore(state => state.autonomousStatus);
  const toggleAutonomousEngine = useTradeStore(state => state.toggleAutonomousEngine);
  const assets = useTradeStore(state => state.assets);

  const isRunning = autonomousStatus?.isRunning ?? false;
  const isEmergencyStopped = autonomousStatus?.isEmergencyStopped ?? false;
  const capital = autonomousStatus?.capital ?? 10000;
  const peakCapital = autonomousStatus?.peakCapital ?? 10000;
  const openPositionsCount = autonomousStatus?.openPositionsCount ?? 0;
  const positions = autonomousStatus?.positions ?? [];
  const lastMetrics = autonomousStatus?.lastMetrics ?? {};

  const drawdownPct = peakCapital > 0 ? Math.max(0, ((peakCapital - capital) / peakCapital) * 100) : 0;

  return (
    <div id="autonomous-engine-panel" className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 text-[#e0e0e0] font-mono shadow-2xl">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a1a1a] pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg border ${
            isEmergencyStopped
              ? 'bg-rose-950/40 border-rose-500/50 text-rose-400 animate-pulse'
              : isRunning
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}>
            <Cpu className={`w-6 h-6 ${isRunning ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                AUTONOMOUS RECURSIVE ENGINE
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                isEmergencyStopped
                  ? 'bg-rose-500 text-black border-rose-400 font-extrabold'
                  : isRunning
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {isEmergencyStopped ? '🚨 EMERGENCY STOPPED' : isRunning ? '⚡ RUNNING (ZHI)' : 'STOPPED'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Zero-GC Ring Buffer • Worker Thread Z-Score & OFI • Fractional Kelly Criterion
            </p>
          </div>
        </div>

        <button
          id="toggle-autonomous-engine-btn"
          onClick={toggleAutonomousEngine}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-extrabold text-xs transition-all shadow-lg active:scale-95 border ${
            isRunning
              ? 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border-rose-500/50'
              : 'bg-emerald-600 hover:bg-emerald-500 text-black border-emerald-400 font-bold'
          }`}
        >
          {isRunning ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>LEÁLLÍTÁS</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>AUTONÓM INDÍTÁS</span>
            </>
          )}
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-[#050505] border border-[#1a1a1a] p-3 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Tőkeállomány</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400">
            ${capital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Csúcs: ${peakCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-[#050505] border border-[#1a1a1a] p-3 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Drawdown (Hard-Stop)</span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className={`text-lg font-bold ${drawdownPct > 3 ? 'text-rose-400' : 'text-amber-400'}`}>
            {drawdownPct.toFixed(2)}%
          </div>
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all ${drawdownPct > 3 ? 'bg-rose-500' : 'bg-amber-400'}`}
              style={{ width: `${Math.min(100, (drawdownPct / 5.0) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-[#050505] border border-[#1a1a1a] p-3 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Nyitott Pozíciók</span>
            <Layers className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-blue-400">
            {openPositionsCount} db
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Mean-Reversion & SL védett
          </div>
        </div>

        <div className="bg-[#050505] border border-[#1a1a1a] p-3 rounded-lg">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Worker Szál Latency</span>
            <Zap className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-400">
            &lt; 0.10 ms
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Zero GC Stalls
          </div>
        </div>
      </div>

      {/* Quant Worker Telemetry Stream */}
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 border-b border-[#151515] pb-2 mb-2">
          <span className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            WORKER THREAD TELEMETRIA (Z-SCORE & ORDER FLOW IMBALANCE)
          </span>
          <span className="text-[10px] text-slate-500">
            Trigger: |Z| &gt; 1.8 &amp; OFI Divergencia
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {assets.map(asset => {
            const metrics = lastMetrics[asset.symbol];
            const zScore = metrics?.zScore ?? 0;
            const ofi = metrics?.ofi ?? 0;
            const isSignal = Math.abs(zScore) > 1.8;

            return (
              <div key={asset.symbol} className={`p-2.5 rounded border text-xs ${
                isSignal
                  ? 'bg-blue-950/40 border-blue-500/50 text-blue-200 animate-pulse'
                  : 'bg-[#0a0a0a] border-[#1a1a1a] text-slate-300'
              }`}>
                <div className="flex items-center justify-between font-bold mb-1">
                  <span>{asset.symbol}</span>
                  <span className="text-slate-400">${asset.price.toFixed(asset.decimals)}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500">Z-Score: </span>
                    <span className={`font-bold ${
                      zScore > 1.8 ? 'text-rose-400' : zScore < -1.8 ? 'text-emerald-400' : 'text-slate-300'
                    }`}>
                      {zScore > 0 ? '+' : ''}{zScore.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">OFI: </span>
                    <span className={ofi >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {ofi >= 0 ? '+' : ''}{ofi.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Autonomous Positions */}
      {positions.length > 0 && (
        <div className="bg-[#050505] border border-[#1a1a1a] rounded-lg p-3">
          <div className="text-xs font-bold text-slate-400 border-b border-[#151515] pb-2 mb-2 flex items-center justify-between">
            <span>AKTÍV AUTONÓM POZÍCIÓK ({positions.length})</span>
            <span className="text-[10px] text-slate-500">Kelly Sized • Auto Mean-Reversion Target</span>
          </div>

          <div className="space-y-1.5">
            {positions.map((pos: any, idx: number) => (
              <div key={idx} className="flex flex-wrap items-center justify-between bg-[#0a0a0a] border border-[#1a1a1a] px-3 py-2 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    pos.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {pos.type}
                  </span>
                  <span className="font-bold text-white">{pos.symbol}</span>
                  <span className="text-slate-500">{pos.qty} db</span>
                </div>

                <div className="flex items-center gap-3 text-slate-400">
                  <span>Nyitó: <strong className="text-slate-200">${pos.entryPrice}</strong></span>
                  <span>Stop Loss: <strong className="text-rose-400">${pos.stopLoss?.toFixed(2)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

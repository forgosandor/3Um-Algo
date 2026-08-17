import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { TradeSignal } from '../types';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Cpu, 
  ArrowRight, 
  Percent, 
  Flame, 
  Coins, 
  ShieldAlert,
  Sliders
} from 'lucide-react';

export const TradePanel: React.FC = () => {
  const tradeSignals = useTradeStore(state => state.tradeSignals);
  const activeUser = useTradeStore(state => state.activeUser);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const executeSignalTrade = useTradeStore(state => state.executeSignalTrade);
  const executeBuy = useTradeStore(state => state.executeBuy);
  const executeSell = useTradeStore(state => state.executeSell);
  const fetchTradeSignals = useTradeStore(state => state.fetchTradeSignals);

  const [executingSignalId, setExecutingSignalId] = useState<string | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(0.05);

  const baseKey = selectedSymbol.replace('USDT', '').replace('USD', '').toLowerCase();
  let currentAssetBalance = 0;
  if (activeUser) {
    if (baseKey === 'btc') currentAssetBalance = activeUser.btcBalance || 0;
    else if (baseKey === 'eth') currentAssetBalance = activeUser.ethBalance || 0;
    else if (baseKey === 'sol') currentAssetBalance = activeUser.solBalance || 0;
    else if (baseKey === 'xau') currentAssetBalance = activeUser.xauBalance || 0;
    else if (baseKey === 'xag') currentAssetBalance = activeUser.xagBalance || 0;
  }

  const handleExecuteSignal = (sig: TradeSignal, index: number) => {
    const id = `${sig.symbol}_${sig.type}_${index}`;
    setExecutingSignalId(id);
    executeSignalTrade(sig, quickAmount);
    setTimeout(() => {
      setExecutingSignalId(null);
    }, 1200);
  };

  const handleQuickBuy = () => {
    executeBuy(selectedSymbol, quickAmount);
  };

  const handleQuickSell = () => {
    executeSell(selectedSymbol, quickAmount);
  };

  return (
    <div id="trade-whisperer-panel" className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3.5 font-mono text-xs shadow-2xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-950/60 border border-purple-800/60 rounded text-purple-400">
            <Cpu className="w-4 h-4 animate-pulse text-purple-300" />
          </div>
          <div>
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>TradeWhisperer™ Döntési Motor</span>
              <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-1.5 py-0.2 rounded font-mono uppercase">
                ÉLŐ (uWS)
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Momentum & Arany-Kripto Relatív Érték / Arbitrázs
            </div>
          </div>
        </div>

        <button
          id="refresh-signals-btn"
          onClick={() => fetchTradeSignals()}
          title="Jelek frissítése"
          className="p-1.5 bg-[#111111] hover:bg-[#1f1f1f] text-slate-400 hover:text-white border border-[#222222] rounded transition-all active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Quick Buy & Sell Execution Bar for Selected Symbol */}
      <div className="bg-[#060606] p-2.5 rounded-lg border border-[#161616] space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-semibold">Gyors Kereskedés: <strong className="text-white">{selectedSymbol}</strong></span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-slate-400">USD: <strong className="text-emerald-400">${activeUser?.usdBalance?.toLocaleString() || 0}</strong></span>
            <span className="text-slate-400">{baseKey.toUpperCase()}: <strong className="text-cyan-400">{currentAssetBalance}</strong></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#0d0d0d] px-2 py-1 rounded border border-[#222222]">
            <span className="text-[10px] text-slate-400">Méret:</span>
            <input
              type="number"
              step="0.01"
              min="0.001"
              value={quickAmount}
              onChange={(e) => setQuickAmount(parseFloat(e.target.value) || 0.01)}
              className="w-16 bg-transparent text-white font-bold text-center focus:outline-none"
            />
          </div>

          <button
            id="quick-buy-btn"
            onClick={handleQuickBuy}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-2 rounded text-[11px] flex items-center justify-center gap-1 shadow-md shadow-emerald-950/40 active:scale-95 transition-all"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>VÉTEL ({quickAmount})</span>
          </button>

          <button
            id="quick-sell-btn"
            onClick={handleQuickSell}
            className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-1.5 px-2 rounded text-[11px] flex items-center justify-center gap-1 shadow-md shadow-rose-950/40 active:scale-95 transition-all"
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>ELADÁS ({quickAmount})</span>
          </button>
        </div>
      </div>

      {/* Real-time Signals Stream */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-semibold">
          <span className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Aktív Piaci Jelek ({tradeSignals.length})
          </span>
          <span>Frissítés: 3 mp</span>
        </div>

        {tradeSignals.length === 0 ? (
          <div className="p-4 bg-[#050505] border border-[#141414] rounded-lg text-center text-slate-400 space-y-1">
            <div className="flex justify-center text-slate-400 mb-1">
              <Cpu className="w-5 h-5 animate-spin" />
            </div>
            <p className="font-semibold text-slate-300">Piacelemzés folyamatban...</p>
            <p className="text-[10px] text-slate-400">
              A TradeWhisperer momentum kitörésekre és Arany-BTC árfolyameltérésekre figyel.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {tradeSignals.map((sig, idx) => {
              const isExec = executingSignalId === `${sig.symbol}_${sig.type}_${idx}`;
              const isArbitrage = sig.type === 'ARBITRAGE';
              const isBuy = sig.action === 'BUY';

              return (
                <div
                  key={`${sig.symbol}_${sig.type}_${idx}`}
                  className={`p-2.5 rounded-lg border transition-all ${
                    isArbitrage
                      ? 'bg-amber-950/20 border-amber-800/50 hover:border-amber-700'
                      : isBuy
                      ? 'bg-emerald-950/20 border-emerald-800/50 hover:border-emerald-700'
                      : 'bg-rose-950/20 border-rose-800/50 hover:border-rose-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                        isBuy ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}>
                        {sig.action}
                      </span>
                      <span className="font-bold text-white text-xs">{sig.symbol}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        isArbitrage
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/60'
                          : 'bg-purple-900/60 text-purple-300 border border-purple-700/60'
                      }`}>
                        {isArbitrage ? 'ARANY-KRIPTO ARB' : 'MOMENTUM'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Bizalom:</span>
                      <span className={`font-extrabold text-xs ${
                        sig.confidence >= 80 ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {sig.confidence}%
                      </span>
                    </div>
                  </div>

                  {/* Signal Reason Message */}
                  <p className="text-[11px] text-slate-300 leading-snug mb-2 font-sans">
                    {sig.message}
                  </p>

                  {/* Metrics & Execute Button */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-[#222222]/60 gap-2">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {sig.metrics?.priceChange15s !== undefined && (
                        <span>15s: <strong className={sig.metrics.priceChange15s >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{sig.metrics.priceChange15s.toFixed(2)}%</strong></span>
                      )}
                      {sig.metrics?.xauBtcRatio !== undefined && (
                        <span>XAU/BTC: <strong className="text-amber-300">{sig.metrics.xauBtcRatio.toFixed(4)}</strong></span>
                      )}
                      {sig.metrics?.ethBtcRatio !== undefined && (
                        <span>ETH/BTC: <strong className="text-blue-300">{sig.metrics.ethBtcRatio.toFixed(4)}</strong></span>
                      )}
                    </div>

                    <button
                      id={`execute-signal-${idx}`}
                      onClick={() => handleExecuteSignal(sig, idx)}
                      disabled={isExec}
                      className={`py-1 px-2.5 rounded font-bold text-[10px] flex items-center gap-1 transition-all active:scale-95 ${
                        isExec
                          ? 'bg-blue-600 text-white animate-pulse'
                          : isBuy
                          ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600/90 hover:bg-rose-500 text-white'
                      }`}
                    >
                      {isExec ? (
                        <span>Végrehajtva...</span>
                      ) : (
                        <>
                          <span>Kereskedés</span>
                          <ArrowRight className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

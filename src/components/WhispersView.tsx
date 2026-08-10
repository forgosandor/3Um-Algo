import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Sparkles, ShieldCheck, CheckCircle2, TrendingUp, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';

export const WhispersView: React.FC = () => {
  const whispers = useTradeStore(state => state.whispers);
  const requestWhisper = useTradeStore(state => state.requestWhisper);
  const markWhispersRead = useTradeStore(state => state.markWhispersRead);
  const submitOrder = useTradeStore(state => state.submitOrder);
  const [filterType, setFilterType] = useState<string>('ALL');

  const filtered = filterType === 'ALL'
    ? whispers
    : whispers.filter(w => w.type === filterType);

  return (
    <div id="whispers-intelligence-center" className="p-4 max-w-[1400px] mx-auto space-y-4 font-mono text-xs">
      
      {/* Header & Controls */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-xl shadow-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-400">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>Suttogó Intelligencia Központ</span>
              <span className="text-xs bg-blue-950/80 text-blue-400 border border-blue-800/80 px-2 py-0.5 rounded uppercase font-bold">
                TradeWhisperer
              </span>
            </h2>
            <p className="text-slate-400 text-xs font-sans mt-0.5">
              Személyre szabott kereskedési mentorod: tanul a saját múltbeli kötéseidből és a piaci kontextusból.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="request-new-whisper-center-btn"
            onClick={requestWhisper}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Friss Suttogás Generálása</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-[#0a0a0a] p-1.5 rounded-xl border border-[#1a1a1a] font-bold">
        {[
          { key: 'ALL', label: 'Összes Suttogás' },
          { key: 'PRE_TRADE', label: 'Kötés Előtti Setups' },
          { key: 'IN_TRADE', label: 'Pozíció Menedzsment' },
          { key: 'POST_TRADE', label: 'Kötés Utáni Elemzés' },
          { key: 'RISK_ALERT', label: 'Kockázati Riasztások' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filterType === tab.key ? 'bg-blue-600 text-white font-extrabold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Whispers Feed Grid */}
      {filtered.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-12 text-center text-slate-500">
          Nincs megjeleníthető Suttogás ebben a kategóriában.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(w => (
            <div
              key={w.id}
              className={`bg-[#0a0a0a] border p-4 rounded-xl shadow-2xl flex flex-col justify-between transition-all hover:border-blue-700/60 ${
                w.type === 'RISK_ALERT' ? 'border-rose-900/80' : 'border-[#1a1a1a]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#1a1a1a]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#050505] text-blue-300 border border-[#222222]">
                      {w.type.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-white text-xs">{w.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans mb-3">
                  {w.message}
                </p>

                {w.historicalWinRatePct !== undefined && (
                  <div className="bg-[#050505] p-2 rounded-lg border border-[#1a1a1a] mb-3 space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Múltbeli Kötési Minta Sikeraránya:</span>
                      <span className="text-emerald-400 font-bold">{w.historicalWinRatePct}% ({w.historicalAvgR}R)</span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      💡 {w.matchReason}
                    </div>
                  </div>
                )}
              </div>

              {/* Action */}
              {w.suggestedAction && w.suggestedAction !== 'WAIT' && (
                <div className="pt-2 border-t border-[#1a1a1a] flex justify-end">
                  <button
                    onClick={() => {
                      if (w.suggestedAction === 'BUY' || w.suggestedAction === 'SELL') {
                        submitOrder({
                          side: w.suggestedAction,
                          type: 'MARKET',
                          price: 0,
                          amount: 0.1,
                          leverage: 10
                        });
                      }
                      markWhispersRead();
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <span>Végrehajtás: {w.suggestedAction}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

    </div>
  );
};

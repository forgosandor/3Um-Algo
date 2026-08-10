import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { BookOpen, Search, Filter, TrendingUp, TrendingDown, Clock, Activity, AlertCircle } from 'lucide-react';

export const TradeJournalView: React.FC = () => {
  const tradeLogs = useTradeStore(state => state.tradeLogs);
  const activeUser = useTradeStore(state => state.activeUser);
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');

  const filteredLogs = tradeLogs.filter(log => {
    const matchesUser = activeUser ? log.userId === activeUser.id : true;
    const matchesSearch = log.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.userStyle.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesOutcome = outcomeFilter === 'ALL'
      ? true
      : outcomeFilter === 'WIN' ? log.isProfitable : !log.isProfitable;

    return matchesUser && matchesSearch && matchesOutcome;
  });

  return (
    <div id="trade-journal-full-view" className="p-4 max-w-[1600px] mx-auto space-y-4 font-mono text-xs">
      
      {/* Header */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-xl shadow-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-800/60 text-amber-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Kontextuális Kötésnapló & Tanulási Adatbázis</h2>
            <p className="text-slate-400 text-xs font-sans mt-0.5">
              Minden kötésedhez rögzítettük a belépéskori piaci környezetet (RSI, Volatilitás, Orderbook Imbalance).
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Eszköz, stratégia keresése..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-[#050505] border border-[#1a1a1a] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:border-blue-500 focus:outline-none w-48"
            />
          </div>

          <div className="flex items-center bg-[#050505] p-1 rounded-lg border border-[#1a1a1a] font-bold">
            <button
              onClick={() => setOutcomeFilter('ALL')}
              className={`px-2.5 py-1 rounded transition-all ${outcomeFilter === 'ALL' ? 'bg-[#1a1a1a] text-white' : 'text-slate-400'}`}
            >
              Összes ({tradeLogs.length})
            </button>
            <button
              onClick={() => setOutcomeFilter('WIN')}
              className={`px-2.5 py-1 rounded transition-all ${outcomeFilter === 'WIN' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80' : 'text-slate-400'}`}
            >
              Nyertesek
            </button>
            <button
              onClick={() => setOutcomeFilter('LOSS')}
              className={`px-2.5 py-1 rounded transition-all ${outcomeFilter === 'LOSS' ? 'bg-rose-950/80 text-rose-400 border border-rose-800/80' : 'text-slate-400'}`}
            >
              Vesztesek
            </button>
          </div>

        </div>
      </div>

      {/* Trade Log Entries */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#050505] text-slate-400 border-b border-[#1a1a1a] text-[10px] uppercase font-bold">
                <th className="p-3">Eszköz / Irány</th>
                <th className="p-3">Stratégia</th>
                <th className="p-3">Belépő / Kilépő</th>
                <th className="p-3">P&L ($) / R:R</th>
                <th className="p-3">Belépéskori Kontextus (RSI / Vol / OB)</th>
                <th className="p-3">Időtartam</th>
                <th className="p-3">AI Mentor Megjegyzés</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nincs rögzített kötési bejegyzés.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-[#111111] transition-colors">
                    
                    <td className="p-3 font-bold">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                          log.side === 'LONG' || log.side === 'BUY'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-800/80'
                        }`}>
                          {log.side}
                        </span>
                        <span className="text-white font-extrabold">{log.symbol}</span>
                      </div>
                    </td>

                    <td className="p-3 text-slate-300">
                      <span className="bg-[#050505] border border-[#1a1a1a] px-2 py-0.5 rounded text-[10px]">
                        {log.userStyle}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="text-slate-200 font-bold">${log.entryPrice}</div>
                      <div className="text-slate-500 text-[10px]">Záró: ${log.exitPrice}</div>
                    </td>

                    <td className="p-3 font-bold">
                      <div className={log.isProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                        {log.isProfitable ? '+' : ''}${log.pnlAbs.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {log.pnlRatio >= 0 ? '+' : ''}{log.pnlRatio}R
                      </div>
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400">RSI: {log.contextAtEntry.rsi}</span>
                        <span className="text-slate-500">|</span>
                        <span className="text-purple-400">Vol: {log.contextAtEntry.volatility}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        OB Imbalance: {Math.round((log.contextAtEntry.obImbalance || 0) * 100)}% ({log.contextAtEntry.trend})
                      </div>
                    </td>

                    <td className="p-3 text-slate-400 text-[11px]">
                      {Math.round(log.durationMs / 60000)} perc
                    </td>

                    <td className="p-3 text-slate-300 text-[11px] font-sans">
                      {log.notes || 'Szabályzat szerinti végrehajtás'}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

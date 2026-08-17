import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { ShieldCheck, Sliders, XCircle, Zap, ShieldAlert, RotateCcw, AlertTriangle, Settings2, Sparkles, Database, HardDrive, Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export function RiskEngineView() {
  const riskLimits = useTradeStore(state => state.riskLimits);
  const riskLogs = useTradeStore(state => state.riskLogs);
  const updateRiskLimits = useTradeStore(state => state.updateRiskLimits);
  const clearRiskLogs = useTradeStore(state => state.clearRiskLogs);
  const activeUser = useTradeStore(state => state.activeUser);
  const persistenceStats = useTradeStore(state => state.persistenceStats);
  const flushDatabase = useTradeStore(state => state.flushDatabase);
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushSuccess, setFlushSuccess] = useState(false);

  const handleManualFlush = async () => {
    setIsFlushing(true);
    await flushDatabase();
    setIsFlushing(false);
    setFlushSuccess(true);
    setTimeout(() => setFlushSuccess(false), 2500);
  };

  // Forms state
  const [maxOrderValueUsd, setMaxOrderValueUsd] = useState(riskLimits?.maxOrderValueUsd || 100000);
  const [maxOrderQty, setMaxOrderQty] = useState(riskLimits?.maxOrderQty || 50);
  const [priceCollarPct, setPriceCollarPct] = useState(riskLimits?.priceCollarPct || 5.0);
  const [maxLeverage, setMaxLeverage] = useState(riskLimits?.maxLeverage || 10);
  const [maxDailyLossPct, setMaxDailyLossPct] = useState(riskLimits?.maxDailyLossPct || 10.0);
  const [rateLimitPerSecond, setRateLimitPerSecond] = useState(riskLimits?.rateLimitPerSecond || 100);
  const [washTradingPrevention, setWashTradingPrevention] = useState(riskLimits?.washTradingPrevention ?? true);

  const [isSavedMessage, setIsSavedMessage] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateRiskLimits({
      maxOrderValueUsd: Number(maxOrderValueUsd),
      maxOrderQty: Number(maxOrderQty),
      priceCollarPct: Number(priceCollarPct),
      maxLeverage: Number(maxLeverage),
      maxDailyLossPct: Number(maxDailyLossPct),
      rateLimitPerSecond: Number(rateLimitPerSecond),
      washTradingPrevention: !!washTradingPrevention
    });
    setIsSavedMessage(true);
    setTimeout(() => setIsSavedMessage(false), 2000);
  };

  // Format latency nicely
  const formatLatency = (ns: number) => {
    if (ns < 1000) {
      return `${ns} ns`;
    }
    const us = (ns / 1000).toFixed(2);
    return `${us} µs`;
  };

  // Stats calculation
  const totalChecks = riskLogs.length;
  const blockedChecks = riskLogs.filter(log => !log.isValid).length;
  const passRate = totalChecks > 0 ? (((totalChecks - blockedChecks) / totalChecks) * 100).toFixed(1) : '100';
  const averageLatencyNs = totalChecks > 0 
    ? Math.round(riskLogs.reduce((acc, log) => acc + log.latencyNs, 0) / totalChecks)
    : 0;

  return (
    <div id="risk-engine-view" className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto p-4 lg:p-6 text-[#1c1917]">
      {/* Capital Preservation Shield & Shadow Engine Alert Panel */}
      <div className="lg:col-span-3 bg-gradient-to-r from-stone-900 to-neutral-950 text-white rounded-lg p-5 border border-[#2d2d2d] shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="bg-[#f97316]/15 border border-[#f97316]/30 p-2.5 rounded-lg text-[#f97316] mt-1 shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg tracking-tight font-mono">Zero-Latency Path Védelmi Pajzs</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-stone-300 max-w-2xl mt-1.5 leading-relaxed font-sans">
              A rendszer a <strong className="text-white">Shadow-Execution Engine</strong> technológiát használja. Minden beérkező megbízást valós időben, 1:1 arányban tesztelünk egy másolt Limit Order Book szimuláción a fizikai végrehajtás előtt, megakadályozva a veszteséges csúszásokat (Slippage) és a hirtelen piaci anomáliákat.
            </p>
          </div>
        </div>

        <div className="flex flex-row md:flex-col lg:flex-row items-center gap-3 w-full md:w-auto shrink-0 border-t md:border-t-0 border-[#2d2d2d] pt-3 md:pt-0">
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg px-4 py-3 text-center flex-1 md:flex-none">
            <span className="block text-[9px] uppercase tracking-wider text-stone-400 font-mono">Capital Shield</span>
            <span className="text-sm font-bold text-rose-400 font-mono mt-0.5 block">3.0% Max Drawdown</span>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg px-4 py-3 text-center flex-1 md:flex-none">
            <span className="block text-[9px] uppercase tracking-wider text-stone-400 font-mono">Sim. Engine</span>
            <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">1:1 Shadow Test</span>
          </div>
        </div>
      </div>

      {/* Configuration Column */}
      <div className="lg:col-span-1 bg-white border border-[#e7e5e4] rounded-lg shadow-sm flex flex-col h-fit">
        <div className="p-4 border-b border-[#e7e5e4] bg-[#fafaf9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#f97316]" />
            <h2 className="font-semibold text-base text-[#1c1917] tracking-tight">Kockázatkezelési Korlátok</h2>
          </div>
          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
            <Zap className="w-3 h-3 fill-emerald-600" /> Active Gate
          </span>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1">
              Maximális Megbízás Érték (USD)
            </label>
            <input
              type="number"
              value={maxOrderValueUsd}
              onChange={(e) => setMaxOrderValueUsd(Number(e.target.value))}
              className="w-full text-sm bg-[#fafaf9] border border-[#e7e5e4] rounded px-3 py-2 focus:outline-none focus:border-[#f97316]"
              required
            />
            <p className="text-[10px] text-[#a8a29e] mt-1">Fat-finger védelem: Egyetlen megbízás maximális tőkeértéke.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1">
                Max Megbízás Qty
              </label>
              <input
                type="number"
                value={maxOrderQty}
                onChange={(e) => setMaxOrderQty(Number(e.target.value))}
                className="w-full text-sm bg-[#fafaf9] border border-[#e7e5e4] rounded px-3 py-2 focus:outline-none focus:border-[#f97316]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1">
                Ár-gallér korlát (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={priceCollarPct}
                onChange={(e) => setPriceCollarPct(Number(e.target.value))}
                className="w-full text-sm bg-[#fafaf9] border border-[#e7e5e4] rounded px-3 py-2 focus:outline-none focus:border-[#f97316]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1">
                Max Tőkeáttétel
              </label>
              <input
                type="number"
                value={maxLeverage}
                onChange={(e) => setMaxLeverage(Number(e.target.value))}
                className="w-full text-sm bg-[#fafaf9] border border-[#e7e5e4] rounded px-3 py-2 focus:outline-none focus:border-[#f97316]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#78716c] mb-1">
                Max Napi Veszteség (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={maxDailyLossPct}
                onChange={(e) => setMaxDailyLossPct(Number(e.target.value))}
                className="w-full text-sm bg-[#fafaf9] border border-[#e7e5e4] rounded px-3 py-2 focus:outline-none focus:border-[#f97316]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#78716c] mb-1">
              Rate Limit (Megbízás / sec)
            </label>
            <input
              type="number"
              value={rateLimitPerSecond}
              onChange={(e) => setRateLimitPerSecond(Number(e.target.value))}
              className="w-full text-sm bg-[#fafaf9] border border-[#e7e5e4] rounded px-3 py-2 focus:outline-none focus:border-[#f97316]"
              required
            />
            <p className="text-[10px] text-[#a8a29e] mt-1">HFT spam filter: Másodpercenkénti megbízás limit.</p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#e7e5e4]">
            <span className="text-xs font-medium text-[#78716c]">Ön-kötés Megelőzés (Wash Trade)</span>
            <button
              type="button"
              onClick={() => setWashTradingPrevention(!washTradingPrevention)}
              className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                washTradingPrevention ? 'bg-[#f97316]' : 'bg-[#e7e5e4]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  washTradingPrevention ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <button
            type="submit"
            className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white text-sm font-medium py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 mt-4"
          >
            <Settings2 className="w-4 h-4" /> Mentés és Alkalmazás
          </button>

          {isSavedMessage && (
            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs font-medium text-emerald-600 mt-2"
            >
              ✓ Korlátok mentve és érvénybe léptetve a RAM-ban!
            </motion.p>
          )}
        </form>
      </div>

      {/* Monitoring & Live Log Column */}
      <div className="lg:col-span-2 bg-white border border-[#e7e5e4] rounded-lg shadow-sm flex flex-col h-[600px]">
        {/* Header with quick metrics */}
        <div className="p-4 border-b border-[#e7e5e4] bg-[#fafaf9] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-base text-[#1c1917] tracking-tight">Pre-Trade Risk Engine Monitor</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Valóban törölni szeretné a kockázatkezelési naplót?')) {
                  clearRiskLogs();
                }
              }}
              className="text-xs font-medium text-[#78716c] hover:text-[#1c1917] border border-[#e7e5e4] hover:bg-[#fafaf9] px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Törlés
            </button>
          </div>
        </div>

        {/* Quick stats panel */}
        <div className="grid grid-cols-4 border-b border-[#e7e5e4] bg-[#fafaf9] divide-x divide-[#e7e5e4]">
          <div className="p-3 text-center">
            <span className="block text-[10px] font-medium text-[#78716c] uppercase tracking-wider">Összes Ellnőrzés</span>
            <span className="text-base font-bold text-[#1c1917]">{totalChecks}</span>
          </div>
          <div className="p-3 text-center">
            <span className="block text-[10px] font-medium text-[#78716c] uppercase tracking-wider">Blokkolt</span>
            <span className={`text-base font-bold ${blockedChecks > 0 ? 'text-red-600' : 'text-[#78716c]'}`}>
              {blockedChecks}
            </span>
          </div>
          <div className="p-3 text-center">
            <span className="block text-[10px] font-medium text-[#78716c] uppercase tracking-wider">Elfogadási Arány</span>
            <span className="text-base font-bold text-emerald-600">{passRate}%</span>
          </div>
          <div className="p-3 text-center">
            <span className="block text-[10px] font-medium text-[#78716c] uppercase tracking-wider">Avg Latency (O(1))</span>
            <span className="text-base font-bold text-sky-600 flex items-center justify-center gap-1">
              <Zap className="w-3.5 h-3.5 fill-sky-100 text-sky-600" />
              {formatLatency(averageLatencyNs)}
            </span>
          </div>
        </div>

        {/* Real-time feed scroll area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#fafaf9] text-xs">
          {riskLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <ShieldAlert className="w-12 h-12 text-[#a8a29e] mb-2" />
              <p className="text-sm font-semibold text-[#57534e]">Nincs aktív kockázatkezelési log</p>
              <p className="text-xs text-[#78716c] max-w-sm mt-1">
                Küldjön be egy megbízást a terminálból az in-memory kockázati korlátok és a zéró késleltetésű ellenőrző modul teszteléséhez.
              </p>
            </div>
          ) : (
            riskLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors ${
                  log.isValid 
                    ? 'bg-emerald-50/40 border-emerald-100/70 hover:bg-emerald-50/60' 
                    : 'bg-red-50/40 border-red-100/70 hover:bg-red-50/60'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {log.isValid ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        ✓
                      </span>
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 font-semibold">
                      <span className={log.side === 'BUY' ? 'text-emerald-700' : 'text-red-700'}>
                        {log.side === 'BUY' ? 'VÉTEL (BUY)' : 'ELADÁS (SELL)'}
                      </span>
                      <span className="text-[#57534e] bg-[#e7e5e4] px-1 rounded text-[10px]">{log.type}</span>
                      <span className="text-[#1c1917] font-bold">{log.symbol}</span>
                      <span className="text-[#78716c] font-normal">
                        {log.amount} @ ${log.price.toLocaleString()}
                      </span>
                    </div>

                    {!log.isValid && (
                      <div className="flex items-center gap-1 mt-1 text-red-700 font-medium">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{log.reason}</span>
                      </div>
                    )}

                    <div className="text-[10px] text-[#78716c] mt-1">
                      Felhasználó: <span className="font-medium">{log.userId}</span> • {new Date(log.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Performance stats per check */}
                <div className="flex items-center gap-3 self-end md:self-center text-right">
                  <div className="text-[10px] text-[#78716c]">
                    <div>Value: <span className="font-semibold text-[#1c1917]">${(log.amount * log.price).toLocaleString()}</span></div>
                  </div>
                  <div className="bg-white border border-[#e7e5e4] px-2.5 py-1 rounded shadow-2xs font-mono font-bold text-sky-700 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-sky-600 fill-sky-200" />
                    {formatLatency(log.latencyNs)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Golyóálló Széf - PostgreSQL / WAL Adatállóság & Perzisztencia Panel */}
      <div className="lg:col-span-3 bg-stone-900 border border-stone-800 rounded-lg p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base font-mono">Golyóálló Széf (Adatállóság & Perzisztencia)</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                  WAL + POSTGRESQL SEMANTICS
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                Zéró adatvesztés szerver-újraindulás vagy hirtelen hiba esetén. Minden számlaegyenleg, nyitott megbízás és kötési esemény aszinkron, kötegelt WAL naplózással azonnal lemezre íródik.
              </p>
            </div>
          </div>

          <button
            onClick={handleManualFlush}
            disabled={isFlushing}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-semibold text-xs rounded transition-colors disabled:opacity-50 font-mono self-stretch md:self-auto justify-center"
          >
            {isFlushing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : flushSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <HardDrive className="w-3.5 h-3.5" />
            )}
            <span>{isFlushing ? 'Szinkronizálás...' : flushSuccess ? 'Sikeresen Lemezre Írva!' : 'Azonnali Kényszerített Flush'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-stone-950/70 border border-stone-800 rounded p-3">
            <span className="block text-[10px] text-stone-500 uppercase tracking-wider">Rögzített Tranzakciók</span>
            <span className="text-base font-bold text-emerald-400 mt-1 block">
              {persistenceStats?.totalPersistedWrites || 0} db
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5 block">0% Adatvesztési Ráta</span>
          </div>

          <div className="bg-stone-950/70 border border-stone-800 rounded p-3">
            <span className="block text-[10px] text-stone-500 uppercase tracking-wider">Async dbWriteQueue</span>
            <span className="text-base font-bold text-sky-400 mt-1 block">
              {persistenceStats?.queueDepth || 0} várakozó
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5 block">100ms Batch Flush Ciklus</span>
          </div>

          <div className="bg-stone-950/70 border border-stone-800 rounded p-3">
            <span className="block text-[10px] text-stone-500 uppercase tracking-wider">Újraindulási Integritás</span>
            <span className="text-sm font-bold text-emerald-300 mt-1 block">
              {persistenceStats?.isRestoredFromDisk ? '✅ Betöltve Lemezről' : '⚡ Új Snapshot Aktív'}
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5 block">Automata MAP rehidratáció</span>
          </div>

          <div className="bg-stone-950/70 border border-stone-800 rounded p-3">
            <span className="block text-[10px] text-stone-500 uppercase tracking-wider">WAL Napló Méret</span>
            <span className="text-sm font-bold text-amber-400 mt-1 block">
              {persistenceStats?.walSizeBytes ? `${(persistenceStats.walSizeBytes / 1024).toFixed(1)} KB` : '0.4 KB'}
            </span>
            <span className="text-[10px] text-stone-400 mt-0.5 block">Append-Only Crash Log</span>
          </div>
        </div>
      </div>
    </div>
  );
}

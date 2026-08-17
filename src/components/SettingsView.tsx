import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Settings, ShieldCheck, Cpu, Sliders, CheckCircle2, Save, Key, RefreshCw } from 'lucide-react';

export const SettingsView: React.FC = () => {
  const activeUser = useTradeStore(state => state.activeUser);
  const updateUserSettings = useTradeStore(state => state.updateUserSettings);
  const triggerRetrain = useTradeStore(state => state.triggerRetrain);

  const [selectedAssets, setSelectedAssets] = useState<string[]>(activeUser?.preferredAssets || ['EUR/USD', 'BTC/USD']);
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(activeUser?.preferredTimeframes || ['5m', 'H1']);
  const [maxRiskPct, setMaxRiskPct] = useState<number>(activeUser?.maxRiskPerTradePct || activeUser?.maxRiskPct || 2.0);
  const [targetRR, setTargetRR] = useState<number>(activeUser?.targetRR || 2.0);
  const [primaryStyle, setPrimaryStyle] = useState<string>(activeUser?.tradingStyle || 'Trendkövető');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleAsset = (sym: string) => {
    setSelectedAssets(prev =>
      prev.includes(sym) ? prev.filter(a => a !== sym) : [...prev, sym]
    );
  };

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes(prev =>
      prev.includes(tf) ? prev.filter(t => t !== tf) : [...prev, tf]
    );
  };

  const handleSave = () => {
    updateUserSettings({
      preferredAssets: selectedAssets,
      preferredTimeframes: selectedTimeframes,
      maxRiskPerTradePct: maxRiskPct,
      targetRR: targetRR,
      tradingStyle: primaryStyle
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div id="settings-profile-view" className="p-4 max-w-[1200px] mx-auto space-y-4 font-mono text-xs">
      
      {/* Header */}
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-xl shadow-2xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/60 text-blue-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Személyre Szabott Adaptív Profil Beállítások</h2>
            <p className="text-slate-400 text-xs font-sans mt-0.5">
              Itt definiálhatod explicit preferenciáidat. Az AlgoMentor ezek és a múltbeli eredményeid alapján szűr.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-5 py-2 rounded-xl flex items-center gap-2 shadow-lg active:scale-95 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>Profil Mentése</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 p-3 rounded-xl flex items-center gap-2 font-bold animate-pulse">
          <CheckCircle2 className="w-5 h-5" />
          <span>Személyes profil beállítások sikeresen elmentve! Az AI Mentor frissítve az új paraméterekhez.</span>
        </div>
      )}

      {/* Main Settings Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Preferred Assets */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-xl shadow-2xl space-y-3">
          <h3 className="font-extrabold text-white border-b border-[#1a1a1a] pb-2">
            1. Kereskedett Eszközök (Focus Assets)
          </h3>
          <p className="text-slate-400 text-xs font-sans">
            Mely devizapárokra és kriptovalutákra szűkítse le a Suttogó a mély elemzést?
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {['EUR/USD', 'BTC/USD', 'ETH/USD', 'SOL/USD', 'XAU/USD (Arany)', 'XAG/USD (Ezüst)', 'GBP/USD'].map(sym => (
              <button
                key={sym}
                onClick={() => toggleAsset(sym)}
                className={`p-2.5 rounded-lg border font-bold flex items-center justify-between transition-all ${
                  selectedAssets.includes(sym)
                    ? 'bg-blue-950/60 border-blue-600 text-blue-300'
                    : 'bg-[#050505] border-[#1a1a1a] text-slate-500 hover:border-slate-700'
                }`}
              >
                <span>{sym}</span>
                {selectedAssets.includes(sym) && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* Timeframe & Style */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-xl shadow-2xl space-y-3">
          <h3 className="font-extrabold text-white border-b border-[#1a1a1a] pb-2">
            2. Idősíkok & Kereskedési Stílus
          </h3>

          <div>
            <label className="text-slate-400 text-xs block mb-1">Előnyben Részesített Idősíkok:</label>
            <div className="flex flex-wrap gap-2">
              {['5m', '15m', 'H1', 'H4'].map(tf => (
                <button
                  key={tf}
                  onClick={() => toggleTimeframe(tf)}
                  className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                    selectedTimeframes.includes(tf)
                      ? 'bg-blue-950/60 border-blue-600 text-blue-300'
                      : 'bg-[#050505] border-[#1a1a1a] text-slate-500'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <label className="text-slate-400 text-xs block mb-1">Fő Kereskedési Stílus:</label>
            <select
              value={primaryStyle}
              onChange={e => setPrimaryStyle(e.target.value)}
              className="bg-[#050505] border border-[#1a1a1a] text-white text-xs rounded-lg p-2.5 w-full focus:border-blue-500 focus:outline-none font-bold"
            >
              <option value="Trendkövető">Trendkövető (Trend Following)</option>
              <option value="Range Trade">Range Trade (Sávkereskedés)</option>
              <option value="Kitörés">Kitörés (Breakout)</option>
              <option value="Mean-Reversion">Mean-Reversion (Átlaghoz Visszatérés)</option>
            </select>
          </div>
        </div>

        {/* Risk Management Limits */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-xl shadow-2xl space-y-3">
          <h3 className="font-extrabold text-white border-b border-[#1a1a1a] pb-2">
            3. Kockázatkezelési Korlátok
          </h3>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Max % Tőke Kockáztatva Kötésenként:</span>
              <span className="text-blue-400 font-bold">{maxRiskPct}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={maxRiskPct}
              onChange={e => setMaxRiskPct(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-400">Cél Kockázat-Hozam Arány (R:R Ratio):</span>
              <span className="text-amber-400 font-bold">1 : {targetRR}</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="4.0"
              step="0.1"
              value={targetRR}
              onChange={e => setTargetRR(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        {/* Broker Connection & Machine Learning Sync */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-4 rounded-xl shadow-2xl space-y-3">
          <h3 className="font-extrabold text-white border-b border-[#1a1a1a] pb-2 flex items-center justify-between">
            <span>4. Bróker Kapcsolat & ML Tanuló Motor</span>
            <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded font-bold">
              Szigorúan Olvasási Jogok
            </span>
          </h3>

          <div className="bg-[#050505] p-3 rounded-lg border border-[#1a1a1a] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Kapcsolat Állapota:</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Binance / Oanda Read-Only API Csatlakoztatva</span>
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              🔒 Az AlgoMentor közvetlenül az API-n keresztül naplózza a végrehajtott kötések tényeit és a piaci kontextust. Harmadik félnek nem továbbít adatokat.
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={triggerRetrain}
              className="bg-[#111111] hover:bg-[#1a1a1a] text-slate-200 border border-[#222222] font-bold text-xs px-4 py-2 rounded-lg flex items-center justify-center gap-2 w-full transition-all"
            >
              <Cpu className="w-4 h-4 text-blue-400" />
              <span>Scikit-learn Döntési Fa Újratanítása (Kézi Trigger)</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};

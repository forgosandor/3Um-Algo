import React from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Activity, Zap, Volume2, VolumeX, Sparkles, BookOpen, BarChart3, UserCheck, Shield, Layers, Bot, Cpu } from 'lucide-react';

export const Navbar: React.FC = () => {
  const activeUser = useTradeStore(state => state.activeUser);
  const users = useTradeStore(state => state.users);
  const switchUser = useTradeStore(state => state.switchUser);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const setSymbol = useTradeStore(state => state.setSymbol);
  const latencyMs = useTradeStore(state => state.latencyMs);
  const isConnected = useTradeStore(state => state.isConnected);
  const soundEnabled = useTradeStore(state => state.soundEnabled);
  const toggleSound = useTradeStore(state => state.toggleSound);
  const activeTab = useTradeStore(state => state.activeTab);
  const setTab = useTradeStore(state => state.setTab);
  const unreadWhispersCount = useTradeStore(state => state.unreadWhispersCount);
  const requestWhisper = useTradeStore(state => state.requestWhisper);

  const isAiStandbyActive = useTradeStore(state => state.isAiStandbyActive);
  const aiStandbyReason = useTradeStore(state => state.aiStandbyReason);
  const toggleAiStandby = useTradeStore(state => state.toggleAiStandby);

  const autonomousStatus = useTradeStore(state => state.autonomousStatus);
  const toggleAutonomousEngine = useTradeStore(state => state.toggleAutonomousEngine);
  const isAutoRunning = autonomousStatus?.isRunning ?? false;

  const currentAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  return (
    <header id="main-navbar" className="bg-[#0a0a0a] border-b border-[#1a1a1a] text-[#e0e0e0] sticky top-0 z-50 px-4 py-2.5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 max-w-[1800px] mx-auto">
        
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 border border-blue-500/30 p-2 rounded-lg">
            <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">
                AlgoMentor
              </span>
              <span className="bg-blue-950/80 text-blue-400 border border-blue-800/60 text-[10px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                TradeWhisperer
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono hidden sm:block">
              In-Memory LOB Engine • Zero-Latency Path
            </p>
          </div>
        </div>

        {/* Live Latency & Execution Engine Badge */}
        <div className="flex items-center gap-2 bg-[#050505] border border-[#1a1a1a] px-3 py-1.5 rounded-md text-xs font-mono">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
          <span className="text-slate-500">WebSocket:</span>
          <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
          <span className="text-slate-700">|</span>
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-500">LOB Match:</span>
          <span className="text-amber-400 font-bold">{latencyMs.toFixed(2)} ms</span>
        </div>

        {/* Symbol Selector Pill */}
        <div className="flex items-center gap-1.5 bg-[#050505] p-1 rounded-lg border border-[#1a1a1a]">
          {assets.map(asset => {
            const isSelected = asset.symbol === selectedSymbol;
            return (
              <button
                key={asset.symbol}
                id={`symbol-btn-${asset.symbol}`}
                onClick={() => setSymbol(asset.symbol)}
                className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#111111]'
                }`}
              >
                <span>{asset.symbol}</span>
                <span className={`text-[10px] ${asset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Multi-User Switcher & Autonomous Bot Toggle */}
        <div className="flex items-center gap-2">
          {/* Autonomous Recursive Bot Button */}
          <button
            id="autonomous-bot-toggle"
            onClick={toggleAutonomousEngine}
            title="Autonóm Rekurzív Kereskedő Motor (Z-Score + Order Flow Imbalance)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all border ${
              isAutoRunning
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-950/50 animate-pulse'
                : 'bg-[#050505] border-[#222] text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Cpu className={`w-3.5 h-3.5 ${isAutoRunning ? 'text-emerald-400 animate-spin' : 'text-slate-400'}`} />
            <span>Autonóm Bot</span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
              isAutoRunning ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'
            }`}>
              {isAutoRunning ? 'LIVE' : 'OFF'}
            </span>
          </button>

          {/* AI Standby Button */}
          <button
            id="ai-standby-router-toggle"
            onClick={toggleAiStandby}
            title="AI Standby Auto-Router: A piacmérések alapján automatikusan választja ki az ideális profil-stratégiát"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all border ${
              isAiStandbyActive
                ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-lg shadow-purple-950/50 animate-pulse'
                : 'bg-[#050505] border-[#222] text-slate-400 hover:text-white hover:border-slate-700'
            }`}
          >
            <Bot className={`w-3.5 h-3.5 ${isAiStandbyActive ? 'text-purple-400 animate-spin' : 'text-slate-400'}`} />
            <span>AI Standby</span>
            <span className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
              isAiStandbyActive ? 'bg-purple-500 text-black' : 'bg-slate-800 text-slate-400'
            }`}>
              {isAiStandbyActive ? 'AUTO' : 'MANUAL'}
            </span>
          </button>

          <label className="text-xs text-slate-500 font-mono hidden md:inline">Profil:</label>
          <select
            id="user-profile-select"
            value={activeUser?.id || ''}
            onChange={(e) => switchUser(e.target.value)}
            disabled={isAiStandbyActive}
            className={`bg-[#050505] border border-[#222222] text-xs font-mono text-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500 ${
              isAiStandbyActive ? 'opacity-70 cursor-not-allowed border-purple-500/30' : ''
            }`}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.tradingStyle})
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#050505] p-1 rounded-lg border border-[#1a1a1a] text-xs font-medium">
          <button
            id="nav-tab-terminal"
            onClick={() => setTab('terminal')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'terminal' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span>Terminal</span>
          </button>

          <button
            id="nav-tab-orderbook"
            onClick={() => setTab('orderbook')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'orderbook' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Order Book Depth</span>
          </button>

          <button
            id="nav-tab-whispers"
            onClick={() => setTab('whispers')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 relative ${
              activeTab === 'whispers' ? 'bg-blue-950/70 text-blue-300 font-bold border border-blue-800/60' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>Suttogó</span>
            {unreadWhispersCount > 0 && (
              <span className="bg-blue-500 text-white font-extrabold text-[10px] px-1.5 py-0.2 rounded-full animate-bounce">
                {unreadWhispersCount}
              </span>
            )}
          </button>

          <button
            id="nav-tab-journal"
            onClick={() => setTab('journal')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'journal' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>Kötésnapló</span>
          </button>

          <button
            id="nav-tab-analytics"
            onClick={() => setTab('analytics')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'analytics' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Analitika</span>
          </button>

          <button
            id="nav-tab-profile"
            onClick={() => setTab('profile')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'profile' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Profil & Szabályzat</span>
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            id="trigger-ai-whisper-btn"
            onClick={requestWhisper}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-md flex items-center gap-1.5 active:scale-95 transition-all"
            title="Kérj azonnali Suttogó tanácsot"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span className="hidden sm:inline">AI Suttogás</span>
          </button>

          <button
            id="sound-toggle-btn"
            onClick={toggleSound}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-[#050505] border border-[#1a1a1a] rounded-md"
            title={soundEnabled ? 'Hangjelzés Be' : 'Hangjelzés Ki'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>

      </div>

      {/* AI Standby Live Banner */}
      {isAiStandbyActive && (
        <div className="mt-2 pt-2 border-t border-purple-500/20 flex items-center justify-between text-xs font-mono bg-purple-950/20 px-3 py-1.5 rounded-lg border border-purple-500/30 text-purple-200">
          <div className="flex items-center gap-2 overflow-hidden">
            <Cpu className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
            <span className="font-bold text-purple-300 shrink-0">AI AUTO-STANDBY:</span>
            <span className="text-slate-200 truncate">{aiStandbyReason || 'Aktiválva. Piacmérések folyamatos elemzése és automatikus profil-választás...'}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded border border-purple-500/40 font-bold">
              AKTÍV: {activeUser?.name}
            </span>
          </div>
        </div>
      )}
    </header>
  );
};

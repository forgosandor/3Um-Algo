import React from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Activity, Zap, Volume2, VolumeX, Sparkles, BookOpen, BarChart3, UserCheck, Shield, Layers, Bot, Cpu, History } from 'lucide-react';

export const Navbar: React.FC = () => {
  const activeUser = useTradeStore(state => state.activeUser);
  const users = useTradeStore(state => state.users);
  const switchUser = useTradeStore(state => state.switchUser);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const setSymbol = useTradeStore(state => state.setSymbol);
  const latencyMs = useTradeStore(state => state.latencyMs);
  const isConnected = useTradeStore(state => state.isConnected);
  const binanceConnected = useTradeStore(state => state.binanceConnected);
  const binanceJitter = useTradeStore(state => state.binanceJitter);
  const kucoinConnected = useTradeStore(state => state.kucoinConnected);
  const kucoinJitter = useTradeStore(state => state.kucoinJitter);
  const activeFeedSource = useTradeStore(state => state.activeFeedSource);
  const setActiveFeedSource = useTradeStore(state => state.setActiveFeedSource);
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

  const systemState = useTradeStore(state => state.systemState);
  const systemStatus = systemState?.status || 'OK';
  const systemStatusLabel = systemStatus === 'HALT' ? 'HALT (Biztonsági Leállítás)' : systemStatus === 'WARN' ? 'WARN (Magas Késleltetés)' : 'OK (Kiváló Stabilitás)';
  const systemStatusExplanation = systemStatus === 'HALT'
    ? 'Hálózati jitter kritikus szinten (>500ms). A Circuit Breaker aktiválódott, az éles végrehajtás szünetel.'
    : systemStatus === 'WARN'
      ? 'A hálózati jitter megnőtt (>200ms). A végrehajtás folytatódik, de óvatosság ajánlott.'
      : 'A hálózati kapcsolat stabil, a Pre-Trade Risk Engine ultra-gyors mikroszekundumos ellenőrzést biztosít.';

  const navbarBorderClass = systemStatus === 'HALT'
    ? 'border-b-2 border-rose-500/60 shadow-[0_4px_20px_rgba(239,68,68,0.15)]'
    : systemStatus === 'WARN'
      ? 'border-b-2 border-amber-500/60 shadow-[0_4px_20px_rgba(245,158,11,0.15)]'
      : 'border-b border-[#1a1a1a]';

  const currentAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  return (
    <header id="main-navbar" className={`bg-[#0a0a0a] text-[#e0e0e0] sticky top-0 z-50 px-4 py-2.5 transition-all duration-300 ${navbarBorderClass}`}>
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
        <div className="flex items-center gap-2.5 bg-[#050505] border border-[#1a1a1a] px-3 py-1 rounded-md text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
            <span className="text-slate-500 text-[10px] hidden lg:inline">WS:</span>
            <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
              {isConnected ? 'LIVE' : 'OFF'}
            </span>
          </div>
          
          <span className="text-slate-800">|</span>

          {/* Binance Bridge Selection */}
          <button
            onClick={() => setActiveFeedSource('binance')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all border ${
              activeFeedSource === 'binance'
                ? 'bg-blue-950/50 border-blue-500/50 text-white font-bold'
                : 'border-transparent text-slate-400 hover:bg-[#111] hover:text-slate-200'
            }`}
            title="Kattints a Binance Élő Feed aktiválásához"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${binanceConnected ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[10px]">BINANCE</span>
            {binanceConnected && binanceJitter && binanceJitter[selectedSymbol] && (
              <span className="text-[10px] text-blue-300 font-extrabold ml-1 bg-blue-900/30 px-1 rounded">
                {binanceJitter[selectedSymbol].currentJitterMs}ms
              </span>
            )}
          </button>

          {/* KuCoin Bridge Selection */}
          <button
            onClick={() => setActiveFeedSource('kucoin')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all border ${
              activeFeedSource === 'kucoin'
                ? 'bg-orange-950/50 border-orange-500/50 text-white font-bold'
                : 'border-transparent text-slate-400 hover:bg-[#111] hover:text-slate-200'
            }`}
            title="Kattints a KuCoin Élő Feed aktiválásához"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${kucoinConnected ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[10px]">KUCOIN</span>
            {kucoinConnected && kucoinJitter && kucoinJitter[selectedSymbol] && (
              <span className="text-[10px] text-orange-300 font-extrabold ml-1 bg-orange-900/30 px-1 rounded">
                {kucoinJitter[selectedSymbol].currentJitterMs}ms
              </span>
            )}
          </button>
          
          <span className="text-slate-800">|</span>

          {/* Circuit Breaker Shield Guard */}
          <div 
            className="group relative flex items-center gap-1.5 px-2 py-1 rounded cursor-help border border-transparent hover:bg-[#111]"
          >
            <div className="w-2 h-2 rounded-full relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                systemStatus === 'HALT' ? 'bg-rose-500' : systemStatus === 'WARN' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                systemStatus === 'HALT' ? 'bg-rose-500' : systemStatus === 'WARN' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} />
            </div>
            <span className={`text-[10px] font-bold tracking-wider ${
              systemStatus === 'HALT' ? 'text-rose-400' : systemStatus === 'WARN' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              GUARD: {systemStatus}
            </span>

            {/* Tooltip */}
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block z-50 w-72 bg-[#0e0e0e] border border-[#1d1d1d] p-3 rounded-lg shadow-2xl text-left pointer-events-none">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                Rendszer Védelmi Pajzs (Circuit Breaker)
              </div>
              <div className={`text-xs font-bold font-mono mb-1.5 flex items-center gap-1.5 ${
                systemStatus === 'HALT' ? 'text-rose-400' : systemStatus === 'WARN' ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                <span>Állapot:</span>
                <span>{systemStatusLabel}</span>
              </div>
              <div className="text-[11px] text-slate-300 font-sans leading-relaxed">
                {systemStatusExplanation}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-2 pt-2 border-t border-[#1d1d1d] flex justify-between">
                <span>Aktív Jitter:</span>
                <span className="font-bold text-white">
                  {systemState?.latency !== undefined ? `${systemState.latency} ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <span className="text-slate-800">|</span>

          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-amber-400 font-bold">{latencyMs.toFixed(2)} ms</span>
          </div>
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

          <button
            id="nav-tab-backtest"
            onClick={() => setTab('backtest')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'backtest' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5 text-orange-400" />
            <span>Visszateszt</span>
          </button>

          <button
            id="nav-tab-risk"
            onClick={() => setTab('risk')}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'risk' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            <span>Kockázati Gát</span>
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

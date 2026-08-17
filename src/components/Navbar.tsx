import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Activity, Zap, Volume2, VolumeX, Sparkles, BookOpen, BarChart3, UserCheck, Shield, Layers, Bot, Cpu, History, AlertTriangle, Settings, Sliders, Waves, Key } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
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

  const marketMakerStatus = useTradeStore(state => state.marketMakerStatus);
  const toggleMarketMaker = useTradeStore(state => state.toggleMarketMaker);
  const updateMarketMakerConfig = useTradeStore(state => state.updateMarketMakerConfig);

  const latencyAlertThresholdMs = useTradeStore(state => state.latencyAlertThresholdMs);
  const jitterAlertThresholdMs = useTradeStore(state => state.jitterAlertThresholdMs);
  const setLatencyAlertThresholdMs = useTradeStore(state => state.setLatencyAlertThresholdMs);
  const setJitterAlertThresholdMs = useTradeStore(state => state.setJitterAlertThresholdMs);

  const systemState = useTradeStore(state => state.systemState);
  const rawSystemStatus = systemState?.status || 'OK';
  const currentJitter = (activeFeedSource === 'binance' ? binanceJitter?.[selectedSymbol]?.currentJitterMs : kucoinJitter?.[selectedSymbol]?.currentJitterMs) || 0;
  const isLatencyExceeded = latencyMs > latencyAlertThresholdMs;
  const isJitterExceeded = currentJitter > jitterAlertThresholdMs;
  const isSafetyAlert = isLatencyExceeded || isJitterExceeded || rawSystemStatus === 'HALT';

  const systemStatusLabel = isSafetyAlert
    ? 'SAFETY ALERT (Kritikus Küszöb Átlépve!)'
    : rawSystemStatus === 'WARN'
      ? 'WARN (Magas Késleltetés)'
      : 'OK (Kiváló Stabilitás)';

  const systemStatusExplanation = isSafetyAlert
    ? `Rendszer riasztás: Késleltetés (${latencyMs.toFixed(2)}ms / küszöb ${latencyAlertThresholdMs}ms) vagy Jitter (${currentJitter}ms / küszöb ${jitterAlertThresholdMs}ms) meghaladta a biztonsági határt!`
    : rawSystemStatus === 'WARN'
      ? 'A hálózati jitter megnőtt (>200ms). A végrehajtás folytatódik, de óvatosság ajánlott.'
      : 'A hálózati kapcsolat stabil, a Pre-Trade Risk Engine ultra-gyors mikroszekundumos ellenőrzést biztosít.';

  const navbarBorderClass = isSafetyAlert
    ? 'bg-rose-950/90 border-b-4 border-rose-500 shadow-[0_4px_30px_rgba(244,63,94,0.5)] animate-pulse'
    : rawSystemStatus === 'WARN'
      ? 'border-b-2 border-amber-500/60 shadow-[0_4px_20px_rgba(245,158,11,0.15)] bg-[#0a0a0a]'
      : 'border-b border-[#1a1a1a] bg-[#0a0a0a]';

  const currentAsset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  return (
    <header id="main-navbar" className={`bg-[#080808] text-[#e0e0e0] relative z-20 transition-all duration-300 ${navbarBorderClass}`}>
      {/* Tier 1: Main Control & Telemetry Bar */}
      <div className="border-b border-[#151515] px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-[1900px] mx-auto">
          {/* Brand & System Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600/20 border border-blue-500/30 p-1.5 rounded-lg">
                <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-white">
                    AlgoMentor
                  </span>
                  <span className="bg-blue-950/80 text-blue-400 border border-blue-800/60 text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase">
                    TradeWhisperer
                  </span>
                </div>
              </div>
            </div>

            {/* Telemetry Pill */}
            <div className="hidden sm:flex items-center gap-2 bg-[#040404] border border-[#1a1a1a] px-2.5 py-1 rounded-md text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                <span className="text-slate-500 text-[10px] hidden md:inline">WS:</span>
                <span className={isConnected ? 'text-emerald-400 font-bold text-[10px]' : 'text-rose-400 text-[10px]'}>
                  {isConnected ? 'LIVE' : 'OFF'}
                </span>
              </div>
              
              <span className="text-slate-800">|</span>

              {/* Binance Bridge Selection */}
              <button
                onClick={() => setActiveFeedSource('binance')}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all border text-[10px] ${
                  activeFeedSource === 'binance'
                    ? 'bg-blue-950/50 border-blue-500/50 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:bg-[#111] hover:text-slate-200'
                }`}
                title="Kattints a Binance Élő Feed aktiválásához"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${binanceConnected ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'}`} />
                <span>BINANCE</span>
                {binanceConnected && binanceJitter && binanceJitter[selectedSymbol] && (
                  <span className="text-[9px] text-blue-300 font-extrabold ml-0.5 bg-blue-900/30 px-1 rounded">
                    {binanceJitter[selectedSymbol].currentJitterMs}ms
                  </span>
                )}
              </button>

              {/* KuCoin Bridge Selection */}
              <button
                onClick={() => setActiveFeedSource('kucoin')}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all border text-[10px] ${
                  activeFeedSource === 'kucoin'
                    ? 'bg-orange-950/50 border-orange-500/50 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:bg-[#111] hover:text-slate-200'
                }`}
                title="Kattints a KuCoin Élő Feed aktiválásához"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${kucoinConnected ? 'bg-orange-400 animate-pulse' : 'bg-slate-600'}`} />
                <span>KUCOIN</span>
                {kucoinConnected && kucoinJitter && kucoinJitter[selectedSymbol] && (
                  <span className="text-[9px] text-orange-300 font-extrabold ml-0.5 bg-orange-900/30 px-1 rounded">
                    {kucoinJitter[selectedSymbol].currentJitterMs}ms
                  </span>
                )}
              </button>
              
              <span className="text-slate-800">|</span>

              {/* Circuit Breaker Shield Guard */}
              <div 
                className="group relative flex items-center gap-1 px-1 py-0.5 rounded cursor-help border border-transparent hover:bg-[#111]"
              >
                <div className="w-1.5 h-1.5 rounded-full relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    rawSystemStatus === 'HALT' ? 'bg-rose-500' : rawSystemStatus === 'WARN' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    rawSystemStatus === 'HALT' ? 'bg-rose-500' : rawSystemStatus === 'WARN' ? 'bg-amber-500' : 'bg-emerald-500'
                  }`} />
                </div>
                <span className={`text-[10px] font-bold tracking-wider ${
                  rawSystemStatus === 'HALT' ? 'text-rose-400' : rawSystemStatus === 'WARN' ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  GUARD: {rawSystemStatus}
                </span>

                {/* Tooltip */}
                <div className="absolute top-full left-0 mt-2 hidden group-hover:block z-50 w-72 bg-[#0e0e0e] border border-[#1d1d1d] p-3 rounded-lg shadow-2xl text-left pointer-events-none">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 font-mono">
                    Rendszer Védelmi Pajzs (Circuit Breaker)
                  </div>
                  <div className={`text-xs font-bold font-mono mb-1.5 flex items-center gap-1.5 ${
                    rawSystemStatus === 'HALT' ? 'text-rose-400' : rawSystemStatus === 'WARN' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    <span>Állapot:</span>
                    <span>{systemStatusLabel}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 font-sans leading-relaxed">
                    {systemStatusExplanation}
                  </div>
                </div>
              </div>

              <span className="text-slate-800">|</span>

              {/* Latency */}
              <div className="flex items-center gap-1">
                <Zap className={`w-3 h-3 ${isLatencyExceeded ? 'text-rose-400 animate-bounce' : 'text-amber-400'} shrink-0`} />
                <span className={`font-bold font-mono text-[11px] ${isLatencyExceeded ? 'text-rose-400 font-extrabold' : 'text-amber-400'}`}>
                  {latencyMs.toFixed(2)} ms
                </span>
                {isSafetyAlert && (
                  <span className="bg-rose-600 text-white font-extrabold text-[8px] px-1 py-0.5 rounded tracking-wider uppercase animate-pulse flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    LIMIT
                  </span>
                )}
              </div>

              <span className="text-slate-800">|</span>

              {/* Threshold Settings Trigger */}
              <button
                id="threshold-settings-btn"
                onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-[#151515] transition-all flex items-center gap-1 text-[9px] font-mono border border-[#222]"
                title="Késleltetési & Jitter Biztonsági Küszöbök Beállítása"
              >
                <Sliders className="w-3 h-3 text-cyan-400" />
                <span className="hidden lg:inline">KÜSZÖBÖK</span>
              </button>
            </div>
          </div>

          {/* Right Controls: Market Maker, Bot, Profile, Whisper Button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Market Maker Button */}
            <button
              id="market-maker-toggle"
              onClick={() => toggleMarketMaker()}
              title="Automatizált Piaccsináló (Market Maker) modul"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all border ${
                marketMakerStatus?.enabled
                  ? 'bg-cyan-600/20 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-950/50'
                  : 'bg-[#040404] border-[#222] text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Waves className={`w-3 h-3 ${marketMakerStatus?.enabled ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Market Maker</span>
              <span className={`text-[8px] px-1 rounded font-bold uppercase ${
                marketMakerStatus?.enabled ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'
              }`}>
                {marketMakerStatus?.enabled ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Autonomous Bot Button */}
            <button
              id="autonomous-bot-toggle"
              onClick={toggleAutonomousEngine}
              title="Autonóm Rekurzív Kereskedő Motor (Z-Score + OFI)"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all border ${
                isAutoRunning
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-950/50'
                  : 'bg-[#040404] border-[#222] text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Cpu className={`w-3 h-3 ${isAutoRunning ? 'text-emerald-400 animate-spin' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">Autonóm Bot</span>
              <span className={`text-[8px] px-1 rounded font-bold uppercase ${
                isAutoRunning ? 'bg-emerald-500 text-black' : 'bg-slate-800 text-slate-400'
              }`}>
                {isAutoRunning ? 'LIVE' : 'OFF'}
              </span>
            </button>

            {/* AI Standby Button */}
            <button
              id="ai-standby-router-toggle"
              onClick={toggleAiStandby}
              title="AI Standby Auto-Router"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all border ${
                isAiStandbyActive
                  ? 'bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-md shadow-purple-950/50'
                  : 'bg-[#040404] border-[#222] text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <Bot className={`w-3 h-3 ${isAiStandbyActive ? 'text-purple-400 animate-spin' : 'text-slate-400'}`} />
              <span className="hidden md:inline">AI Standby</span>
              <span className={`text-[8px] px-1 rounded font-bold uppercase ${
                isAiStandbyActive ? 'bg-purple-500 text-black' : 'bg-slate-800 text-slate-400'
              }`}>
                {isAiStandbyActive ? 'AUTO' : 'OFF'}
              </span>
            </button>

            {/* Profile Dropdown */}
            <div className="flex items-center gap-1">
              <label className="text-[10px] text-slate-500 font-mono hidden xl:inline">Profil:</label>
              <select
                id="user-profile-select"
                value={activeUser?.id || ''}
                onChange={(e) => switchUser(e.target.value)}
                disabled={isAiStandbyActive}
                className={`bg-[#040404] border border-[#222222] text-xs font-mono text-slate-200 rounded px-2 py-1 focus:outline-none focus:border-blue-500 ${
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

            {/* Suttogás & Hang */}
            <button
              id="trigger-ai-whisper-btn"
              onClick={requestWhisper}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-2.5 py-1 rounded shadow-md flex items-center gap-1 active:scale-95 transition-all"
              title="Kérj azonnali Suttogó tanácsot"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              <span className="hidden sm:inline">Suttogás</span>
            </button>

            <button
              id="sound-toggle-btn"
              onClick={toggleSound}
              className="p-1 text-slate-400 hover:text-slate-200 bg-[#040404] border border-[#1a1a1a] rounded"
              title={soundEnabled ? 'Hangjelzés Be' : 'Hangjelzés Ki'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>
        </div>
      </div>

      {/* Tier 2: Asset Ticker Pill & Main View Navigation */}
      <div className="px-4 py-1.5 bg-[#050505] border-b border-[#141414]">
        <div className="flex flex-wrap items-center justify-between gap-2 max-w-[1900px] mx-auto">
          {/* Asset Ticker Bar */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
            {assets.map(asset => {
              const isSelected = asset.symbol === selectedSymbol;
              return (
                <button
                  key={asset.symbol}
                  id={`symbol-btn-${asset.symbol}`}
                  onClick={() => setSymbol(asset.symbol)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#111111] bg-[#090909] border border-[#1a1a1a]'
                  }`}
                >
                  <span>{asset.symbol}</span>
                  <span className={`text-[9px] ${asset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-[#090909] p-0.5 rounded-lg border border-[#1a1a1a] text-xs font-medium overflow-x-auto no-scrollbar">
            <button
              id="nav-tab-terminal"
              onClick={() => setTab('terminal')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'terminal' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3 h-3 text-blue-400" />
              <span>Terminal</span>
            </button>

            <button
              id="nav-tab-orderbook"
              onClick={() => setTab('orderbook')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'orderbook' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>Könyvmélység</span>
            </button>

            <button
              id="nav-tab-whispers"
              onClick={() => setTab('whispers')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] relative ${
                activeTab === 'whispers' ? 'bg-blue-950/70 text-blue-300 font-bold border border-blue-800/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Suttogó</span>
              {unreadWhispersCount > 0 && (
                <span className="bg-blue-500 text-white font-extrabold text-[9px] px-1 rounded-full">
                  {unreadWhispersCount}
                </span>
              )}
            </button>

            <button
              id="nav-tab-journal"
              onClick={() => setTab('journal')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'journal' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3 h-3 text-amber-400" />
              <span>Kötésnapló</span>
            </button>

            <button
              id="nav-tab-analytics"
              onClick={() => setTab('analytics')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'analytics' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3 h-3 text-emerald-400" />
              <span>Analitika</span>
            </button>

            <button
              id="nav-tab-profile"
              onClick={() => setTab('profile')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'profile' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3 h-3 text-purple-400" />
              <span>Profil</span>
            </button>

            <button
              id="nav-tab-backtest"
              onClick={() => setTab('backtest')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'backtest' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3 h-3 text-orange-400" />
              <span>Visszateszt</span>
            </button>

            <button
              id="nav-tab-risk"
              onClick={() => setTab('risk')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'risk' ? 'bg-[#1a1a1a] text-white font-bold border border-[#2a2a2a]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3 h-3 text-rose-400" />
              <span>Kockázat</span>
            </button>

            <button
              id="nav-tab-ai-diagnostics"
              onClick={() => setTab('ai-diagnostics')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'ai-diagnostics'
                  ? 'bg-[#112211] text-[#00FF41] font-bold border border-[#004411]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3 h-3 text-[#00FF41]" />
              <span>AI Diagnosztika</span>
            </button>

            <button
              id="nav-tab-cluster"
              onClick={() => setTab('cluster')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'cluster'
                  ? 'bg-emerald-950/80 text-emerald-300 font-bold border border-emerald-800/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Cluster & Audit</span>
            </button>

            <button
              id="nav-tab-wallets"
              onClick={() => setTab('wallets')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 whitespace-nowrap text-[11px] ${
                activeTab === 'wallets'
                  ? 'bg-amber-950/80 text-amber-300 font-bold border border-amber-800/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3 h-3 text-amber-400" />
              <span>Tárcák & API</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Threshold Settings Modal Panel */}
      {showThresholdSettings && (
        <div className="p-3 bg-[#0e0e0e] border-b border-cyan-500/30 text-xs font-mono shadow-2xl flex flex-wrap items-center justify-between gap-4 text-slate-200">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-cyan-300 uppercase tracking-wider">
              Kereskedési Motor & Biztonsági Küszöbök
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-[#050505] px-3 py-1 rounded border border-[#222]">
              <span className="text-slate-400">Késleltetési Limit (ms):</span>
              <input
                id="input-latency-threshold"
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={latencyAlertThresholdMs}
                onChange={(e) => setLatencyAlertThresholdMs(parseFloat(e.target.value) || 5.0)}
                className="w-16 bg-[#111] border border-slate-700 text-amber-400 font-bold text-center rounded py-0.5 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 bg-[#050505] px-3 py-1 rounded border border-[#222]">
              <span className="text-slate-400">Jitter Limit (ms):</span>
              <input
                id="input-jitter-threshold"
                type="number"
                step="5"
                min="5"
                max="500"
                value={jitterAlertThresholdMs}
                onChange={(e) => setJitterAlertThresholdMs(parseFloat(e.target.value) || 50.0)}
                className="w-16 bg-[#111] border border-slate-700 text-cyan-400 font-bold text-center rounded py-0.5 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 bg-[#050505] px-3 py-1 rounded border border-[#222]">
              <span className="text-slate-400">MM Spread (bps):</span>
              <input
                id="input-mm-spread"
                type="number"
                step="1"
                min="1"
                max="100"
                value={marketMakerStatus?.targetSpreadBps || 5}
                onChange={(e) => updateMarketMakerConfig({ targetSpreadBps: parseFloat(e.target.value) || 5 })}
                className="w-16 bg-[#111] border border-slate-700 text-cyan-300 font-bold text-center rounded py-0.5 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              id="close-threshold-settings-btn"
              onClick={() => setShowThresholdSettings(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-2.5 py-1 rounded text-[11px] font-bold"
            >
              Bezárás
            </button>
          </div>
        </div>
      )}

      {/* AI Standby Live Banner */}
      {isAiStandbyActive && (
        <div className="px-4 py-1 border-b border-purple-500/20 flex items-center justify-between text-xs font-mono bg-purple-950/20 text-purple-200">
          <div className="flex items-center gap-2 overflow-hidden max-w-[1900px] mx-auto w-full justify-between">
            <div className="flex items-center gap-2 truncate">
              <Cpu className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />
              <span className="font-bold text-purple-300 shrink-0 text-[11px]">AI AUTO-STANDBY:</span>
              <span className="text-slate-300 truncate text-[11px]">{aiStandbyReason || 'Piacmérések folyamatos elemzése és dinamikus profil-választás...'}</span>
            </div>
            <span className="text-[9px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/40 font-bold shrink-0">
              AKTÍV: {activeUser?.name}
            </span>
          </div>
        </div>
      )}
    </header>
  );
};

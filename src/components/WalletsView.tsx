import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { ExchangeProvider, ExchangeWallet, WalletStatus } from '../types';
import { QrScannerModal } from './QrScannerModal';
import {
  Wallet,
  Key,
  Shield,
  Zap,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Star,
  Activity,
  Layers,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Cpu,
  ArrowUpRight,
  ArrowDownRight,
  Sliders,
  DollarSign,
  Info,
  QrCode,
  Camera
} from 'lucide-react';

export const WalletsView: React.FC = () => {
  const {
    wallets,
    globalTradingMode,
    setGlobalTradingMode,
    isAddWalletModalOpen,
    setAddWalletModalOpen,
    addWallet,
    testWallet,
    toggleWalletLiveMode,
    setDefaultWallet,
    deleteWallet,
    syncAllWallets
  } = useTradeStore();

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResultMsg, setTestResultMsg] = useState<{ id: string; message: string; success: boolean } | null>(null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [showLiveConfirmModal, setShowLiveConfirmModal] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScanNotice, setQrScanNotice] = useState<string | null>(null);
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(false);

  // Helper component to mask values in Privacy Mode until hovered over
  const PrivacyValue: React.FC<{ value: React.ReactNode; className?: string }> = ({ value, className = '' }) => {
    if (!isPrivacyMode) {
      return <span className={className}>{value}</span>;
    }

    return (
      <span
        className={`relative inline-block cursor-pointer group/privacy ${className}`}
        title="Adatvédelmi Mód — Vigye fölé az egeret a megjelenítéshez"
      >
        <span className="filter blur-[6px] group-hover/privacy:blur-none transition-all duration-200 select-none group-hover/privacy:select-auto">
          {value}
        </span>
        <span className="absolute inset-0 flex items-center justify-center opacity-70 group-hover/privacy:opacity-0 transition-opacity pointer-events-none text-[10px] font-mono text-purple-300">
          🔒
        </span>
      </span>
    );
  };

  const handleQrScanSuccess = (scannedText: string, parsedData?: any) => {
    setIsQrScannerOpen(false);

    if (parsedData && typeof parsedData === 'object') {
      setFormData((prev) => ({
        ...prev,
        provider: parsedData.provider || prev.provider,
        label: parsedData.label || prev.label,
        apiKey: parsedData.apiKey || parsedData.address || scannedText,
        apiSecret: parsedData.apiSecret || prev.apiSecret,
        environment: parsedData.environment || prev.environment
      }));
      setQrScanNotice(`QR Kód beolvasva! Konfiguráció betöltve (${parsedData.provider || 'Tárca'}).`);
    } else {
      setFormData((prev) => ({
        ...prev,
        apiKey: scannedText
      }));
      setQrScanNotice(`QR Kód beolvasva! API Kulcs / Cím beillesztve: ${scannedText.slice(0, 16)}...`);
    }

    setAddWalletModalOpen(true);
    setTimeout(() => setQrScanNotice(null), 6000);
  };

  // Form State for Add Wallet Modal
  const [formData, setFormData] = useState({
    provider: 'Binance' as ExchangeProvider,
    label: '',
    environment: 'MAINNET_LIVE' as 'MAINNET_LIVE' | 'TESTNET_SANDBOX',
    accountType: 'Futures' as 'Spot' | 'Futures' | 'Margin' | 'FX Multi-Asset',
    apiKey: '',
    apiSecret: '',
    subAccount: '',
    initialEquity: '10000',
    isLiveTradingEnabled: true,
    isDefaultExecution: false
  });
  const [showSecret, setShowSecret] = useState(false);
  const [formError, setFormError] = useState('');

  // Aggregated Portfolio Metrics across wallets
  const totalEquity = wallets.reduce((acc, w) => acc + (w.metrics?.totalEquityUsd || 0), 0);
  const totalAvailable = wallets.reduce((acc, w) => acc + (w.metrics?.availableUsd || 0), 0);
  const totalMarginUsed = wallets.reduce((acc, w) => acc + (w.metrics?.marginUsedUsd || 0), 0);
  const totalPnL24h = wallets.reduce((acc, w) => acc + (w.metrics?.pnl24hUsd || 0), 0);
  const totalVolume24h = wallets.reduce((acc, w) => acc + (w.metrics?.volume24hUsd || 0), 0);
  const connectedWalletsCount = wallets.filter(w => w.status === 'CONNECTED').length;
  const liveWalletsCount = wallets.filter(w => w.isLiveTradingEnabled).length;
  const avgLatency = wallets.length > 0
    ? Math.round(wallets.reduce((acc, w) => acc + (w.metrics?.apiLatencyMs || 15), 0) / wallets.length)
    : 0;

  const handleTestWallet = async (id: string) => {
    setTestingId(id);
    setTestResultMsg(null);
    const res = await testWallet(id);
    setTestingId(null);
    setTestResultMsg({ id, message: res.message, success: res.success });
    setTimeout(() => setTestResultMsg(null), 5000);
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    await syncAllWallets();
    setTimeout(() => setIsSyncingAll(false), 800);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.apiKey.trim()) {
      setFormError('Az API kulcs megadása kötelező!');
      return;
    }
    setFormError('');
    await addWallet({
      ...formData,
      label: formData.label.trim() || `${formData.provider} ${formData.environment === 'MAINNET_LIVE' ? 'Live' : 'Testnet'}`
    });
    setFormData({
      provider: 'Binance',
      label: '',
      environment: 'MAINNET_LIVE',
      accountType: 'Futures',
      apiKey: '',
      apiSecret: '',
      subAccount: '',
      initialEquity: '10000',
      isLiveTradingEnabled: true,
      isDefaultExecution: false
    });
  };

  const getProviderBadgeStyle = (provider: ExchangeProvider) => {
    switch (provider) {
      case 'Binance':
        return 'bg-amber-950/60 border-amber-500/50 text-amber-300';
      case 'Bybit':
        return 'bg-orange-950/60 border-orange-500/50 text-orange-300';
      case 'KuCoin':
        return 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300';
      case 'Coinbase':
        return 'bg-blue-950/60 border-blue-500/50 text-blue-300';
      case 'InteractiveBrokers':
        return 'bg-indigo-950/60 border-indigo-500/50 text-indigo-300';
      case 'OANDA':
        return 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300';
      default:
        return 'bg-slate-900 border-slate-700 text-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Mode Toggle */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-950/80 border border-emerald-800/60 rounded-lg text-emerald-400">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 tracking-wide">
                  Élő Kereskedési Számlák & Szolgáltatói Tárcák (Multi-Exchange API)
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  VAULT v2.4 SECURE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Kezelj több tőzsdei API kulcsot és élő számlát egyszerre. Valós idejű egyenleg szinkronizáció, díjstruktúrák és végrehajtási metrikák.
              </p>
            </div>
          </div>

          {/* Global Mode Switcher & Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 p-1.5 rounded-lg">
              <span className="text-[11px] text-slate-400 font-medium px-2">Kereskedési Mód:</span>
              <button
                onClick={() => setGlobalTradingMode('PAPER')}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  globalTradingMode === 'PAPER'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Demo (Paper)</span>
              </button>
              <button
                onClick={() => {
                  if (globalTradingMode === 'PAPER') {
                    setShowLiveConfirmModal(true);
                  } else {
                    setGlobalTradingMode('PAPER');
                  }
                }}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  globalTradingMode === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Élő Kereskedés (Live)</span>
              </button>
            </div>

            <button
              id="privacy-mode-btn"
              onClick={() => setIsPrivacyMode(!isPrivacyMode)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-md flex items-center gap-1.5 border ${
                isPrivacyMode
                  ? 'bg-purple-950/90 text-purple-200 border-purple-700/80 shadow-purple-950/40 ring-1 ring-purple-500/40'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/80'
              }`}
              title="Adatvédelem mód: Maszkolja az egyenlegeket és API kulcsokat (föléhúzással látható)"
            >
              {isPrivacyMode ? <EyeOff className="w-4 h-4 text-purple-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
              <span>Adatvédelem {isPrivacyMode ? '(BE)' : '(KI)'}</span>
            </button>

            <button
              onClick={handleSyncAll}
              disabled={isSyncingAll}
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isSyncingAll ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isSyncingAll ? 'Szinkronizálás...' : 'Összes Szinkronizálása'}</span>
            </button>

            <button
              id="qr-scan-btn"
              onClick={() => setIsQrScannerOpen(true)}
              className="px-3 py-2 bg-cyan-950/80 hover:bg-cyan-900/80 text-cyan-200 border border-cyan-800/80 rounded-lg text-xs font-semibold transition-all shadow-md flex items-center gap-1.5"
              title="QR kód beolvasása kamerával"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>QR Beolvasás (Kamera)</span>
            </button>

            <button
              id="add-wallet-btn"
              onClick={() => setAddWalletModalOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Új Tárca / API Kulcs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Live Confirm Warning Modal */}
      {showLiveConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/50 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl">
                <AlertTriangle className="w-7 h-7 animate-bounce" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Élő Kereskedési Mód Aktiválása</h3>
                <p className="text-xs text-red-300">Valódi tőzsdei megbízás-végrehajtási figyelmeztetés</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-red-950/30 border border-red-900/40 p-3 rounded-lg">
              Ön most átkapcsol az <strong>Élő Tőzsdei Kereskedésre (Live Execution)</strong>. Ebben a módban az AlgoMentor HFT szignálok és kézi megbízások <strong>valódi tőzsdei kereskedést</strong> indítanak az aktív API kulccsal rendelkező tárcáin!
            </p>

            <div className="text-[11px] text-slate-400 space-y-1 font-mono">
              <div>• Aktív élő tárcák száma: <span className="text-emerald-400 font-bold">{liveWalletsCount} db</span></div>
              <div>• Végrehajtási késleltetés: <span className="text-cyan-400 font-bold">~{avgLatency} ms</span></div>
              <div>• Kockázati védelem: <span className="text-amber-400 font-bold">Pre-Trade Circuit Breaker Aktív</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowLiveConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Mégse (Demo Marad)
              </button>
              <button
                onClick={() => {
                  setGlobalTradingMode('LIVE');
                  setShowLiveConfirmModal(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-red-600/30 flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>Igen, Aktiválom az Élő Kereskedést</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Mode Banner Notice */}
      {isPrivacyMode && (
        <div className="p-3 rounded-xl border border-purple-800/80 bg-purple-950/70 text-purple-200 text-xs flex items-center justify-between transition-all shadow-md animate-fadeIn">
          <div className="flex items-center gap-2 font-mono">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>
              <strong>Adatvédelmi Mód Aktív (Privacy Mode):</strong> Az egyenlegek, API kulcsok és címei el vannak maszkolva. Vigye az egeret bármelyik érték fölé az átmeneti megjelenítéshez!
            </span>
          </div>
          <button
            onClick={() => setIsPrivacyMode(false)}
            className="px-2.5 py-1 bg-purple-900/80 hover:bg-purple-800 text-purple-200 rounded text-[11px] font-semibold"
          >
            Kikapcsolás
          </button>
        </div>
      )}

      {/* Portfolio Aggregated Dashboard KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>Összesített Tőke</span>
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono tracking-tight">
            <PrivacyValue value={`$${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Minden csatlakoztatott tárcában</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>24h Össz PnL</span>
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className={`text-lg font-bold font-mono tracking-tight flex items-center gap-1 ${
            totalPnL24h >= 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {totalPnL24h >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <PrivacyValue value={`$${totalPnL24h >= 0 ? '+' : ''}${totalPnL24h.toFixed(2)}`} />
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Napi nettó eredmény</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>Elérhető Szabad Tőke</span>
            <Wallet className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 font-mono tracking-tight">
            <PrivacyValue value={`$${totalAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Uso margin kimerítés nélkül</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>Lekötött Margin</span>
            <Layers className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300 font-mono tracking-tight">
            <PrivacyValue value={`$${totalMarginUsed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Nyitott pozíciók mérete</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>Aktív Kapcsolatok</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 font-mono tracking-tight">
            {connectedWalletsCount} / {wallets.length} <span className="text-xs font-normal text-slate-400">tárca</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">{liveWalletsCount} élő kereskedésre beállítva</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>Átl. API Latency</span>
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-cyan-300 font-mono tracking-tight">
            {avgLatency} <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Tőzsdei válaszidő ping</div>
        </div>
      </div>

      {/* QR Scan Success Toast Notice */}
      {qrScanNotice && (
        <div className="p-3 rounded-xl border border-cyan-700/80 bg-cyan-950/90 text-cyan-200 text-xs flex items-center justify-between transition-all shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2 font-mono">
            <QrCode className="w-4 h-4 text-cyan-400" />
            <span>{qrScanNotice}</span>
          </div>
          <button onClick={() => setQrScanNotice(null)} className="text-cyan-400 hover:text-cyan-100 text-xs">✕</button>
        </div>
      )}

      {/* Global Wallet Test Result Toast Notice */}
      {testResultMsg && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${
          testResultMsg.success
            ? 'bg-emerald-950/90 border-emerald-700/80 text-emerald-200'
            : 'bg-red-950/90 border-red-700/80 text-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {testResultMsg.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
            <span className="font-mono">{testResultMsg.message}</span>
          </div>
        </div>
      )}

      {/* Exchange Wallets Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
        {wallets.map((wallet) => {
          const isDefault = wallet.isDefaultExecution;
          const isLive = wallet.isLiveTradingEnabled;
          const isTesting = testingId === wallet.id;

          return (
            <div
              key={wallet.id}
              className={`bg-slate-900/90 rounded-2xl border p-5 transition-all relative flex flex-col justify-between space-y-4 shadow-lg ${
                isDefault
                  ? 'border-emerald-500/60 ring-1 ring-emerald-500/20 shadow-emerald-950/30'
                  : 'border-slate-800/90 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getProviderBadgeStyle(wallet.provider)}`}>
                      {wallet.provider}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-100">{wallet.label}</h3>
                        {isDefault && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/80 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
                            ALAPÉRTELMEZETT
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                        <span>API: <PrivacyValue value={wallet.apiKeyMasked} /></span>
                        {wallet.subAccount && (
                          <span className="text-slate-500">| Sub: <PrivacyValue value={wallet.subAccount} /></span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      wallet.environment === 'MAINNET_LIVE'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                        : 'bg-sky-950/80 text-sky-300 border border-sky-800/60'
                    }`}>
                      {wallet.environment === 'MAINNET_LIVE' ? 'MAINNET LIVE' : 'TESTNET'}
                    </span>
                  </div>
                </div>

                {/* Connection Status & Ping Bar */}
                <div className="mt-3 flex items-center justify-between text-[11px] bg-slate-950/60 border border-slate-800/60 px-3 py-1.5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        wallet.status === 'CONNECTED' ? 'bg-emerald-400' : 'bg-red-400'
                      }`} />
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${
                        wallet.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-red-500'
                      }`} />
                    </span>
                    <span className={`font-semibold ${wallet.status === 'CONNECTED' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {wallet.status === 'CONNECTED' ? 'KAPCSOLÓDVA' : 'DISCONNECTED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-400 font-mono">
                    <span>Ping: <strong className="text-cyan-300">{wallet.metrics?.apiLatencyMs || 12} ms</strong></span>
                    <span>Szinkron: {new Date(wallet.lastSyncTime).toLocaleTimeString('hu-HU')}</span>
                  </div>
                </div>
              </div>

              {/* Equity & Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-3">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Tőke (Equity)</div>
                  <div className="text-base font-bold text-slate-100 font-mono mt-0.5">
                    <PrivacyValue value={`$${wallet.metrics?.totalEquityUsd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`} />
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Szabad Margin</div>
                  <div className="text-base font-bold text-slate-200 font-mono mt-0.5">
                    <PrivacyValue value={`$${wallet.metrics?.availableUsd?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`} />
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">24h PnL</div>
                  <div className={`text-base font-bold font-mono mt-0.5 ${
                    (wallet.metrics?.pnl24hUsd || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    <PrivacyValue
                      value={
                        <>
                          {(wallet.metrics?.pnl24hUsd || 0) >= 0 ? '+' : ''}${wallet.metrics?.pnl24hUsd?.toFixed(2) || '0.00'}
                          <span className="text-[10px] ml-1 font-normal opacity-80">
                            ({(wallet.metrics?.pnl24hPct || 0) >= 0 ? '+' : ''}{wallet.metrics?.pnl24hPct?.toFixed(2)}%)
                          </span>
                        </>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Account Conditions & Fee Structure */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Sliders className="w-3.5 h-3.5 text-slate-400" />
                    Számla Kondíciók & Díjak:
                  </span>
                  <span className="font-mono text-purple-300 font-bold bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded">
                    {wallet.conditions?.accountType || 'Futures'} ({wallet.conditions?.vipLevel || 'Standard'})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
                  <div>
                    <span className="text-slate-500">Maker / Taker Díj: </span>
                    <span className="text-emerald-300 font-bold">
                      {wallet.conditions?.makerFeePct}% / {wallet.conditions?.takerFeePct}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Max Tőkeáttétel: </span>
                    <span className="text-amber-300 font-bold">{wallet.conditions?.maxLeverage}x</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Rate Limit: </span>
                    <span className="text-slate-200">
                      {wallet.conditions?.rateLimitCurrentUsed} / {wallet.conditions?.rateLimitMaxReqPerMin} req/min
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">24h Volumén: </span>
                    <span className="text-slate-200">
                      <PrivacyValue value={`$${(wallet.metrics?.volume24hUsd || 0).toLocaleString()}`} />
                    </span>
                  </div>
                </div>
              </div>

              {/* Assets Breakdown */}
              {wallet.assets && wallet.assets.length > 0 && (
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Tárcában lévő Eszközök:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {wallet.assets.map((ast, idx) => (
                      <span key={idx} className="bg-slate-950 border border-slate-800 text-[11px] font-mono px-2 py-0.5 rounded text-slate-300">
                        <PrivacyValue
                          value={
                            <>
                              <strong className="text-emerald-400">{ast.symbol}:</strong> {ast.total} <span className="text-slate-500 text-[9px]">({ast.available} szb)</span>
                            </>
                          }
                        />
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestWallet(wallet.id)}
                    disabled={isTesting}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                  >
                    <Zap className={`w-3.5 h-3.5 text-yellow-400 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Ping...' : 'API Ping Teszt'}</span>
                  </button>

                  <button
                    onClick={() => toggleWalletLiveMode(wallet.id, !isLive)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      isLive
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    <span>Élő Kereskedés: {isLive ? 'BE' : 'KI'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {!isDefault && (
                    <button
                      onClick={() => setDefaultWallet(wallet.id)}
                      className="px-2.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>Kijelölés Alapértelmezettnek</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (confirm(`Biztosan törölni szeretné a(z) "${wallet.label}" tárcát és API kulcsot?`)) {
                        deleteWallet(wallet.id);
                      }
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-all"
                    title="Tárca törlése"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add New Wallet Modal */}
      {isAddWalletModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-slate-100 font-bold text-base">
                <Plus className="w-5 h-5 text-emerald-400" />
                <span>Új Szolgáltatói Tárca / API Kulcs Hozzáadása</span>
              </div>
              <button
                onClick={() => setAddWalletModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-950/80 border border-red-800 rounded-lg text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tőzsdei Szolgáltató (Exchange Provider):</label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as ExchangeProvider })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-semibold focus:border-emerald-500 outline-none"
                >
                  <option value="Binance">Binance (Spot & Futures)</option>
                  <option value="Bybit">Bybit (Unified Trading Account)</option>
                  <option value="KuCoin">KuCoin (Spot & Futures)</option>
                  <option value="Coinbase">Coinbase Advanced Trade</option>
                  <option value="InteractiveBrokers">Interactive Brokers (IBKR Pro Gateway)</option>
                  <option value="OANDA">OANDA (FX & Gold Direct v20 API)</option>
                  <option value="CustomFIX">Custom FIX 4.4 Protocol Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Tárca Címkéje (Label):</label>
                <input
                  type="text"
                  placeholder="pl. Binance Mainnet Primary VIP-2"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Környezet (Environment):</label>
                  <select
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-emerald-500 outline-none"
                  >
                    <option value="MAINNET_LIVE">Mainnet Live Számla</option>
                    <option value="TESTNET_SANDBOX">Testnet / Sandbox</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Számla Típusa:</label>
                  <select
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-emerald-500 outline-none"
                  >
                    <option value="Futures">Futures / Perpetuals</option>
                    <option value="Spot">Spot Trading</option>
                    <option value="Margin">Cross Margin</option>
                    <option value="FX Multi-Asset">FX & Commodities Multi-Asset</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-semibold">API Key (Publikus Kulcs / Tárca Cím):</label>
                  <button
                    type="button"
                    onClick={() => setIsQrScannerOpen(true)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded"
                  >
                    <QrCode className="w-3 h-3 text-cyan-400" />
                    <span>Beolvasás Kamera QR-rel</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Paste or scan exchange API key / public address..."
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">API Secret (Titkos Kulcs):</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    placeholder="Paste API secret key..."
                    value={formData.apiSecret}
                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-emerald-500 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  A titkos kulcsok AES-256 titkosítással tárolódnak a szerver Vault memóriájában, böngészőnek soha nem továbbítódnak.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Sub-Account ID (Opcionális):</label>
                  <input
                    type="text"
                    placeholder="pl. scalping_sub_1"
                    value={formData.subAccount}
                    onChange={(e) => setFormData({ ...formData, subAccount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Kezdő Szinkron Tőke ($USD):</label>
                  <input
                    type="number"
                    value={formData.initialEquity}
                    onChange={(e) => setFormData({ ...formData, initialEquity: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-100 font-mono focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isLiveTradingEnabled}
                    onChange={(e) => setFormData({ ...formData, isLiveTradingEnabled: e.target.checked })}
                    className="rounded border-slate-800 text-emerald-500 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-200">Élő megbízás-végrehajtás engedélyezése ezen a tárcán</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isDefaultExecution}
                    onChange={(e) => setFormData({ ...formData, isDefaultExecution: e.target.checked })}
                    className="rounded border-slate-800 text-amber-500 focus:ring-amber-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-200">Beállítás elsődleges alapértelmezett kereskedési tárcaként</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddWalletModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mentés & Kapcsolódás</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Camera Scanner Modal */}
      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        onScanSuccess={handleQrScanSuccess}
      />
    </div>
  );
};

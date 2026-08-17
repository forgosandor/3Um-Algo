import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { TrendingUp, TrendingDown, ArrowUpRight, Zap, Coins, Gem, Sparkles, Layers, DollarSign, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const MultiAssetOverview: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const assets = useTradeStore(state => state.assets);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const setSymbol = useTradeStore(state => state.setSymbol);
  const submitOrder = useTradeStore(state => state.submitOrder);
  const activeUser = useTradeStore(state => state.activeUser);
  const latencyMs = useTradeStore(state => state.latencyMs);

  const handleQuickBuy = (symbol: string, currentPrice: number, defaultAmount: number) => {
    submitOrder({
      side: 'BUY',
      type: 'MARKET',
      price: currentPrice,
      amount: defaultAmount,
      leverage: 10
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Commodity':
        return <Gem className="w-3.5 h-3.5 text-amber-400" />;
      case 'Crypto':
        return <Coins className="w-3.5 h-3.5 text-sky-400" />;
      default:
        return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getQuickAmount = (symbol: string) => {
    if (symbol === 'BTCUSDT') return 0.01;
    if (symbol === 'ETHUSDT') return 0.1;
    if (symbol === 'SOLUSDT') return 1.0;
    if (symbol === 'XAUUSD') return 0.1; // Gold ounces
    if (symbol === 'XAGUSD') return 5.0; // Silver ounces
    return 1000;
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 font-mono text-xs shadow-xl relative z-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <div className="p-1.5 bg-blue-600/10 border border-blue-500/30 rounded-lg text-blue-400 group-hover:bg-blue-600/20 transition-all">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-extrabold text-white tracking-wide uppercase group-hover:text-blue-400 transition-colors">
                Multi-Asset Kereskedési Aréna
              </h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[8px] font-bold px-1.5 py-0.2 rounded uppercase">
                Live L2
              </span>
              <button className="text-slate-500 group-hover:text-slate-300 transition-colors ml-1">
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Global Account Multi-Asset Balance Pill */}
        <div className="flex flex-wrap items-center gap-2 bg-[#050505] border border-[#222] px-2.5 py-1 rounded-lg text-[10px]">
          <span className="text-slate-500 uppercase tracking-wider text-[8px]">Eszközkészlet:</span>
          <span className="text-emerald-400 font-bold">${activeUser?.usdBalance.toLocaleString() || '0'} USD</span>
          <span className="text-slate-700">|</span>
          <span className="text-amber-400 font-bold">{activeUser?.btcBalance || 0} BTC</span>
          <span className="text-slate-700">|</span>
          <span className="text-sky-400 font-bold">{activeUser?.ethBalance || 0} ETH</span>
          <span className="text-slate-700">|</span>
          <span className="text-purple-400 font-bold">{activeUser?.solBalance || 0} SOL</span>
          <span className="text-slate-700">|</span>
          <span className="text-yellow-300 font-bold">{activeUser?.xauBalance || 0} XAU</span>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Grid of All Monitored Asset Markets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 mt-3 pt-3 border-t border-[#161616]">
              {assets.map((asset) => {
                const isSelected = asset.symbol === selectedSymbol;
                const isPositive = asset.change24h >= 0;
                const quickAmount = getQuickAmount(asset.symbol);
                const baseAsset = asset.symbol.replace('USDT', '').replace('USD', '');

                return (
                  <div
                    key={asset.symbol}
                    onClick={() => setSymbol(asset.symbol)}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-950/30 border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                        : 'bg-[#060606] border-[#181818] hover:border-[#2a2a2a] hover:bg-[#0c0c0c]'
                    }`}
                  >
                    {/* Top Row: Symbol & Category */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          {getCategoryIcon(asset.category)}
                          <span className="font-extrabold text-xs text-white tracking-wider">{asset.symbol}</span>
                        </div>
                        <span
                          className={`text-[8px] font-bold px-1 py-0.2 rounded flex items-center gap-0.5 ${
                            isPositive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isPositive ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                          {isPositive ? '+' : ''}
                          {asset.change24h}%
                        </span>
                      </div>

                      {/* Main Live Price */}
                      <div className="text-base font-black text-white tracking-tight">
                        ${asset.price.toFixed(asset.decimals)}
                      </div>

                      {/* 24h High/Low & Spread */}
                      <div className="mt-1.5 pt-1.5 border-t border-[#151515] grid grid-cols-2 gap-1 text-[9px] text-slate-400">
                        <div>
                          <span className="text-slate-600 block text-[8px] uppercase">24h Csúcs</span>
                          <span className="font-semibold text-slate-300">${asset.high24h.toFixed(asset.decimals)}</span>
                        </div>
                        <div>
                          <span className="text-slate-600 block text-[8px] uppercase">Spread</span>
                          <span className="font-semibold text-amber-400/90">${asset.spread}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Buy Execution Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickBuy(asset.symbol, asset.price, quickAmount);
                      }}
                      className={`mt-2 w-full py-1 px-2 rounded font-bold text-[10px] uppercase flex items-center justify-center gap-1 transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                          : 'bg-[#151515] hover:bg-[#202020] text-slate-300 border border-[#252525]'
                      }`}
                    >
                      <Zap className="w-2.5 h-2.5 text-amber-400" />
                      <span>Vétel {quickAmount} {baseAsset}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

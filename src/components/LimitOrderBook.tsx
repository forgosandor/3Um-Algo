import React from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Layers, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export const LimitOrderBook: React.FC = () => {
  const orderBook = useTradeStore(state => state.orderBook);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const asset = assets.find(a => a.symbol === selectedSymbol);

  if (!orderBook) {
    return (
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 text-center text-slate-500 font-mono text-xs">
        LOB adatok betöltése...
      </div>
    );
  }

  const asks = orderBook.asks || [];
  const bids = orderBook.bids || [];
  const maxAskVol = Math.max(...asks.map(a => a?.amount ?? 0), 0.1);
  const maxBidVol = Math.max(...bids.map(b => b?.amount ?? 0), 0.1);
  const imbalance = typeof orderBook.imbalance === 'number' && !isNaN(orderBook.imbalance) ? orderBook.imbalance : 0;

  return (
    <div id="limit-order-book-widget" className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 font-mono text-xs shadow-2xl flex flex-col h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span className="font-bold text-white">Limit Order Book (LOB)</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-500">Spread:</span>
          <span className="text-amber-400 font-bold">{orderBook.spread} ({orderBook.spreadPct}%)</span>
        </div>
      </div>

      {/* Orderbook Column Headers */}
      <div className="grid grid-cols-3 text-[10px] text-slate-500 uppercase pb-1 px-1 border-b border-[#1a1a1a] font-semibold">
        <span className="text-left">Ár ({asset?.category === 'Crypto' ? 'USDT' : 'USD'})</span>
        <span className="text-right">Méret</span>
        <span className="text-right">Összesen</span>
      </div>

      {/* Asks (Sell Orders) - Red */}
      <div className="flex-1 overflow-hidden flex flex-col justify-end space-y-0.5 py-1">
        {asks.slice(0, 8).reverse().map((ask, idx) => {
          const rawPct = (ask.amount / maxAskVol) * 100;
          const depthPct = isNaN(rawPct) || !isFinite(rawPct) ? 0 : Math.max(0, Math.min(100, rawPct));
          return (
            <div
              key={`ask-${ask.price}-${idx}`}
              className="grid grid-cols-3 text-[11px] py-0.5 px-1 relative hover:bg-[#111111] rounded transition-colors group cursor-pointer"
            >
              {/* Depth Background Bar */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-rose-950/40 border-r border-rose-500/30 transition-all"
                style={{ width: `${depthPct}%` }}
              />

              <span className="text-rose-400 font-bold z-10 text-left">
                {(ask.price ?? 0).toFixed(asset?.decimals || 2)}
              </span>
              <span className="text-slate-300 z-10 text-right">
                {ask.amount.toFixed(4)}
              </span>
              <span className="text-slate-500 z-10 text-right text-[10px]">
                {ask.total.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mid Price / Spread Indicator */}
      <div className="my-2 py-1.5 px-3 bg-[#050505] border border-[#1a1a1a] rounded-lg flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-extrabold text-sm text-white">
          <span>{(orderBook.lastPrice ?? 0).toFixed(asset?.decimals || 2)}</span>
          <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
        </div>
        <div className="text-[10px] text-slate-500 font-sans">
          In-Memory Match FIFO
        </div>
      </div>

      {/* Bids (Buy Orders) - Green */}
      <div className="flex-1 overflow-hidden flex flex-col justify-start space-y-0.5 py-1">
        {bids.slice(0, 8).map((bid, idx) => {
          const rawPct = (bid.amount / maxBidVol) * 100;
          const depthPct = isNaN(rawPct) || !isFinite(rawPct) ? 0 : Math.max(0, Math.min(100, rawPct));
          return (
            <div
              key={`bid-${bid.price}-${idx}`}
              className="grid grid-cols-3 text-[11px] py-0.5 px-1 relative hover:bg-[#111111] rounded transition-colors group cursor-pointer"
            >
              {/* Depth Background Bar */}
              <div
                className="absolute right-0 top-0 bottom-0 bg-emerald-950/40 border-r border-emerald-500/30 transition-all"
                style={{ width: `${depthPct}%` }}
              />

              <span className="text-emerald-400 font-bold z-10 text-left">
                {(bid.price ?? 0).toFixed(asset?.decimals || 2)}
              </span>
              <span className="text-slate-300 z-10 text-right">
                {bid.amount.toFixed(4)}
              </span>
              <span className="text-slate-500 z-10 text-right text-[10px]">
                {bid.total.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Imbalance Meter */}
      <div className="pt-2 border-t border-[#1a1a1a] mt-2">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span className="text-emerald-400 font-bold">Vevők (Bids)</span>
          <span className="text-slate-400">Imbalance: {imbalance > 0 ? '+' : ''}{Math.round(imbalance * 100)}%</span>
          <span className="text-rose-400 font-bold">Eladók (Asks)</span>
        </div>
        <div className="w-full bg-[#050505] h-1.5 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, 50 + imbalance * 50))}%` }}
          />
          <div
            className="bg-rose-500 h-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, 50 - imbalance * 50))}%` }}
          />
        </div>
      </div>

    </div>
  );
};

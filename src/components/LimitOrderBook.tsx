import React from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Layers } from 'lucide-react';
import { CanvasOrderBook } from './CanvasOrderBook';

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

      {/* High-Performance Canvas Orderbook Ladder */}
      <div className="flex-1 overflow-hidden min-h-[350px]">
        <CanvasOrderBook maxRows={8} />
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


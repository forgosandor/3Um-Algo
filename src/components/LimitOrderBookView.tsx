import React from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Layers, Zap } from 'lucide-react';
import { CanvasDepthChart } from './CanvasDepthChart';

const LimitOrderBookViewComponent: React.FC = () => {
  const orderBook = useTradeStore(state => state.orderBook);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const asset = assets.find(a => a.symbol === selectedSymbol);

  if (!orderBook) {
    return (
      <div className="p-8 text-center text-slate-500 font-mono">
        LOB adatok betöltése...
      </div>
    );
  }

  return (
    <div id="lob-depth-full-view" className="p-4 max-w-[1800px] mx-auto space-y-4 font-mono text-xs">
      
      {/* LOB Metric Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
          <span className="text-slate-400 text-[10px]">Eszköz & Utolsó Ár</span>
          <div className="text-lg font-extrabold text-white flex items-center gap-2 mt-0.5">
            <span>{selectedSymbol}</span>
            <span className="text-cyan-400">${orderBook.lastPrice}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
          <span className="text-slate-400 text-[10px]">Spread</span>
          <div className="text-lg font-extrabold text-amber-400 mt-0.5">
            {orderBook.spread} ({orderBook.spreadPct}%)
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
          <span className="text-slate-400 text-[10px]">Order Book Imbalance</span>
          <div className={`text-lg font-extrabold mt-0.5 ${orderBook.imbalance > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {orderBook.imbalance > 0 ? '+' : ''}{Math.round(orderBook.imbalance * 100)}% {orderBook.imbalance > 0 ? '(Vevői Fény)' : '(Eladási Nyomás)'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-md">
          <span className="text-slate-400 text-[10px]">Kereskedési Motor Latency</span>
          <div className="text-lg font-extrabold text-cyan-400 mt-0.5 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>&lt; 0.1 ms (In-Memory RAM FIFO)</span>
          </div>
        </div>
      </div>

      {/* Visual Cumulative Depth Area Chart */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Order Book Mélységi Grafikon (Depth Chart)</span>
          </div>
          <span className="text-[10px] text-slate-400">
            Zöld: Vevői Likviditás (Bids) | Piros: Eladói Likviditás (Asks) • Mozgass egeret a szint adatokhoz
          </span>
        </div>

        <div className="w-full">
          <CanvasDepthChart />
        </div>
      </div>


      {/* Full Bid vs Ask Ladder Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Bids Ladder */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
          <h3 className="font-bold text-emerald-400 mb-2 border-b border-slate-800 pb-2">
            Vevői Ajánlatok (Bids - Vétel)
          </h3>
          <div className="space-y-1">
            <div className="grid grid-cols-3 text-[10px] text-slate-500 uppercase font-bold pb-1">
              <span>Ár</span>
              <span className="text-right">Méret</span>
              <span className="text-right">Kumulatív</span>
            </div>
            {orderBook.bids.map((b, i) => (
              <div key={i} className="grid grid-cols-3 py-1 border-b border-slate-800/40 hover:bg-emerald-950/20 px-1 rounded">
                <span className="text-emerald-400 font-bold">${(b?.price ?? 0).toFixed(asset?.decimals || 2)}</span>
                <span className="text-slate-300 text-right">{(b?.amount ?? 0).toFixed(4)}</span>
                <span className="text-slate-400 text-right">{(b?.cumulative ?? 0).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Asks Ladder */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-xl">
          <h3 className="font-bold text-rose-400 mb-2 border-b border-slate-800 pb-2">
            Eladói Ajánlatok (Asks - Eladás)
          </h3>
          <div className="space-y-1">
            <div className="grid grid-cols-3 text-[10px] text-slate-500 uppercase font-bold pb-1">
              <span>Ár</span>
              <span className="text-right">Méret</span>
              <span className="text-right">Kumulatív</span>
            </div>
            {orderBook.asks.map((a, i) => (
              <div key={i} className="grid grid-cols-3 py-1 border-b border-slate-800/40 hover:bg-rose-950/20 px-1 rounded">
                <span className="text-rose-400 font-bold">${(a?.price ?? 0).toFixed(asset?.decimals || 2)}</span>
                <span className="text-slate-300 text-right">{(a?.amount ?? 0).toFixed(4)}</span>
                <span className="text-slate-400 text-right">{(a?.cumulative ?? 0).toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

export const LimitOrderBookView = React.memo(LimitOrderBookViewComponent);

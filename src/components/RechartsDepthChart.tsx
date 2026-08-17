import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { useTradeStore } from '../store/useTradeStore';
import { Layers, ZoomIn, ZoomOut, BarChart2, ShieldAlert } from 'lucide-react';

interface RechartsDepthChartProps {
  height?: number;
}

export const RechartsDepthChart: React.FC<RechartsDepthChartProps> = ({ height = 360 }) => {
  const orderBook = useTradeStore(state => state.orderBook);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const asset = assets.find(a => a.symbol === selectedSymbol);
  const decimals = asset?.decimals ?? 2;

  const [depthLevels, setDepthLevels] = useState<number>(20);
  const [viewMode, setViewMode] = useState<'cumulative' | 'level'>('cumulative');

  const chartData = useMemo(() => {
    if (!orderBook || (!orderBook.bids.length && !orderBook.asks.length)) {
      return [];
    }

    const bids = orderBook.bids.slice(0, depthLevels);
    const asks = orderBook.asks.slice(0, depthLevels);

    if (bids.length === 0 || asks.length === 0) return [];

    const bestBid = bids[0].price;
    const bestAsk = asks[0].price;
    const midPrice = Number(((bestBid + bestAsk) / 2).toFixed(decimals));

    // Bids sorted low-to-high price so X-axis increases left-to-right
    const sortedBids = [...bids].sort((a, b) => a.price - b.price);
    let cumBidVal = 0;
    const bidPoints = sortedBids.map(b => {
      cumBidVal += viewMode === 'cumulative' ? b.amount : b.amount;
      return {
        price: b.price,
        bidDepth: viewMode === 'cumulative' ? b.cumulative : b.amount,
        askDepth: null as number | null,
        amount: b.amount,
        total: b.total,
        type: 'BID'
      };
    });

    // Asks sorted low-to-high price
    const sortedAsks = [...asks].sort((a, b) => a.price - b.price);
    const askPoints = sortedAsks.map(a => {
      return {
        price: a.price,
        bidDepth: null as number | null,
        askDepth: viewMode === 'cumulative' ? a.cumulative : a.amount,
        amount: a.amount,
        total: a.total,
        type: 'ASK'
      };
    });

    // Combine bidPoints, midPrice, askPoints into single continuous dataset
    const combined = [
      ...bidPoints,
      {
        price: midPrice,
        bidDepth: null,
        askDepth: null,
        amount: 0,
        total: 0,
        type: 'MID'
      },
      ...askPoints
    ];

    return combined;
  }, [orderBook, depthLevels, viewMode, decimals]);

  if (!orderBook || chartData.length === 0) {
    return (
      <div className="bg-[#080808] border border-[#1d1d1d] rounded-xl p-8 text-center text-slate-500 font-mono text-xs flex flex-col items-center justify-center gap-2">
        <Layers className="w-8 h-8 text-slate-600 animate-pulse" />
        <span>Order Book adatok szinkronizálása a Recharts Mélységi Grafikonhoz...</span>
      </div>
    );
  }

  const bestBid = orderBook.bids[0]?.price ?? orderBook.lastPrice;
  const bestAsk = orderBook.asks[0]?.price ?? orderBook.lastPrice;
  const midPrice = Number(((bestBid + bestAsk) / 2).toFixed(decimals));

  const totalBidVolume = orderBook.bids.slice(0, depthLevels).reduce((acc, b) => acc + b.amount, 0);
  const totalAskVolume = orderBook.asks.slice(0, depthLevels).reduce((acc, a) => acc + a.amount, 0);
  const totalBidValue = orderBook.bids.slice(0, depthLevels).reduce((acc, b) => acc + b.total, 0);
  const totalAskValue = orderBook.asks.slice(0, depthLevels).reduce((acc, a) => acc + a.total, 0);
  const totalVol = totalBidVolume + totalAskVolume || 1;
  const bidRatioPct = Math.round((totalBidVolume / totalVol) * 100);
  const askRatioPct = 100 - bidRatioPct;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      if (data.type === 'MID') return null;

      const isBid = data.type === 'BID';
      const price = data.price;
      const depthVal = isBid ? data.bidDepth : data.askDepth;
      const distancePct = (((price - midPrice) / midPrice) * 100).toFixed(2);

      return (
        <div className="bg-[#0d0d0d]/95 backdrop-blur-md border border-[#2d2d2d] p-3 rounded-lg shadow-2xl font-mono text-xs space-y-1 z-50">
          <div className="flex items-center justify-between gap-3 border-b border-[#222] pb-1">
            <span className={`font-bold ${isBid ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isBid ? 'BUY BID LIKVIDITÁS' : 'SELL ASK LIKVIDITÁS'}
            </span>
            <span className="text-[10px] text-slate-400">
              {Number(distancePct) >= 0 ? `+${distancePct}%` : `${distancePct}%`} a középártól
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-[11px]">
            <span className="text-slate-400">Szint Ár:</span>
            <span className="font-bold text-white text-right">${price.toFixed(decimals)}</span>

            <span className="text-slate-400">Szint Méret:</span>
            <span className="font-semibold text-slate-200 text-right">{data.amount.toFixed(4)}</span>

            <span className="text-slate-400">{viewMode === 'cumulative' ? 'Kumulatív Mélység:' : 'Szint Térfogat:'}</span>
            <span className={`font-bold text-right ${isBid ? 'text-emerald-400' : 'text-rose-400'}`}>
              {depthVal ? depthVal.toFixed(4) : '0.0000'}
            </span>

            <span className="text-slate-400">Becsült Érték:</span>
            <span className="font-semibold text-amber-300 text-right">
              ${(price * (depthVal || data.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#09090b] border border-[#1e1e24] rounded-xl p-4 shadow-2xl font-mono space-y-3">
      
      {/* Top Header & Interactive Depth Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1d1d22] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-950/50 border border-cyan-800/40 text-cyan-400">
            <Layers className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              <span>Recharts Real-Time Order Book Depth</span>
              <span className="text-[10px] bg-blue-950/80 text-blue-400 border border-blue-800/50 px-1.5 py-0.2 rounded font-bold uppercase">
                {selectedSymbol}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Vevői & Eladói Liquidity Distribution Vector • Spread: ${orderBook.spread} ({orderBook.spreadPct}%)
            </p>
          </div>
        </div>

        {/* Level Controls & Mode Toggle */}
        <div className="flex items-center gap-2">
          {/* Cumulative vs Single Level toggle */}
          <div className="flex items-center bg-[#111116] border border-[#22222b] p-0.5 rounded-lg text-[10px]">
            <button
              onClick={() => setViewMode('cumulative')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                viewMode === 'cumulative'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Kumulatív Mélység
            </button>
            <button
              onClick={() => setViewMode('level')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                viewMode === 'level'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Szint Térfogat
            </button>
          </div>

          {/* Depth Level Selector */}
          <div className="flex items-center gap-1 bg-[#111116] border border-[#22222b] px-2 py-1 rounded-lg text-[11px] text-slate-400">
            <span>Szintek:</span>
            {[10, 20, 30, 50].map(lvl => (
              <button
                key={lvl}
                onClick={() => setDepthLevels(lvl)}
                className={`px-1.5 py-0.5 rounded font-bold ${
                  depthLevels === lvl
                    ? 'bg-blue-600 text-white'
                    : 'hover:text-white hover:bg-[#1f1f28]'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liquidity Ratio Balance Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-bold">
          <span className="text-emerald-400 flex items-center gap-1">
            <span>BID LIKVIDITÁS: {totalBidVolume.toFixed(2)} ({bidRatioPct}%)</span>
            <span className="text-slate-500 font-normal">(${totalBidValue.toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>
          </span>
          <span className="text-slate-400 font-mono">
            KÖZÉPÁR: <span className="text-amber-400 font-bold">${midPrice}</span>
          </span>
          <span className="text-rose-400 flex items-center gap-1">
            <span className="text-slate-500 font-normal">(${totalAskValue.toLocaleString('en-US', { maximumFractionDigits: 0 })})</span>
            <span>ASK LIKVIDITÁS: {totalAskVolume.toFixed(2)} ({askRatioPct}%)</span>
          </span>
        </div>
        <div className="h-1.5 w-full bg-[#18181f] rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${bidRatioPct}%` }}
          />
          <div
            className="bg-rose-500 h-full transition-all duration-300"
            style={{ width: `${askRatioPct}%` }}
          />
        </div>
      </div>

      {/* Main Recharts Area Chart */}
      <div className="w-full relative" style={{ height: `${height}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              {/* Bids Green Gradient */}
              <linearGradient id="bidDepthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>

              {/* Asks Red Gradient */}
              <linearGradient id="askDepthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f28" vertical={false} />

            <XAxis
              dataKey="price"
              tickFormatter={(p: number) => `$${p}`}
              stroke="#52525b"
              tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
              domain={['dataMin', 'dataMax']}
            />

            <YAxis
              stroke="#52525b"
              tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
              orientation="right"
              tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1))}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Vertical Reference Line at Mid Price */}
            <ReferenceLine
              x={midPrice}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{
                value: `MID $${midPrice}`,
                fill: '#f59e0b',
                fontSize: 10,
                position: 'top',
                fontFamily: 'monospace',
                fontWeight: 'bold'
              }}
            />

            {/* Bids Area */}
            <Area
              type="stepAfter"
              dataKey="bidDepth"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#bidDepthGrad)"
              name="Bids Depth"
              connectNulls={false}
              isAnimationActive={false}
            />

            {/* Asks Area */}
            <Area
              type="stepBefore"
              dataKey="askDepth"
              stroke="#f43f5e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#askDepthGrad)"
              name="Asks Depth"
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

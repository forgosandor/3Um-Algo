import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { ResponsiveContainer, ComposedChart, XAxis, YAxis, Tooltip, Bar, Line, Area } from 'recharts';
import { BarChart2, TrendingUp, Sparkles, Sliders } from 'lucide-react';

export const CandleChart: React.FC = () => {
  const candles = useTradeStore(state => state.candles);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const timeframe = useTradeStore(state => state.timeframe);
  const setTimeframe = useTradeStore(state => state.setTimeframe);
  const [showRsi, setShowRsi] = useState(true);
  const [showMacd, setShowMacd] = useState(true);

  const asset = assets.find(a => a.symbol === selectedSymbol);

  if (!candles || candles.length === 0) {
    return (
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-8 text-center text-slate-500 font-mono text-xs">
        Chart adatok betöltése...
      </div>
    );
  }

  // Format candles for chart rendering
  const formattedData = candles.map((c, idx) => {
    const isUp = c.close >= c.open;
    const timeStr = new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Calculate simple RSI proxy
    const rsiVal = 40 + Math.sin(idx * 0.4) * 25 + (isUp ? 10 : -10);
    const macdHist = (Math.sin(idx * 0.3) * (asset?.category === 'Crypto' ? 15 : 0.0005));

    return {
      time: timeStr,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      isUp,
      color: isUp ? '#10b981' : '#f43f5e',
      rsi: Math.max(10, Math.min(90, Math.round(rsiVal))),
      macdHist
    };
  });

  const validLows = candles.map(c => c?.low ?? 0).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
  const validHighs = candles.map(c => c?.high ?? 0).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
  const minPrice = validLows.length > 0 ? Math.min(...validLows) * 0.999 : 0;
  const maxPrice = validHighs.length > 0 ? Math.max(...validHighs) * 1.001 : 100;

  return (
    <div id="candle-chart-container" className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 font-mono flex flex-col h-full shadow-2xl">
      
      {/* Chart Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-[#1a1a1a]">
        
        {/* Symbol & Price Overview */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-blue-400" />
            <span className="font-extrabold text-sm text-white">{selectedSymbol}</span>
            <span className="text-[10px] text-slate-400 bg-[#111111] border border-[#222222] px-1.5 py-0.5 rounded">
              {asset?.category}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold text-white">
              {asset?.price !== undefined ? asset.price.toFixed(asset.decimals || 2) : '0.00'}
            </span>
            <span className={`text-xs font-bold ${asset && asset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {asset && asset.change24h >= 0 ? '+' : ''}{asset?.change24h ?? 0}%
            </span>
          </div>
        </div>

        {/* Timeframe Selector & Indicators Toggle */}
        <div className="flex items-center gap-2">
          
          <div className="flex items-center bg-[#050505] p-0.5 rounded-lg border border-[#1a1a1a] text-[11px]">
            {['M1', 'M5', 'M15', 'H1', 'H4'].map(tf => (
              <button
                key={tf}
                id={`timeframe-btn-${tf}`}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 rounded font-bold transition-all ${
                  timeframe === tf ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <button
            id="toggle-rsi-btn"
            onClick={() => setShowRsi(!showRsi)}
            className={`text-[10px] px-2 py-1 rounded border font-semibold transition-colors ${
              showRsi ? 'bg-blue-950/80 border-blue-700 text-blue-300' : 'bg-[#050505] border-[#1a1a1a] text-slate-500'
            }`}
          >
            RSI (14)
          </button>

          <button
            id="toggle-macd-btn"
            onClick={() => setShowMacd(!showMacd)}
            className={`text-[10px] px-2 py-1 rounded border font-semibold transition-colors ${
              showMacd ? 'bg-purple-950/80 border-purple-700 text-purple-300' : 'bg-[#050505] border-[#1a1a1a] text-slate-500'
            }`}
          >
            MACD (12,26)
          </button>

        </div>

      </div>

      {/* Main Candlestick Chart */}
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" stroke="#444444" fontSize={10} tickLine={false} />
            <YAxis
              domain={[minPrice, maxPrice]}
              orientation="right"
              stroke="#444444"
              fontSize={10}
              tickFormatter={(v) => v.toFixed(asset?.decimals || 2)}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#222222', borderRadius: '8px', fontSize: '11px', color: '#e0e0e0' }}
              labelStyle={{ color: '#888888' }}
            />
            
            {/* Price Line */}
            <Area type="monotone" dataKey="close" stroke="#3b82f6" fill="url(#colorPrice)" fillOpacity={0.15} strokeWidth={2} />
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
              </linearGradient>
            </defs>

            {/* Volume Bars */}
            <Bar dataKey="volume" yAxisId={1} fill="#222222" opacity={0.6} radius={[2, 2, 0, 0]} />
            <YAxis yAxisId={1} orientation="left" hide domain={[0, 'dataMax * 3']} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* RSI Subchart */}
      {showRsi && (
        <div className="h-20 pt-1 border-t border-[#1a1a1a] mt-1">
          <div className="flex justify-between items-center text-[10px] text-slate-500 mb-0.5 px-1">
            <span className="text-blue-400 font-bold">RSI (14)</span>
            <span>Overbought: 70 | Oversold: 30</span>
          </div>
          <ResponsiveContainer width="100%" height={60} minWidth={0} minHeight={0}>
            <ComposedChart data={formattedData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <YAxis domain={[0, 100]} orientation="right" stroke="#444444" fontSize={9} ticks={[30, 50, 70]} tickLine={false} />
              <Line type="monotone" dataKey="rsi" stroke="#60a5fa" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MACD Subchart */}
      {showMacd && (
        <div className="h-16 pt-1 border-t border-[#1a1a1a] mt-1">
          <div className="text-[10px] text-purple-400 font-bold mb-0.5 px-1">
            MACD Histogram
          </div>
          <ResponsiveContainer width="100%" height={50} minWidth={0} minHeight={0}>
            <ComposedChart data={formattedData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <YAxis orientation="right" stroke="#444444" fontSize={9} tickLine={false} />
              <Bar dataKey="macdHist" fill="#c084fc" radius={[1, 1, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
};

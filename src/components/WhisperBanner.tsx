import React from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Sparkles, ShieldAlert, CheckCircle2, X, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';

export const WhisperBanner: React.FC = () => {
  const whispers = useTradeStore(state => state.whispers);
  const markWhispersRead = useTradeStore(state => state.markWhispersRead);
  const submitOrder = useTradeStore(state => state.submitOrder);
  const latestWhisper = whispers[0];

  if (!latestWhisper) return null;

  const handleAction = () => {
    if (latestWhisper.suggestedAction === 'BUY' || latestWhisper.suggestedAction === 'SELL') {
      submitOrder({
        side: latestWhisper.suggestedAction,
        type: 'MARKET',
        price: 0,
        amount: 0.1,
        leverage: 10
      });
    }
    markWhispersRead();
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'PRE_TRADE': return 'bg-blue-950/80 border-blue-800 text-blue-300';
      case 'IN_TRADE': return 'bg-amber-950/80 border-amber-800 text-amber-300';
      case 'POST_TRADE': return 'bg-emerald-950/80 border-emerald-800 text-emerald-300';
      case 'RISK_ALERT': return 'bg-rose-950/80 border-rose-800 text-rose-300';
      default: return 'bg-slate-900 border-slate-700 text-slate-300';
    }
  };

  return (
    <div id="whisper-banner" className="bg-[#0a0a0a]/95 border-b border-blue-900/40 p-3 shadow-xl backdrop-blur-md transition-all">
      <div className="max-w-[1800px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        
        {/* Left Info */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-950/50 border border-blue-800/60 text-blue-400 shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 animate-pulse text-blue-300" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${getBadgeColor(latestWhisper.type)}`}>
                Suttogó {latestWhisper.type.replace('_', ' ')}
              </span>
              <span className="text-xs font-mono font-bold text-white">
                {latestWhisper.title}
              </span>
              {latestWhisper.historicalWinRatePct !== undefined && (
                <span className="bg-emerald-950/60 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-800/60">
                  Múltbeli sikerarány: {latestWhisper.historicalWinRatePct}% ({latestWhisper.historicalAvgR}R)
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 mt-1 leading-relaxed font-sans max-w-4xl">
              {latestWhisper.message}
            </p>

            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              💡 {latestWhisper.matchReason}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          {latestWhisper.suggestedAction && latestWhisper.suggestedAction !== 'WAIT' && (
            <button
              id="whisper-accept-action-btn"
              onClick={handleAction}
              className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <span>Végrehajtás: {latestWhisper.suggestedAction}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            id="whisper-dismiss-btn"
            onClick={markWhispersRead}
            className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1.5 rounded bg-[#111111] border border-[#222222]"
          >
            Tudomásul vettem
          </button>
        </div>

      </div>
    </div>
  );
};

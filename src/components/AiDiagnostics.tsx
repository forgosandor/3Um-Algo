import React, { useState } from 'react';
import { Cpu, RefreshCw, AlertCircle, CheckCircle, ShieldAlert, Sparkles, Server } from 'lucide-react';
import { AiAnalysisResult, ArbitrageOpportunity, PerformanceMetrics, SystemConfig } from '../types';

interface AiDiagnosticsProps {
  metrics: PerformanceMetrics;
  history: ArbitrageOpportunity[];
  config: SystemConfig;
}

export const AiDiagnostics: React.FC<AiDiagnosticsProps> = ({ metrics, history, config }) => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAiDiagnostics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics,
          historySample: history.slice(-15),
          config,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Hiba történt az AI diagnosztika futtatásakor.');
      }

      setAnalysis(data.analysis);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Hiba a Gemini API hívás során.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="ai-diagnostics-view" className="space-y-6 max-w-5xl mx-auto font-sans p-4">
      {/* Header */}
      <div className="bg-[#0D0D0D] border border-[#222222] rounded p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-[#112211] text-[#00FF41] border border-[#004411]">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#F0F0F0] flex items-center gap-2">
              Gemini AI HFT Diagnosztika <Sparkles className="w-4 h-4 text-[#00FF41]" />
            </h2>
            <p className="text-[11px] text-[#666666]">Valós idejű piaci rendszer, hálózati késleltetés és kockázatértékelési diagnózis</p>
          </div>
        </div>

        <button
          id="run-ai-diagnostics-btn"
          onClick={runAiDiagnostics}
          disabled={loading}
          className="px-4 py-2 rounded bg-[#00FF41] hover:bg-[#33FF66] disabled:bg-[#113311] disabled:text-[#555555] text-[#0A0A0A] font-bold text-xs flex items-center gap-2 transition-all shadow-[0_0_8px_rgba(0,255,65,0.2)] cursor-pointer"
        >
          {loading ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Elemzés Folyamatban...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" /> Diagnosztika Indítása
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-[#221111] border border-[#441111] rounded p-4 text-xs font-mono text-[#FF4444] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#FF4444]" />
          <span>{error}</span>
        </div>
      )}

      {analysis ? (
        <div className="space-y-6 font-mono text-xs">
          {/* Summary & Market Regime */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0D0D0D] border border-[#222222] rounded p-5 space-y-2">
              <span className="text-[10px] font-bold text-[#00FF41] uppercase tracking-wider">Rendszer Összefoglaló</span>
              <p className="text-xs text-[#E0E0E0] leading-relaxed font-sans">{analysis.summary}</p>
            </div>

            <div className="bg-[#0D0D0D] border border-[#222222] rounded p-5 space-y-2">
              <span className="text-[10px] font-bold text-[#00CCFF] uppercase tracking-wider">Piaci Rendszer Állapota (Market Regime)</span>
              <div className="text-xs font-bold text-[#F0F0F0] bg-[#111111] px-3 py-2 rounded border border-[#222222]">
                {analysis.marketRegime}
              </div>
            </div>
          </div>

          {/* Latency & Risk Assessments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0D0D0D] border border-[#222222] rounded p-5 space-y-2">
              <span className="text-[10px] font-bold text-[#F27D26] uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5" /> Hálózati & Latency Diagnózis
              </span>
              <p className="text-xs text-[#CCCCCC] leading-relaxed">{analysis.latencyDiagnosis}</p>
            </div>

            <div className="bg-[#0D0D0D] border border-[#222222] rounded p-5 space-y-2">
              <span className="text-[10px] font-bold text-[#FF4444] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Kockázati Értékelés & Slippage
              </span>
              <p className="text-xs text-[#CCCCCC] leading-relaxed">{analysis.riskAssessment}</p>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="bg-[#0D0D0D] border border-[#222222] rounded p-5 space-y-3">
            <h3 className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#00FF41]" /> Cselekvési Terv & Optimális Paraméter Beállítások
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {analysis.recommendations?.map((rec, i) => (
                <div key={i} className="p-3 bg-[#111111] rounded border border-[#222222] text-xs text-[#CCCCCC] flex items-start gap-2">
                  <span className="w-4 h-4 rounded bg-[#112211] text-[#00FF41] font-bold text-[10px] flex items-center justify-center shrink-0 border border-[#004411]">
                    {i + 1}
                  </span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        !loading && (
          <div className="bg-[#0D0D0D] border border-[#222222] border-dashed rounded p-12 text-center space-y-3 font-mono">
            <Cpu className="w-8 h-8 text-[#555555] mx-auto" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#E0E0E0]">Kattints a "Diagnosztika Indítása" gombra!</h3>
            <p className="text-[11px] text-[#666666] max-w-md mx-auto">
              A szerveroldali Gemini 3.6 Flash modell kiértékeli a futási statisztikákat, a hálózati jittert, az L2 slippage-t és javaslatot tesz a co-location paraméterekre.
            </p>
          </div>
        )
      )}
    </div>
  );
};

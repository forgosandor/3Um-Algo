import React, { useEffect } from 'react';
import { useTradeStore } from './store/useTradeStore';
import { Navbar } from './components/Navbar';
import { WhisperBanner } from './components/WhisperBanner';
import { CandleChart } from './components/CandleChart';
import { LimitOrderBook } from './components/LimitOrderBook';
import { OrderPanel } from './components/OrderPanel';
import { WhispersView } from './components/WhispersView';
import { LimitOrderBookView } from './components/LimitOrderBookView';
import { TradeJournalView } from './components/TradeJournalView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { AutonomousEnginePanel } from './components/AutonomousEnginePanel';

export default function App() {
  const activeTab = useTradeStore(state => state.activeTab);
  const initWebSocket = useTradeStore(state => state.initWebSocket);

  useEffect(() => {
    initWebSocket();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col font-mono selection:bg-blue-600 selection:text-white">
      
      {/* Fixed High-Performance Navigation Bar */}
      <Navbar />

      {/* Dynamic Suttogó (TradeWhisperer) Top Floating Banner */}
      <WhisperBanner />

      {/* Main Container Views */}
      <main className="flex-1 pb-12">
        {activeTab === 'terminal' && (
          <div className="p-3 max-w-[1900px] mx-auto space-y-3">
            {/* Autonomous Engine Telemetry & Live Control Bar */}
            <AutonomousEnginePanel />

            {/* Main Grid View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Main Interactive Candle Chart & Indicators */}
              <div className="lg:col-span-6 space-y-3">
                <CandleChart />
              </div>

              {/* In-Memory Order Book */}
              <div className="lg:col-span-3">
                <LimitOrderBook />
              </div>

              {/* Order Execution & Position Management Panel */}
              <div className="lg:col-span-3">
                <OrderPanel />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'whispers' && <WhispersView />}

        {activeTab === 'orderbook' && <LimitOrderBookView />}

        {activeTab === 'journal' && <TradeJournalView />}

        {activeTab === 'analytics' && <AnalyticsView />}

        {activeTab === 'profile' && <SettingsView />}
      </main>

      {/* Bottom Status Bar */}
      <footer className="border-t border-[#1a1a1a] bg-[#0a0a0a] text-slate-500 text-[11px] px-4 py-2 flex flex-wrap items-center justify-between font-mono">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Matching Engine: Ready (0.08ms Latency)</span>
          </span>
          <span className="text-slate-400">WebSocket Stream: Connected (1000ms tick)</span>
          <span className="text-slate-400">Scikit-learn Decision Tree: Loaded</span>
        </div>
        <div>
          <span className="text-slate-500">AlgoMentor (TradeWhisperer) v2.5 HFT Edition • Zero-Latency Trading Platform</span>
        </div>
      </footer>

    </div>
  );
}

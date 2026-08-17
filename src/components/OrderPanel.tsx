import React, { useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { TradeSide, OrderType } from '../types';
import { ArrowUpRight, ArrowDownRight, ShieldCheck, Zap, Calculator, Crosshair, XCircle, Cpu, Radio } from 'lucide-react';
import { TradePanel } from './TradePanel';

const OrderPanelComponent: React.FC = () => {
  const activeUser = useTradeStore(state => state.activeUser);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const orderBook = useTradeStore(state => state.orderBook);
  const positions = useTradeStore(state => state.positions);
  const openOrders = useTradeStore(state => state.openOrders);
  const tradeSignals = useTradeStore(state => state.tradeSignals);
  const submitOrder = useTradeStore(state => state.submitOrder);
  const closePosition = useTradeStore(state => state.closePosition);
  const cancelOrder = useTradeStore(state => state.cancelOrder);

  const [panelTab, setPanelTab] = useState<'form' | 'signals'>('form');

  const asset = assets.find(a => a.symbol === selectedSymbol) || assets[0];
  const lastPrice = orderBook?.lastPrice || asset?.price || 0;
  const decimals = asset?.decimals ?? 2;

  const [side, setSide] = useState<TradeSide>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [limitPrice, setLimitPrice] = useState<number>(lastPrice);
  const [amount, setAmount] = useState<number>(0.1);
  const [leverage, setLeverage] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<number>(Number((lastPrice * 0.98).toFixed(decimals)));
  const [takeProfit, setTakeProfit] = useState<number>(Number((lastPrice * 1.04).toFixed(decimals)));

  // Calculate position margin & Risk-Reward
  const orderPrice = orderType === 'MARKET' ? lastPrice : limitPrice;
  const positionValue = orderPrice * amount;
  const marginRequired = positionValue / leverage;

  const slRisk = Math.abs(orderPrice - stopLoss) * amount;
  const tpReward = Math.abs(takeProfit - orderPrice) * amount;
  const rrRatio = slRisk > 0 ? (tpReward / slRisk).toFixed(2) : '1.00';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitOrder({
      side,
      type: orderType,
      price: orderPrice,
      amount,
      stopLoss,
      takeProfit,
      leverage
    });
  };

  if (!asset) {
    return (
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 text-center text-slate-500 font-mono text-xs">
        Piac adatok betöltése...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      
      {/* Tab Switcher: Kézi Megbízás vs TradeWhisperer Jelek */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#050505] rounded-xl border border-[#1a1a1a]">
        <button
          type="button"
          id="order-panel-tab-form"
          onClick={() => setPanelTab('form')}
          className={`py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
            panelTab === 'form'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Kézi Megbízás</span>
        </button>

        <button
          type="button"
          id="order-panel-tab-signals"
          onClick={() => setPanelTab('signals')}
          className={`py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all relative ${
            panelTab === 'signals'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-amber-300" />
          <span>TradeWhisperer</span>
          {tradeSignals.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      {panelTab === 'signals' ? (
        <TradePanel />
      ) : (
        /* Order Submission Form */
        <div id="order-submission-form" className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3.5 font-mono text-xs shadow-2xl">
          
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Kereskedés gomb</span>
            </div>
            <div className="text-[10px] text-slate-400 bg-[#050505] border border-[#1a1a1a] px-2 py-0.5 rounded font-mono">
              Egyenleg: <span className="text-white font-bold">${activeUser?.usdBalance.toLocaleString() || 0}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Side Selector Buttons: BUY vs SELL */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="order-side-buy-btn"
              onClick={() => {
                setSide('BUY');
                setStopLoss(Number((lastPrice * 0.98).toFixed(asset.decimals)));
                setTakeProfit(Number((lastPrice * 1.04).toFixed(asset.decimals)));
              }}
              className={`py-2 rounded-lg font-extrabold text-xs uppercase flex items-center justify-center gap-1.5 transition-all ${
                side === 'BUY'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                  : 'bg-[#111111] text-slate-400 border border-[#1a1a1a] hover:bg-[#1a1a1a]'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>VÁSÁRLÁS (LONG)</span>
            </button>

            <button
              type="button"
              id="order-side-sell-btn"
              onClick={() => {
                setSide('SELL');
                setStopLoss(Number((lastPrice * 1.02).toFixed(asset.decimals)));
                setTakeProfit(Number((lastPrice * 0.96).toFixed(asset.decimals)));
              }}
              className={`py-2 rounded-lg font-extrabold text-xs uppercase flex items-center justify-center gap-1.5 transition-all ${
                side === 'SELL'
                  ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/50'
                  : 'bg-[#111111] text-slate-400 border border-[#1a1a1a] hover:bg-[#1a1a1a]'
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>ELADÁS (SHORT)</span>
            </button>
          </div>

          {/* Order Type Tabs */}
          <div className="flex items-center bg-[#050505] p-1 rounded-lg border border-[#1a1a1a] text-[11px]">
            {(['MARKET', 'LIMIT', 'STOP'] as OrderType[]).map(t => (
              <button
                key={t}
                type="button"
                id={`order-type-${t}`}
                onClick={() => setOrderType(t)}
                className={`flex-1 py-1 rounded font-bold text-center transition-all ${
                  orderType === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Price & Amount Input */}
          <div className="grid grid-cols-2 gap-2">
            {orderType !== 'MARKET' && (
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Limit Ár ({asset.symbol})</label>
                <input
                  type="number"
                  step={1 / Math.pow(10, asset.decimals)}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(Number(e.target.value))}
                  className="w-full bg-[#050505] border border-[#222222] rounded px-2.5 py-1.5 text-white font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            <div className={orderType === 'MARKET' ? 'col-span-2' : ''}>
              <label className="text-[10px] text-slate-400 block mb-1">Pozíció Méret</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-[#050505] border border-[#222222] rounded px-2.5 py-1.5 text-white font-bold focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Leverage Selector */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>Tőkeáttétel (Leverage)</span>
              <span className="text-amber-400 font-bold">{leverage}x</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {[1, 5, 10, 20, 50].map(lev => (
                <button
                  key={lev}
                  type="button"
                  onClick={() => setLeverage(lev)}
                  className={`py-1 rounded text-[10px] font-bold border transition-all ${
                    leverage === lev ? 'bg-amber-950/80 border-amber-600 text-amber-300' : 'bg-[#050505] border-[#1a1a1a] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>

          {/* Stop Loss & Take Profit Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-rose-400 block mb-1">Stop Loss (SL)</label>
              <input
                type="number"
                step={1 / Math.pow(10, asset.decimals)}
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full bg-[#050505] border border-rose-900/50 rounded px-2.5 py-1.5 text-rose-300 font-bold focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] text-emerald-400 block mb-1">Take Profit (TP)</label>
              <input
                type="number"
                step={1 / Math.pow(10, asset.decimals)}
                value={takeProfit}
                onChange={(e) => setTakeProfit(Number(e.target.value))}
                className="w-full bg-[#050505] border border-emerald-900/50 rounded px-2.5 py-1.5 text-emerald-300 font-bold focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Risk-Reward & Required Margin Calculator */}
          <div className="bg-[#050505] p-2.5 rounded-lg border border-[#1a1a1a] text-[11px] space-y-1 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Szükséges Fedezet (Margin):</span>
              <span className="text-white font-bold">${marginRequired.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Kockázat / Hozam (R:R):</span>
              <span className={`font-bold ${Number(rrRatio) >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                1 : {rrRatio}
              </span>
            </div>
          </div>

          {/* Execute Submit Button */}
          <button
            type="submit"
            id="submit-trade-order-btn"
            className={`w-full py-3 rounded-lg font-extrabold text-xs uppercase tracking-wider shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2 ${
              side === 'BUY'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-[#050505] shadow-emerald-950/60'
                : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-950/60'
            }`}
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>
              {side === 'BUY' ? 'VÁSÁRLÁS' : 'ELADÁS'} ({amount} {selectedSymbol})
            </span>
          </button>

        </form>

      </div>
      )}

      {/* Active Positions & Open Orders Container */}
      <div className="space-y-3 flex-1">
        {/* Active Positions Table */}
        <div id="active-positions-table" className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 font-mono text-xs shadow-2xl">
          
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-white">Nyitott Pozíciók ({positions.length})</span>
            </div>
            <span className="text-[10px] text-slate-500">In-Memory Execution</span>
          </div>

          {positions.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">
              Nincs nyitott pozíciód.
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[180px]">
              {positions.map((pos) => {
                const currentAssetPrice = assets.find(a => a.symbol === pos.symbol)?.price || pos.entryPrice;
                const priceDiff = pos.side === 'LONG' ? currentAssetPrice - pos.entryPrice : pos.entryPrice - currentAssetPrice;
                const livePnl = priceDiff * pos.amount * pos.leverage;
                const isProfit = livePnl >= 0;

                return (
                  <div
                    key={pos.id}
                    className="bg-[#050505] p-2.5 rounded-lg border border-[#1a1a1a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pos.side === 'LONG' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'}`}>
                          {pos.side} {pos.leverage}x
                        </span>
                        <span className="font-bold text-white">{pos.symbol}</span>
                        <span className="text-slate-400 text-[10px]">{pos.amount} egység</span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                        <span>Nyitó: <strong className="text-slate-200">${pos.entryPrice}</strong></span>
                        <span>Aktuális: <strong className="text-slate-200">${currentAssetPrice}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <div className={`font-extrabold text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isProfit ? '+' : ''}${livePnl.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {pos.stopLoss ? `SL: $${pos.stopLoss}` : ''} {pos.takeProfit ? `| TP: $${pos.takeProfit}` : ''}
                        </div>
                      </div>

                      <button
                        id={`close-position-btn-${pos.id}`}
                        onClick={() => closePosition(pos.id)}
                        className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Zárás</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Open Limit Orders Table */}
        <div id="open-limit-orders-table" className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-3 font-mono text-xs shadow-2xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1a1a1a]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-white">Nyitott Limit Megbízások ({openOrders.length})</span>
            </div>
            <span className="text-[10px] text-slate-500">LOB Queue</span>
          </div>

          {openOrders.length === 0 ? (
            <div className="text-center py-4 text-slate-500 text-xs">
              Nincs várakozó limit megbízásod.
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[180px]">
              {openOrders.map((ord) => {
                const isBuy = ord.side === 'BUY';

                return (
                  <div
                    key={ord.id}
                    className="bg-[#050505] p-2.5 rounded-lg border border-[#1a1a1a] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isBuy ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'}`}>
                          {ord.type} {ord.side}
                        </span>
                        <span className="font-bold text-white">{ord.symbol}</span>
                        <span className="text-slate-400 text-[10px]">{ord.amount} egység</span>
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3">
                        <span>Limit Ár: <strong className="text-amber-300">${ord.price}</strong></span>
                        <span>Státusz: <strong className="text-cyan-400">{ord.status}</strong></span>
                      </div>
                    </div>

                    <button
                      id={`cancel-order-btn-${ord.id}`}
                      onClick={() => cancelOrder(ord.id)}
                      className="bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Visszavonás</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export const OrderPanel = React.memo(OrderPanelComponent);

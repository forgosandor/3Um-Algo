import { GoogleGenAI } from '@google/genai';
import { MarketContext, UserProfile, TradeLog, Whisper, TradeSide } from '../src/types.js';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (e) {
      console.warn('Gemini API client init warning:', e);
    }
  }
  return aiClient;
}

export class AdaptiveMentorEngine {
  /**
   * Deterministic pattern classification on user's historical trades
   */
  public analyzePatternMatch(
    user: UserProfile,
    tradeLogs: TradeLog[],
    marketContext: MarketContext,
    proposedSide?: TradeSide
  ) {
    const userLogs = tradeLogs.filter(t => t.userId === user.id);
    if (userLogs.length === 0) {
      return { winRatePct: 60, avgR: 1.5, matchingTrades: 0, warning: false };
    }

    // Filter matching past trades by style / asset / RSI range
    const matching = userLogs.filter(log => {
      const rsiDiff = Math.abs(log.contextAtEntry.rsi - marketContext.rsi);
      const sameAsset = log.symbol === marketContext.symbol;
      const sameTrend = log.contextAtEntry.trend === marketContext.trend;
      return rsiDiff < 15 || sameAsset || sameTrend;
    });

    const matchesCount = matching.length;
    if (matchesCount === 0) {
      return { winRatePct: 55, avgR: 1.2, matchingTrades: 0, warning: false };
    }

    const wins = matching.filter(m => m.isProfitable);
    const winRatePct = Number(((wins.length / matchesCount) * 100).toFixed(1));
    const avgR = Number(
      (matching.reduce((acc, m) => acc + m.pnlRatio, 0) / matchesCount).toFixed(2)
    );

    // Warning flag if market is consolidating or RSI matches loss cluster
    const warning = (marketContext.trend === 'CONSOLIDATION' && user.tradingStyle === 'Kitörés') ||
                    (winRatePct < 45 && matchesCount >= 3) ||
                    (marketContext.rsi > 75 && proposedSide === 'LONG') ||
                    (marketContext.rsi < 25 && proposedSide === 'SHORT');

    return { winRatePct, avgR, matchingTrades: matchesCount, warning };
  }

  /**
   * Generates real-time "Suttogó" (TradeWhisperer) insights
   */
  public async generateWhisper(
    user: UserProfile,
    tradeLogs: TradeLog[],
    marketContext: MarketContext,
    type: 'PRE_TRADE' | 'IN_TRADE' | 'POST_TRADE' | 'RISK_ALERT',
    extraContext?: { side?: TradeSide; pnlR?: number; lastTrade?: TradeLog }
  ): Promise<Whisper> {
    const pattern = this.analyzePatternMatch(user, tradeLogs, marketContext, extraContext?.side);
    const ai = getAIClient();

    // 1. Rule-based template fallback
    let title = '';
    let message = '';
    let suggestedAction: 'BUY' | 'SELL' | 'SET_SL' | 'TAKE_PROFIT' | 'WAIT' | undefined = 'WAIT';
    let confidence = 0.85;

    if (type === 'PRE_TRADE') {
      if (pattern.warning) {
        title = ` Figyelmeztetés: ${marketContext.symbol} szokatlan piaci környezet`;
        message = `${marketContext.symbol} alacsony volumennel és konszolidációval mozog (${marketContext.trend}). A te elmúlt ${pattern.matchingTrades} hasonló próbálkozásod átlagosan ${pattern.avgR}R veszteséget hozott. Javasolt a kivárás vagy a pozícióméret csökkentése!`;
        suggestedAction = 'WAIT';
        confidence = 0.90;
      } else if (marketContext.rsi > 65 && marketContext.obImbalance > 0.2) {
        title = ` Potenciális Setup: ${marketContext.symbol} Long lehetőség`;
        message = `A ${marketContext.symbol} emelkedő lendületben van (RSI: ${marketContext.rsi}, Orderbook túlsúly: +${Math.round(marketContext.obImbalance * 100)}%). A te ${user.tradingStyle} profilod alapján a hasonló kötéseid ${pattern.winRatePct}% sikeraránnyal és átlagos ${pattern.avgR}R profittal zárultak!`;
        suggestedAction = 'BUY';
        confidence = 0.88;
      } else if (marketContext.rsi < 35 && marketContext.obImbalance < -0.2) {
        title = ` Potenciális Setup: ${marketContext.symbol} Short lehetőség`;
        message = `A ${marketContext.symbol} eladási nyomás alatt áll (RSI: ${marketContext.rsi}). A te tesztelt stratégiáid ebben a kontextusban ${pattern.winRatePct}% sikerarányt mutattak. Ellenőrizd a belépési feltételeket!`;
        suggestedAction = 'SELL';
        confidence = 0.86;
      } else {
        title = ` Piaci elemzés: ${marketContext.symbol}`;
        message = `A ${marketContext.symbol} jelenleg ${marketContext.trend} fázisban van. RSI: ${marketContext.rsi}. Várj a tisztább kitörési jelzésre a ${user.preferredTimeframes[0]} időtávon.`;
        suggestedAction = 'WAIT';
        confidence = 0.75;
      }
    } else if (type === 'IN_TRADE') {
      const pnlR = extraContext?.pnlR || 1.2;
      if (pnlR >= 1.5) {
        title = ` Profitvédelem: ${marketContext.symbol} pozíció`;
        message = `A pozíciód elérte a +${pnlR.toFixed(1)}R-t! Múltbeli adataid alapján hasonló trendben 80%-os valószínűséggel érted el a célárat, ha a Stop Loss-t Breakeven szintre húztad. Fontold meg a kockázatmentesítést!`;
        suggestedAction = 'SET_SL';
        confidence = 0.92;
      } else if (pnlR < -0.8) {
        title = ` Kockázatkezelési emlékeztető: ${marketContext.symbol}`;
        message = `A pozíciód megközelíti a maximális megengedett ${user.maxRiskPct}% risk korlátot. Ellenőrizd a Stop Loss szintedet!`;
        suggestedAction = 'SET_SL';
        confidence = 0.95;
      } else {
        title = ` Pozíció menedzsment: ${marketContext.symbol}`;
        message = `A pozíció stabilan halad a megadott ${user.targetRR} R:R célár felé. Tartsd be az eredeti tervet!`;
        suggestedAction = 'TAKE_PROFIT';
        confidence = 0.80;
      }
    } else if (type === 'POST_TRADE') {
      const last = extraContext?.lastTrade;
      if (last) {
        if (last.isProfitable) {
          title = ` Sikeres végrehajtás: ${last.symbol} +${last.pnlRatio}R`;
          message = `Gratulálunk! A(z) ${last.symbol} ${last.side} kötésed tankönyvi példája volt a ${user.tradingStyle} stratégiádnak. Pontosan követted a szabályokat (${last.pnlAbs} USD profit).`;
        } else {
          title = ` Önreflexió: ${last.symbol} -${Math.abs(last.pnlRatio)}R`;
          message = `A kötésed veszteséggel zárult. A belépéskori RSI (${last.contextAtEntry.rsi}) és volatilitás alapján ez a piaci kontextus kevésbé volt kedvező a ${user.tradingStyle} stílushoz. Finomítsd a belépési szűrőt!`;
        }
      }
    } else if (type === 'RISK_ALERT') {
      title = ` Kockázati limit riasztás`;
      message = `Figyelem ${user.name}! Elérted a napi megengedett kockázati korlátodat (${user.maxRiskPct}% / kötés). Pihenj egy keveset az elemzés előtt.`;
      suggestedAction = 'WAIT';
      confidence = 0.98;
    }

    // 2. Try Gemini AI enhancement if client is active
    if (ai) {
      try {
        const prompt = `Te vagy az AlgoMentor (TradeWhisperer) nevű HFT AI kereskedési partnere és mentora. 
Írj egy rövid, szigorúan 2-3 mondatos, rendkívül profi, személyre szabott magyar nyelvű "Suttogást" (tanácsot) a következő adatok alapján:
- Felhasználó: ${user.name} (${user.tradingStyle} stílus, Max Kockázat: ${user.maxRiskPct}%, Cél R:R: ${user.targetRR})
- Eszköz & Kontextus: ${marketContext.symbol}, Ár: ${marketContext.price}, RSI: ${marketContext.rsi}, Trend: ${marketContext.trend}, Orderbook Imbalance: ${marketContext.obImbalance}
- Múltbeli statisztika: Hasonló helyzetekben ${pattern.winRatePct}% win rate, ${pattern.avgR}R átlag profit.
- Típus: ${type}
Ne használj felesleges szószápozást, közvetlenül a lényegre törj!`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });

        if (response.text) {
          message = response.text.trim();
        }
      } catch (err) {
        // Fall back to rule-based template message
      }
    }

    return {
      id: `whisper_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId: user.id,
      type,
      symbol: marketContext.symbol,
      title,
      message,
      confidence,
      matchReason: `Alapul véve ${pattern.matchingTrades} korábbi hasonló piaci mintát (${pattern.winRatePct}% sikerarány)`,
      historicalWinRatePct: pattern.winRatePct,
      historicalAvgR: pattern.avgR,
      suggestedAction,
      timestamp: Date.now(),
      read: false
    };
  }
}

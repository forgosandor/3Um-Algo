import { z } from 'zod';

export const SubscribeSymbolSchema = z.object({
  type: z.literal('SUBSCRIBE_SYMBOL'),
  symbol: z.string()
});

export const SetActiveFeedSourceSchema = z.object({
  type: z.literal('SET_ACTIVE_FEED_SOURCE'),
  source: z.union([z.literal('binance'), z.literal('kucoin')])
});

export const SubmitOrderSchema = z.object({
  type: z.literal('SUBMIT_ORDER'),
  order: z.object({
    id: z.string(),
    userId: z.string(),
    symbol: z.string(),
    side: z.union([z.literal('BUY'), z.literal('SELL'), z.literal('LONG'), z.literal('SHORT')]),
    type: z.union([z.literal('MARKET'), z.literal('LIMIT'), z.literal('STOP')]),
    price: z.number(),
    amount: z.number().positive(),
    filled: z.number(),
    status: z.union([z.literal('OPEN'), z.literal('FILLED'), z.literal('CANCELLED'), z.literal('PARTIAL')]),
    timestamp: z.number(),
    stopLoss: z.number().optional(),
    takeProfit: z.number().optional(),
    leverage: z.number().optional()
  })
});

export const ClosePositionSchema = z.object({
  type: z.literal('CLOSE_POSITION'),
  userId: z.string(),
  positionId: z.string()
});

export const GenerateWhisperSchema = z.object({
  type: z.literal('GENERATE_WHISPER'),
  userId: z.string().optional(),
  symbol: z.string().optional()
});

export const UpdateRiskLimitsSchema = z.object({
  type: z.literal('UPDATE_RISK_LIMITS'),
  limits: z.object({
    maxOrderValueUsd: z.number(),
    maxOrderQty: z.number(),
    priceCollarPct: z.number(),
    maxLeverage: z.number(),
    maxDailyLossPct: z.number(),
    rateLimitPerSecond: z.number(),
    washTradingPrevention: z.boolean()
  })
});

export const ClearRiskLogsSchema = z.object({
  type: z.literal('CLEAR_RISK_LOGS')
});

export const ExecuteBacktestSchema = z.object({
  type: z.literal('EXECUTE_BACKTEST'),
  params: z.object({
    symbol: z.string(),
    startingBalance: z.number(),
    timeframe: z.string().optional(),
    strategy: z.string().optional(),
    leverage: z.number().optional(),
    kellyFraction: z.number().optional(),
    stopLossPct: z.number().optional(),
    takeProfitMultiplier: z.number().optional(),
    ofiThreshold: z.number().optional(),
    ofiWindow: z.number().optional()
  }),
  regime: z.string().optional()
});

export const ToggleMarketMakerSchema = z.object({
  type: z.literal('TOGGLE_MARKET_MAKER'),
  enabled: z.boolean().optional()
});

export const UpdateMarketMakerConfigSchema = z.object({
  type: z.literal('UPDATE_MARKET_MAKER_CONFIG'),
  config: z.object({
    enabled: z.boolean().optional(),
    targetSpreadBps: z.number().optional(),
    depthLevels: z.number().optional(),
    orderSizeBase: z.number().optional(),
    inventoryLimit: z.number().optional(),
    skewFactor: z.number().optional(),
    updateIntervalMs: z.number().optional()
  })
});

export const CancelOrderSchema = z.object({
  type: z.literal('CANCEL_ORDER'),
  orderId: z.string(),
  symbol: z.string().optional(),
  userId: z.string().optional()
});

export const GetTradeSignalsSchema = z.object({
  type: z.literal('GET_TRADE_SIGNALS')
});

export const DirectBuyOrderSchema = z.object({
  type: z.literal('BUY'),
  orderType: z.string().optional(),
  userId: z.string().optional(),
  symbol: z.string(),
  amount: z.union([z.number(), z.string()])
});

export const DirectSellOrderSchema = z.object({
  type: z.literal('SELL'),
  orderType: z.string().optional(),
  userId: z.string().optional(),
  symbol: z.string(),
  amount: z.union([z.number(), z.string()])
});

export const AuthenticateSessionSchema = z.object({
  type: z.literal('AUTHENTICATE_SESSION'),
  userId: z.string(),
  token: z.string().optional()
});

export const CreateUserSchema = z.object({
  type: z.literal('CREATE_USER'),
  name: z.string().min(2),
  email: z.string().email().optional(),
  tradingStyle: z.string().optional(),
  initialDepositUsd: z.number().positive().optional()
});

export const UpdateUserProfileSchema = z.object({
  type: z.literal('UPDATE_USER_PROFILE'),
  userId: z.string(),
  profile: z.record(z.string(), z.any())
});

export const IncomingWSMessageSchema = z.discriminatedUnion('type', [
  SubscribeSymbolSchema,
  SetActiveFeedSourceSchema,
  SubmitOrderSchema,
  ClosePositionSchema,
  GenerateWhisperSchema,
  UpdateRiskLimitsSchema,
  ClearRiskLogsSchema,
  ExecuteBacktestSchema,
  ToggleMarketMakerSchema,
  UpdateMarketMakerConfigSchema,
  CancelOrderSchema,
  GetTradeSignalsSchema,
  DirectBuyOrderSchema,
  DirectSellOrderSchema,
  AuthenticateSessionSchema,
  CreateUserSchema,
  UpdateUserProfileSchema
]);

import protobuf from 'protobufjs';

// Protobuf schema definition for HFT binary stream
const protoSchema = `
syntax = "proto3";

package hft;

message OrderBookLevel {
  double price = 1;
  double amount = 2;
}

message OrderBookSnapshot {
  string symbol = 1;
  double lastPrice = 2;
  int64 timestamp = 3;
  repeated OrderBookLevel bids = 4;
  repeated OrderBookLevel asks = 5;
}

message TradeExecution {
  string tradeId = 1;
  string symbol = 2;
  string side = 3;
  double price = 4;
  double amount = 5;
  string buyerId = 6;
  string sellerId = 7;
  int64 timestamp = 8;
  double executionTimeMs = 9;
}

message MarketPriceTick {
  string symbol = 1;
  double price = 2;
  double change24h = 3;
  double volume24h = 4;
  int64 timestamp = 5;
}

message BinaryPacket {
  enum PacketType {
    LOB_SNAPSHOT = 0;
    TRADE_EXECUTION = 1;
    MARKET_TICK = 2;
    SYSTEM_ALERT = 3;
  }
  
  PacketType type = 1;
  bytes payload = 2;
}
`;

let root: protobuf.Root;
let BinaryPacketType: protobuf.Type;
let LOBType: protobuf.Type;
let TradeType: protobuf.Type;
let TickType: protobuf.Type;

try {
  root = protobuf.parse(protoSchema).root;
  BinaryPacketType = root.lookupType('hft.BinaryPacket');
  LOBType = root.lookupType('hft.OrderBookSnapshot');
  TradeType = root.lookupType('hft.TradeExecution');
  TickType = root.lookupType('hft.MarketPriceTick');
  console.log('⚡ [PROTOBUF ENGINE] Binary Protocol Compiled Successfully');
} catch (err) {
  console.error('❌ Failed to compile Protobuf schema:', err);
}

export class BinaryCodec {
  public static encodeLOB(symbol: string, lastPrice: number, bids: [number, number][], asks: [number, number][]): Buffer {
    if (!LOBType || !BinaryPacketType) return Buffer.from(JSON.stringify({ symbol, lastPrice, bids, asks }));

    const lobMsg = LOBType.create({
      symbol,
      lastPrice,
      timestamp: Date.now(),
      bids: bids.map(([price, amount]) => ({ price, amount })),
      asks: asks.map(([price, amount]) => ({ price, amount }))
    });

    const payload = LOBType.encode(lobMsg).finish();

    const packet = BinaryPacketType.create({
      type: 0, // LOB_SNAPSHOT
      payload
    });

    return Buffer.from(BinaryPacketType.encode(packet).finish());
  }

  public static encodeTrade(trade: {
    id: string;
    symbol: string;
    side: string;
    price: number;
    amount: number;
    buyerId?: string;
    sellerId?: string;
    executionTimeMs?: number;
  }): Buffer {
    if (!TradeType || !BinaryPacketType) return Buffer.from(JSON.stringify(trade));

    const tradeMsg = TradeType.create({
      tradeId: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      price: trade.price,
      amount: trade.amount,
      buyerId: trade.buyerId || '',
      sellerId: trade.sellerId || '',
      timestamp: Date.now(),
      executionTimeMs: trade.executionTimeMs || 0.1
    });

    const payload = TradeType.encode(tradeMsg).finish();

    const packet = BinaryPacketType.create({
      type: 1, // TRADE_EXECUTION
      payload
    });

    return Buffer.from(BinaryPacketType.encode(packet).finish());
  }

  public static encodePriceTick(symbol: string, price: number, change24h: number = 0, volume24h: number = 0): Buffer {
    if (!TickType || !BinaryPacketType) return Buffer.from(JSON.stringify({ symbol, price }));

    const tickMsg = TickType.create({
      symbol,
      price,
      change24h,
      volume24h,
      timestamp: Date.now()
    });

    const payload = TickType.encode(tickMsg).finish();

    const packet = BinaryPacketType.create({
      type: 2, // MARKET_TICK
      payload
    });

    return Buffer.from(BinaryPacketType.encode(packet).finish());
  }

  public static decodePacket(buffer: Uint8Array): { type: string; payload: any } | null {
    try {
      if (!BinaryPacketType) return null;
      const packet = BinaryPacketType.decode(buffer) as any;
      
      if (packet.type === 0) {
        const lob = LOBType.decode(packet.payload) as any;
        return { type: 'LOB_SNAPSHOT', payload: LOBType.toObject(lob) };
      } else if (packet.type === 1) {
        const tr = TradeType.decode(packet.payload) as any;
        return { type: 'TRADE_EXECUTION', payload: TradeType.toObject(tr) };
      } else if (packet.type === 2) {
        const tick = TickType.decode(packet.payload) as any;
        return { type: 'MARKET_TICK', payload: TickType.toObject(tick) };
      }
      return null;
    } catch (err) {
      console.warn('[BinaryCodec] Decode failed, falling back:', err);
      return null;
    }
  }
}

import protobuf from 'protobufjs/light';

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

let BinaryPacketType: protobuf.Type | null = null;
let LOBType: protobuf.Type | null = null;
let TradeType: protobuf.Type | null = null;
let TickType: protobuf.Type | null = null;

try {
  const root = protobuf.parse(protoSchema).root;
  BinaryPacketType = root.lookupType('hft.BinaryPacket');
  LOBType = root.lookupType('hft.OrderBookSnapshot');
  TradeType = root.lookupType('hft.TradeExecution');
  TickType = root.lookupType('hft.MarketPriceTick');
} catch (e) {
  console.warn('[ClientBinaryCodec] Failed to parse browser protobuf schema:', e);
}

export function decodeWSBinaryMessage(data: ArrayBuffer | Uint8Array): { type: string; data: any } | null {
  try {
    const uint8 = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    if (!BinaryPacketType || !LOBType || !TradeType || !TickType) return null;

    const packet = BinaryPacketType.decode(uint8) as any;

    if (packet.type === 0 && LOBType) {
      const lob = LOBType.decode(packet.payload) as any;
      const obj = LOBType.toObject(lob, { defaults: true });
      return {
        type: 'ORDER_BOOK_UPDATE',
        data: {
          symbol: obj.symbol,
          lastPrice: obj.lastPrice,
          bids: (obj.bids || []).map((b: any) => [String(b.price), String(b.amount)]),
          asks: (obj.asks || []).map((a: any) => [String(a.price), String(a.amount)])
        }
      };
    } else if (packet.type === 1 && TradeType) {
      const tr = TradeType.decode(packet.payload) as any;
      const obj = TradeType.toObject(tr, { defaults: true });
      return {
        type: 'ORDER_EXECUTED',
        data: {
          execution: {
            tradeId: obj.tradeId,
            symbol: obj.symbol,
            side: obj.side,
            price: obj.price,
            amount: obj.amount,
            executionTimeMs: obj.executionTimeMs
          }
        }
      };
    } else if (packet.type === 2 && TickType) {
      const tick = TickType.decode(packet.payload) as any;
      const obj = TickType.toObject(tick, { defaults: true });
      return {
        type: 'PRICE_UPDATE',
        data: {
          symbol: obj.symbol,
          price: obj.price
        }
      };
    }
  } catch (err) {
    // Silent catch, fallback to JSON
  }
  return null;
}

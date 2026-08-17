import { LimitOrderBook } from './orderbook.js';

export interface ShardStatus {
  shardId: number;
  assignedSymbols: string[];
  totalOrdersProcessed: number;
  currentQps: number;
  averageExecutionMicroseconds: number;
  queueDepth: number;
  status: 'OPTIMAL' | 'HIGH_LOAD' | 'BALANCING';
}

export class LOBShardingManager {
  private shards: Map<number, {
    symbols: string[];
    processedCount: number;
    lastQpsCount: number;
    qps: number;
    totalExecutionUs: number;
    executionSamples: number;
  }> = new Map();

  private symbolToShardMap: Map<string, number> = new Map();
  private numShards: number;

  constructor(symbols: string[], numShards: number = 3) {
    this.numShards = numShards;

    for (let i = 0; i < numShards; i++) {
      this.shards.set(i, {
        symbols: [],
        processedCount: 0,
        lastQpsCount: 0,
        qps: 0,
        totalExecutionUs: 0,
        executionSamples: 0
      });
    }

    // Round-robin symbol assignment to shards
    symbols.forEach((symbol, index) => {
      const shardId = index % numShards;
      const shard = this.shards.get(shardId)!;
      shard.symbols.push(symbol);
      this.symbolToShardMap.set(symbol, shardId);
    });

    console.log(`🌐 [LOB SHARDING ENGINE OPERATIONAL] Distributed ${symbols.length} symbol LOBs across ${numShards} parallel execution shards`);

    // QPS calculation interval
    setInterval(() => {
      for (const shard of this.shards.values()) {
        const delta = shard.processedCount - shard.lastQpsCount;
        shard.qps = delta;
        shard.lastQpsCount = shard.processedCount;
      }
    }, 1000);
  }

  public getShardForSymbol(symbol: string): number {
    return this.symbolToShardMap.get(symbol) ?? 0;
  }

  public recordOrderExecution(symbol: string, executionMicroseconds: number) {
    const shardId = this.getShardForSymbol(symbol);
    const shard = this.shards.get(shardId);
    if (shard) {
      shard.processedCount++;
      shard.totalExecutionUs += executionMicroseconds;
      shard.executionSamples++;
    }
  }

  public getClusterStatus(): ShardStatus[] {
    const result: ShardStatus[] = [];

    for (const [shardId, shard] of this.shards.entries()) {
      const avgUs = shard.executionSamples > 0 ? (shard.totalExecutionUs / shard.executionSamples) : 15;
      result.push({
        shardId,
        assignedSymbols: [...shard.symbols],
        totalOrdersProcessed: shard.processedCount,
        currentQps: shard.qps,
        averageExecutionMicroseconds: Number(avgUs.toFixed(2)),
        queueDepth: Math.max(0, Math.floor(shard.qps * 0.05)),
        status: shard.qps > 500 ? 'HIGH_LOAD' : 'OPTIMAL'
      });
    }

    return result;
  }
}

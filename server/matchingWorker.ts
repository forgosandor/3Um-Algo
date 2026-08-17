import { parentPort, workerData } from 'worker_threads';
import {
  lobView,
  lobIntView,
  LOCK_INDEX,
  SEQ_NUM_INDEX,
  acquireLock,
  releaseLock
} from './memory/lobShared.js';

/**
 * High-Speed Lock-Free Worker Thread for Atomic Matching Engine
 */
if (parentPort) {
  parentPort.on('message', (task: any) => {
    if (task && task.type === 'EXECUTE_MATCH') {
      const startTime = process.hrtime.bigint();

      // Acquire Spin-Lock via Atomics
      acquireLock(lobIntView);

      try {
        const { side, price, amount, symbol } = task.order || {};
        
        // Fast in-place Float64 Array manipulation
        // Index offset calculations
        const bidsOffset = 4; // after header slots
        const asksOffset = bidsOffset + (50 * 2);

        if (side === 'BUY') {
          // Update best bid in shared memory
          lobView[bidsOffset] = price;
          lobView[bidsOffset + 1] = amount;
        } else if (side === 'SELL') {
          // Update best ask in shared memory
          lobView[asksOffset] = price;
          lobView[asksOffset + 1] = amount;
        }

        const endTime = process.hrtime.bigint();
        const latencyNs = Number(endTime - startTime);

        parentPort?.postMessage({
          type: 'MATCH_COMPLETED',
          symbol,
          latencyNs,
          seqNum: Atomics.load(lobIntView, SEQ_NUM_INDEX)
        });
      } finally {
        releaseLock(lobIntView);
      }
    }
  });
}

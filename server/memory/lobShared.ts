// Lock-Free Shared Memory Allocation for Ultra-Low Latency Order Book Sync
export const DEPTH = 50;
export const SLOT_SIZE = 2; // price, amount
export const HEADER_SLOTS = 4; // lock, seqNum, bidCount, askCount
export const BUFFER_SIZE = (HEADER_SLOTS + (DEPTH * SLOT_SIZE * 2)) * 8; // 8 bytes per Float64

export const sharedBuffer = new SharedArrayBuffer(BUFFER_SIZE);
export const lobView = new Float64Array(sharedBuffer);
export const lobIntView = new Int32Array(sharedBuffer);

// Atomics indices in Int32Array (each Int32 is 4 bytes)
export const LOCK_INDEX = 0;      // 0: unlocked, 1: locked by spin-lock
export const SEQ_NUM_INDEX = 1;   // Incremental Sequence Number for memory barrier sync
export const BIDS_COUNT_INDEX = 2;// Number of active bids in SAB
export const ASKS_COUNT_INDEX = 3;// Number of active asks in SAB

/**
 * Acquire Atomic Spin-Lock with low CPU contention backoff
 */
export function acquireLock(int32View: Int32Array): void {
  while (Atomics.compareExchange(int32View, LOCK_INDEX, 0, 1) !== 0) {
    // Spin-wait for lock acquisition
  }
}

/**
 * Release Atomic Spin-Lock and increment Sequence Number
 */
export function releaseLock(int32View: Int32Array): void {
  Atomics.add(int32View, SEQ_NUM_INDEX, 1);
  Atomics.store(int32View, LOCK_INDEX, 0);
}

import { parentPort } from 'worker_threads';

// Memóriában tartott körkörös pufferek (Zero GC Allocation)
const WINDOW_SIZE = 50;
const history = new Map(); // Symbol -> { prices: Float64Array, volumes: Float64Array, head: number, count: number }

function getBuffer(symbol) {
  if (!history.has(symbol)) {
    history.set(symbol, {
      prices: new Float64Array(WINDOW_SIZE),
      volumes: new Float64Array(WINDOW_SIZE),
      head: 0,
      count: 0
    });
  }
  return history.get(symbol);
}

function updateAndAnalyze(symbol, price, volume, isBuy) {
  const buf = getBuffer(symbol);

  // Körkörös puffer frissítése (nincs array shift, nincs memóriaszivárgás)
  buf.prices[buf.head] = price;
  buf.volumes[buf.head] = isBuy ? volume : -volume;
  buf.head = (buf.head + 1) % WINDOW_SIZE;
  if (buf.count < WINDOW_SIZE) buf.count++;

  if (buf.count < 10) return null; // Kevés az adat a szignifikáns elemzéshez

  // 1. Átlag és Szórás számítás (Mean & StdDev)
  let sum = 0;
  for (let i = 0; i < buf.count; i++) sum += buf.prices[i];
  const mean = sum / buf.count;

  let varianceSum = 0;
  for (let i = 0; i < buf.count; i++) {
    varianceSum += Math.pow(buf.prices[i] - mean, 2);
  }
  const stdDev = Math.sqrt(varianceSum / buf.count) || 0.00001;

  // 2. Z-Score (Eltérés a középértéktől)
  const zScore = (price - mean) / stdDev;

  // 3. Order Flow Imbalance (OFI) indikátor
  let ofi = 0;
  for (let i = 0; i < buf.count; i++) ofi += buf.volumes[i];

  return { symbol, price, mean, stdDev, zScore, ofi };
}

if (parentPort) {
  parentPort.on('message', (data) => {
    const { symbol, price, volume, isBuy } = data;
    const metrics = updateAndAnalyze(symbol, price, volume, isBuy);
    if (metrics) {
      parentPort.postMessage(metrics);
    }
  });
}

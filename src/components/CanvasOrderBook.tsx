import React, { useRef, useEffect, useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';

interface CanvasOrderBookProps {
  maxRows?: number;
}

export const CanvasOrderBook: React.FC<CanvasOrderBookProps> = ({ maxRows = 8 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const orderBook = useTradeStore(state => state.orderBook);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const asset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  const [dimensions, setDimensions] = useState({ width: 0, height: 350 });
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  // Resize listener to fit canvas layout perfectly
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions(prev => ({ ...prev, width }));
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Main drawing execution loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || !orderBook) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // HiDPI support for crisp text rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const width = dimensions.width;
    const height = dimensions.height;

    // Clean background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    const asks = [...(orderBook.asks || [])].slice(0, maxRows).reverse(); // Reverse to place best ask closest to mid price
    const bids = [...(orderBook.bids || [])].slice(0, maxRows);
    
    const decimals = asset?.decimals || 2;
    const symbolUnit = asset?.category === 'Crypto' ? 'USDT' : 'USD';

    // 1. Column Headers
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Ár (${symbolUnit})`, 8, 14);
    ctx.textAlign = 'right';
    ctx.fillText('Méret', width * 0.6, 14);
    ctx.fillText('Összesen', width - 8, 14);

    // Divider under header
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(width, 20);
    ctx.stroke();

    // Define spacing parameters
    const startY = 22;
    const rowHeight = 17;
    const midPriceRowHeight = 28;

    const maxAskVol = Math.max(...asks.map(a => a?.amount ?? 0), 0.1);
    const maxBidVol = Math.max(...bids.map(b => b?.amount ?? 0), 0.1);

    let currentY = startY;

    // Draw row helper
    const drawRow = (
      index: number,
      price: number,
      amount: number,
      total: number,
      maxVol: number,
      isBid: boolean
    ) => {
      const isHovered = hoveredRowIndex === index;

      // Hover overlay background
      if (isHovered) {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0, currentY, width, rowHeight);
      }

      // Calculate depth percentage bar width
      const barWidth = Math.max(0, Math.min(width, (amount / maxVol) * (width * 0.7)));

      // Draw horizontal depth bar extending from the right
      ctx.fillStyle = isBid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)';
      ctx.fillRect(width - barWidth, currentY + 1, barWidth, rowHeight - 2);

      // Border accent on right for bars
      ctx.fillStyle = isBid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)';
      ctx.fillRect(width - barWidth, currentY + 1, 1, rowHeight - 2);

      // Render values
      ctx.font = '10.5px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = isBid ? '#10b981' : '#f43f5e';
      ctx.fillText(price.toFixed(decimals), 8, currentY + 12);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(amount.toFixed(4), width * 0.6, currentY + 12);

      ctx.fillStyle = '#64748b';
      ctx.fillText(total.toLocaleString(), width - 8, currentY + 12);

      currentY += rowHeight;
    };

    // 2. Draw ASKS (Red side)
    asks.forEach((ask, idx) => {
      drawRow(idx, ask.price, ask.amount, ask.total, maxAskVol, false);
    });

    // 3. Draw MID PRICE Row (Center)
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, currentY, width, midPriceRowHeight);
    
    // Borders for mid-price row
    ctx.strokeStyle = '#161616';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, currentY);
    ctx.lineTo(width, currentY);
    ctx.moveTo(0, currentY + midPriceRowHeight);
    ctx.lineTo(width, currentY + midPriceRowHeight);
    ctx.stroke();

    // Mid Price Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText((orderBook.lastPrice ?? 0).toFixed(decimals), 8, currentY + 18);

    // In-Memory FIFO label
    ctx.font = '9px monospace';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    ctx.fillText('In-Memory Match FIFO', width - 8, currentY + 17);

    currentY += midPriceRowHeight;

    // 4. Draw BIDS (Green side)
    bids.forEach((bid, idx) => {
      drawRow(asks.length + idx, bid.price, bid.amount, bid.total, maxBidVol, true);
    });

    // Adjust container height based on total rows dynamically
    const idealHeight = startY + (asks.length + bids.length) * rowHeight + midPriceRowHeight;
    if (Math.abs(dimensions.height - idealHeight) > 2) {
      setDimensions(prev => ({ ...prev, height: idealHeight }));
    }

  }, [orderBook, dimensions.width, hoveredRowIndex, asset, maxRows]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top;

    const startY = 22;
    const rowHeight = 17;
    const asksCount = Math.min(maxRows, orderBook?.asks?.length ?? 0);
    const midPriceRowHeight = 28;

    if (y < startY) {
      setHoveredRowIndex(null);
      return;
    }

    const relativeY = y - startY;
    const askStackHeight = asksCount * rowHeight;

    if (relativeY < askStackHeight) {
      const idx = Math.floor(relativeY / rowHeight);
      setHoveredRowIndex(idx);
    } else if (relativeY < askStackHeight + midPriceRowHeight) {
      setHoveredRowIndex(null); // mid price row is not hovered
    } else {
      const bidY = relativeY - askStackHeight - midPriceRowHeight;
      const idx = Math.floor(bidY / rowHeight);
      const bidsCount = Math.min(maxRows, orderBook?.bids?.length ?? 0);
      if (idx >= 0 && idx < bidsCount) {
        setHoveredRowIndex(asksCount + idx);
      } else {
        setHoveredRowIndex(null);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredRowIndex(null);
  };

  if (!orderBook) return null;

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${dimensions.height}px`, display: 'block', cursor: 'pointer' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

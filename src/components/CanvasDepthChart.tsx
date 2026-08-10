import React, { useRef, useEffect, useState } from 'react';
import { useTradeStore } from '../store/useTradeStore';
import { Asset } from '../types';

export const CanvasDepthChart: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const orderBook = useTradeStore(state => state.orderBook);
  const selectedSymbol = useTradeStore(state => state.selectedSymbol);
  const assets = useTradeStore(state => state.assets);
  const asset = assets.find(a => a.symbol === selectedSymbol) || assets[0];

  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 260 });

  // Handle resizing of the canvas container dynamically
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

  // Main drawing engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || !orderBook) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adapt to retina displays to ensure ultra-sharp lines (Desktop-First precision)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    const width = dimensions.width;
    const height = dimensions.height;

    // Clear Canvas
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    const bids = [...(orderBook.bids || [])].reverse(); // lower price to highest bid
    const asks = [...(orderBook.asks || [])]; // lowest ask to highest price

    if (bids.length === 0 || asks.length === 0) {
      // Draw placeholder text
      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Nincs elegendő likviditási adat a kirajzoláshoz', width / 2, height / 2);
      return;
    }

    // Determine price range
    const minPrice = bids[0]?.price ?? 0;
    const maxPrice = asks[asks.length - 1]?.price ?? (minPrice * 1.05);
    const priceRange = maxPrice - minPrice;

    // Determine max cumulative volume for Y axis scaling
    const maxCumulative = Math.max(
      bids[0]?.cumulative ?? 0,
      asks[asks.length - 1]?.cumulative ?? 0,
      1
    );

    // Padding for charts
    const paddingLeft = 10;
    const paddingRight = 50; // space for Y axis labels
    const paddingTop = 20;
    const paddingBottom = 25; // space for X axis labels

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Helper: Map Price to Canvas X
    const getX = (price: number) => {
      if (priceRange === 0) return paddingLeft + chartWidth / 2;
      return paddingLeft + ((price - minPrice) / priceRange) * chartWidth;
    };

    // Helper: Map Volume to Canvas Y
    const getY = (volume: number) => {
      return paddingTop + chartHeight - (volume / maxCumulative) * chartHeight;
    };

    // Helper: Map Canvas X back to Price
    const getPriceFromX = (x: number) => {
      const pct = (x - paddingLeft) / chartWidth;
      return minPrice + pct * priceRange;
    };

    // 1. Draw Gridlines
    ctx.strokeStyle = '#151515';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    const gridRows = 4;
    for (let i = 0; i <= gridRows; i++) {
      const y = paddingTop + (i / gridRows) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(paddingLeft + chartWidth, y);
      ctx.stroke();

      // Y-axis Labels (Right side)
      const val = ((gridRows - i) / gridRows) * maxCumulative;
      ctx.fillStyle = '#475569';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(val.toFixed(2), paddingLeft + chartWidth + 6, y + 3);
    }

    // Vertical grid lines
    const gridCols = 5;
    for (let i = 0; i <= gridCols; i++) {
      const x = paddingLeft + (i / gridCols) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, paddingTop + chartHeight);
      ctx.stroke();

      // X-axis Labels (Bottom)
      const prc = getPriceFromX(x);
      ctx.fillStyle = '#475569';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(prc.toFixed(asset.decimals), x, paddingTop + chartHeight + 14);
    }

    // 2. DRAW BIDS (Green Side - Left)
    if (bids.length > 0) {
      ctx.beginPath();
      // Start bottom left of bids
      const firstBidX = getX(bids[0].price);
      ctx.moveTo(firstBidX, getY(0));

      bids.forEach((bid, idx) => {
        const x = getX(bid.price);
        const y = getY(bid.cumulative);
        
        // Draw step-chart style
        if (idx > 0) {
          const prevX = getX(bids[idx - 1].price);
          ctx.lineTo(x, getY(bids[idx - 1].cumulative));
        }
        ctx.lineTo(x, y);
      });

      // Close path to bottom of center spread point
      const midPrice = orderBook.lastPrice;
      const midX = getX(midPrice);
      ctx.lineTo(midX, getY(bids[bids.length - 1].cumulative));
      ctx.lineTo(midX, getY(0));
      ctx.closePath();

      // Fill Green Gradient
      const bidGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
      bidGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      bidGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
      ctx.fillStyle = bidGrad;
      ctx.fill();

      // Stroke Green Border
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      bids.forEach((bid, idx) => {
        const x = getX(bid.price);
        const y = getY(bid.cumulative);
        if (idx > 0) {
          ctx.lineTo(x, getY(bids[idx - 1].cumulative));
        } else {
          ctx.moveTo(x, y);
        }
        ctx.lineTo(x, y);
      });
      // Line to center
      ctx.lineTo(midX, getY(bids[bids.length - 1].cumulative));
      ctx.stroke();
    }

    // 3. DRAW ASKS (Red Side - Right)
    if (asks.length > 0) {
      const midPrice = orderBook.lastPrice;
      const midX = getX(midPrice);

      ctx.beginPath();
      // Start at bottom of mid price
      ctx.moveTo(midX, getY(0));
      ctx.lineTo(midX, getY(asks[0].cumulative));

      asks.forEach((ask, idx) => {
        const x = getX(ask.price);
        const y = getY(ask.cumulative);

        if (idx > 0) {
          ctx.lineTo(x, getY(asks[idx - 1].cumulative));
        }
        ctx.lineTo(x, y);
      });

      // Close path to bottom right
      const lastAskX = getX(asks[asks.length - 1].price);
      ctx.lineTo(lastAskX, getY(0));
      ctx.closePath();

      // Fill Red Gradient
      const askGrad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
      askGrad.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
      askGrad.addColorStop(1, 'rgba(244, 63, 94, 0.02)');
      ctx.fillStyle = askGrad;
      ctx.fill();

      // Stroke Red Border
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(midX, getY(asks[0].cumulative));
      asks.forEach((ask, idx) => {
        const x = getX(ask.price);
        const y = getY(ask.cumulative);
        if (idx > 0) {
          ctx.lineTo(x, getY(asks[idx - 1].cumulative));
        }
        ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // 4. Draw Center Mid Price / Spread Marker
    const midX = getX(orderBook.lastPrice);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#eab308'; // Amber
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(midX, paddingTop);
    ctx.lineTo(midX, paddingTop + chartHeight);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dashed lines

    // Draw Label for Mid Price above
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`MID: $${orderBook.lastPrice.toFixed(asset.decimals)}`, midX, paddingTop - 7);

    // 5. MOUSE INTERACTION & TOOLTIP (0ms Lag Hover Engine)
    if (mousePos && mousePos.x >= paddingLeft && mousePos.x <= paddingLeft + chartWidth && mousePos.y >= paddingTop && mousePos.y <= paddingTop + chartHeight) {
      const hoveredPrice = getPriceFromX(mousePos.x);
      
      // Determine if bid or ask is hovered
      let nearestItem = null;
      let isBid = hoveredPrice <= orderBook.lastPrice;

      if (isBid) {
        // Find nearest bid
        let minDiff = Infinity;
        for (const b of bids) {
          const diff = Math.abs(b.price - hoveredPrice);
          if (diff < minDiff) {
            minDiff = diff;
            nearestItem = b;
          }
        }
      } else {
        // Find nearest ask
        let minDiff = Infinity;
        for (const a of asks) {
          const diff = Math.abs(a.price - hoveredPrice);
          if (diff < minDiff) {
            minDiff = diff;
            nearestItem = a;
          }
        }
      }

      if (nearestItem) {
        const hX = getX(nearestItem.price);
        const hY = getY(nearestItem.cumulative);

        // Hover Crosshair Lines
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(hX, paddingTop);
        ctx.lineTo(hX, paddingTop + chartHeight);
        ctx.stroke();

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(paddingLeft, hY);
        ctx.lineTo(paddingLeft + chartWidth, hY);
        ctx.stroke();

        ctx.setLineDash([]); // Reset

        // Anchor circle on cumulative point
        ctx.fillStyle = isBid ? '#10b981' : '#f43f5e';
        ctx.beginPath();
        ctx.arc(hX, hY, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Render Elegant Canvas Tooltip Box (Avoiding DOM overlay delays!)
        const boxWidth = 145;
        const boxHeight = 55;
        let boxX = hX + 12;
        let boxY = mousePos.y - 65;

        // Keep tooltip box within chart boundaries
        if (boxX + boxWidth > width) {
          boxX = hX - boxWidth - 12;
        }
        if (boxY < paddingTop) {
          boxY = paddingTop + 10;
        }

        // Draw Box Shadow / Background
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#0f172a'; // Deep slate
        ctx.strokeStyle = isBid ? '#10b981' : '#f43f5e';
        ctx.lineWidth = 1.5;
        
        // Rounded Rectangle manually
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6) : ctx.rect(boxX, boxY, boxWidth, boxHeight);
        ctx.fill();
        ctx.stroke();
        
        ctx.shadowColor = 'transparent'; // Reset shadow

        // Tooltip Texts
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = isBid ? '#10b981' : '#f43f5e';
        ctx.textAlign = 'left';
        ctx.fillText(isBid ? '➡ BUY LEVEL (BID)' : '➡ SELL LEVEL (ASK)', boxX + 8, boxY + 14);

        ctx.font = '9px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Ár: `, boxX + 8, boxY + 28);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`$${nearestItem.price.toFixed(asset.decimals)}`, boxX + 45, boxY + 28);

        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Méret: `, boxX + 8, boxY + 39);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${nearestItem.amount.toFixed(4)}`, boxX + 45, boxY + 39);

        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`Kumul: `, boxX + 8, boxY + 50);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`${nearestItem.cumulative.toFixed(2)}`, boxX + 45, boxY + 50);
      }
    }

  }, [orderBook, dimensions, mousePos, asset]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  return (
    <div ref={containerRef} className="w-full bg-[#050505] rounded-xl overflow-hidden relative">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${dimensions.height}px`, display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
};

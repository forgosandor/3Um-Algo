import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, Upload, CheckCircle2, AlertCircle, Shield, Copy, Zap, Eye } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string, parsedData?: any) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ isOpen, onClose, onScanSuccess }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScannedResult, setLastScannedResult] = useState<string | null>(null);
  const [scannedHistory, setScannedHistory] = useState<Array<{ text: string; timestamp: number }>>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setErrorMessage('');
    setHasCameraPermission(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('A kamera API nem támogatott ebben a böngészőben.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        await videoRef.current.play();
        setHasCameraPermission(true);
        requestAnimationFrame(tickScan);
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setHasCameraPermission(false);
      setErrorMessage(
        err.name === 'NotAllowedError'
          ? 'Kamera hozzáférés megtagadva. Kérjük engedélyezze a kamerát a böngésző beállításaiban!'
          : err.message || 'Hiba történt a kamera elindításakor.'
      );
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const tickScan = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current || document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx && videoRef.current) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data && code.data.trim().length > 0) {
          const scannedText = code.data.trim();
          handleScannedCode(scannedText);
          return; // Stop scanning loop on match
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(tickScan);
  };

  const handleScannedCode = (scannedText: string) => {
    setLastScannedResult(scannedText);
    setScannedHistory((prev) => [{ text: scannedText, timestamp: Date.now() }, ...prev.slice(0, 9)]);

    let parsed: any = null;
    try {
      if (scannedText.startsWith('{') && scannedText.endsWith('}')) {
        parsed = JSON.parse(scannedText);
      }
    } catch {
      parsed = null;
    }

    // Trigger parent callback
    onScanSuccess(scannedText, parsed);

    // Vibrate device if supported
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleScannedCode(code.data.trim());
          } else {
            alert('Nem található érvényes QR kód a feltöltött képen.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const toggleCameraFacingMode = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-950/80 border border-emerald-800 rounded-lg text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                QR Kód Beolvasása Kamerával
                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  REALTIME SCAN
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Azonnali API kulcs, nyilvános tárcacím vagy JSON konfiguráció beolvasása.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-slate-100 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport / Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Camera Container */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-slate-800 flex items-center justify-center shadow-inner group">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Live Scan Laser Frame Overlay */}
            {hasCameraPermission && isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                <div className="w-48 h-48 border-2 border-emerald-500/80 rounded-xl relative shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br" />

                  {/* Animated Laser Beam */}
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] absolute top-0 animate-[scan_2s_ease-in-out_infinite]" />
                </div>
              </div>
            )}

            {/* Permission Denied or Loading Fallback */}
            {hasCameraPermission === false && (
              <div className="p-4 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-red-400 mx-auto animate-pulse" />
                <div className="text-xs text-red-300 font-semibold max-w-xs mx-auto">
                  {errorMessage}
                </div>
                <button
                  onClick={startCamera}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Újrapróbálás</span>
                </button>
              </div>
            )}

            {hasCameraPermission === null && (
              <div className="p-4 text-center space-y-2">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                <div className="text-xs text-slate-300 font-mono">
                  Kamera inicializálása & engedélyek ellenőrzése...
                </div>
              </div>
            )}

            {/* Camera Switch Controls Floating Overlay */}
            {hasCameraPermission && (
              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                <button
                  onClick={toggleCameraFacingMode}
                  className="p-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-lg backdrop-blur-sm text-xs font-semibold flex items-center gap-1 shadow-lg"
                  title="Kamera váltása (Előlapi / Hátlapi)"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="text-[10px] uppercase font-mono">{facingMode}</span>
                </button>
              </div>
            )}
          </div>

          {/* Scanner Controls & Fallback File Upload */}
          <div className="flex items-center justify-between gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-300">
              <span className="font-semibold block text-slate-200">Képfájl beolvasása:</span>
              <span className="text-[10px] text-slate-400">Nincs kamera? Töltsön fel QR kódot tartalmazó képet.</span>
            </div>

            <label className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm">
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>Kép feltöltése</span>
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {/* Last Scanned Result Banner */}
          {lastScannedResult && (
            <div className="bg-emerald-950/90 border border-emerald-700/80 p-3.5 rounded-xl space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Sikeres Beolvasás!
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {new Date().toLocaleTimeString('hu-HU')}
                </span>
              </div>
              <div className="p-2 bg-slate-950/80 rounded-lg border border-emerald-900/60 font-mono text-xs text-slate-100 break-all select-all">
                {lastScannedResult}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(lastScannedResult);
                    setCopiedIndex(-1);
                    setTimeout(() => setCopiedIndex(null), 1500);
                  }}
                  className="px-2.5 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 rounded text-[11px] font-semibold flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedIndex === -1 ? 'Másolva!' : 'Másolás'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Scanned History List */}
          {scannedHistory.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Előző Beolvasások</span>
                <span className="text-[10px] font-mono text-slate-500">{scannedHistory.length} elem</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {scannedHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-slate-950/60 border border-slate-800/80 rounded-lg text-[11px] font-mono flex items-center justify-between gap-2 text-slate-300 hover:border-slate-700"
                  >
                    <span className="truncate max-w-[300px] text-slate-200">{item.text}</span>
                    <button
                      onClick={() => copyToClipboard(item.text, idx)}
                      className="text-slate-400 hover:text-emerald-400 p-1"
                      title="Másolás"
                    >
                      {copiedIndex === idx ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kamera adatfolyam közvetlenül a böngészőben feldolgozva.</span>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all"
          >
            Bezárás
          </button>
        </div>
      </div>
    </div>
  );
};

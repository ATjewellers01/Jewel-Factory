'use client';

import type {
  Calibration,
  EngineStatus,
  JewelleryType,
} from '@/lib/ar-engine';
import { Camera, CameraOff, Loader2, Sparkles } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

import { useTryOnEngine } from '@/hooks/use-try-on-engine';

export type ARViewportHandle = {
  setProduct: (imageUrl: string, jewelleryType: JewelleryType, calibration?: Calibration | null) => Promise<void>;
  capture: () => Promise<Blob | null>;
  start: () => Promise<void>;
  stop: () => void;
};

type Props = {
  className?: string;
  onStatusChange?: (s: EngineStatus) => void;
  /** Auto-start the camera on mount. Defaults to true. */
  autoStart?: boolean;
};

function statusToHint(s: EngineStatus): { label: string; tone: 'neutral' | 'warn' | 'error' } {
  switch (s) {
    case 'idle':
      return { label: 'Initialising…', tone: 'neutral' };
    case 'awaiting_camera':
      return { label: 'Allow camera access to begin', tone: 'neutral' };
    case 'camera_denied':
      return { label: 'Camera blocked. Update browser permissions and reload.', tone: 'error' };
    case 'loading_models':
      return { label: 'Loading try-on engine…', tone: 'neutral' };
    case 'ready':
      return { label: 'Select a piece below to try on', tone: 'neutral' };
    case 'tracking':
      return { label: 'Tracking ✓', tone: 'neutral' };
    case 'no_subject':
      return { label: 'Face the camera or show your hand', tone: 'warn' };
    case 'error':
      return { label: 'Something went wrong. Reload to try again.', tone: 'error' };
  }
}

const ARViewport = forwardRef<ARViewportHandle, Props>(function ARViewport(
  { className = '', onStatusChange, autoStart = true },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { status, metricsSnapshot, start, stop, setProduct, captureFrame, error } = useTryOnEngine({
    videoRef,
    canvasRef,
  });

  useImperativeHandle(
    ref,
    () => ({
      setProduct,
      capture: captureFrame,
      start,
      stop,
    }),
    [setProduct, captureFrame, start, stop],
  );

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  useEffect(() => {
    if (!autoStart) return;
    void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hint = statusToHint(status);

  return (
    <div
      className={`relative mx-auto aspect-[3/4] w-full max-h-[70vh] overflow-hidden rounded-2xl bg-black sm:aspect-[4/3] lg:aspect-square ${className}`}
      data-testid="ar-viewport"
    >
      {/* Video: CSS-mirrored so the user's left looks like their left.
          Landmarks are mirrored in JS to match — see landmarkSmoother. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* AR overlay canvas — NOT mirrored (the engine mirrors landmarks
          internally and draws into display-space pixels). */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* HUD — DOM elements over the canvas, not drawn into it, so captures
          stay clean. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="flex items-start justify-between p-4">
          <div
            className={`rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md ${
              hint.tone === 'error'
                ? 'bg-red-500/80 text-white'
                : hint.tone === 'warn'
                  ? 'bg-amber-500/80 text-white'
                  : 'bg-white/90 text-black'
            }`}
          >
            {hint.label}
          </div>

          {(status === 'tracking' || status === 'no_subject') && (
            <div className="rounded-full bg-black/50 px-3 py-1.5 text-[10px] font-mono text-white/80 backdrop-blur-md">
              {metricsSnapshot.fps} FPS · {metricsSnapshot.inferenceMs}ms · conf {Math.round(metricsSnapshot.confidence * 100)}%
            </div>
          )}
        </div>

        <div className="flex-1" />

        {status === 'loading_models' && (
          <div className="flex items-center justify-center pb-12">
            <div className="flex items-center gap-3 rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-md">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading try-on models (~50 MB)…
            </div>
          </div>
        )}

        {status === 'camera_denied' && (
          <div className="flex items-center justify-center pb-12">
            <div className="flex items-center gap-3 rounded-2xl bg-black/70 px-4 py-3 text-sm text-white backdrop-blur-md">
              <CameraOff className="h-5 w-5 text-red-300" />
              <div>
                <div className="font-medium">Camera access blocked</div>
                <div className="text-xs text-white/70">
                  Update permissions in your browser, then reload this page.
                </div>
              </div>
            </div>
          </div>
        )}

        {(status === 'idle' || status === 'awaiting_camera') && (
          <div className="flex items-center justify-center pb-12">
            <div className="flex items-center gap-3 rounded-2xl bg-black/70 px-4 py-3 text-sm text-white backdrop-blur-md">
              <Camera className="h-5 w-5" />
              Starting camera…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-red-600/90 p-3 text-xs text-white backdrop-blur-md">
          <Sparkles className="mr-1 inline h-3 w-3" />
          {error.message}
        </div>
      )}
    </div>
  );
});

export { ARViewport };
export default ARViewport;

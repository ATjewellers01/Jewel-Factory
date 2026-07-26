import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type FaceLandmarkerResult,
  type HandLandmarkerResult,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';

import { FACE_LM_USED, HAND_LM_USED, POSE_LM_USED } from './anchors';
import {
  mirrorLandmarks,
  resetSmootherPool,
  smoothLandmarks,
  type Landmark,
} from './landmarkSmoother';
import { ARRenderer } from './renderer';
import {
  applyCalibration,
  computeOverlay,
  type Calibration,
  type HandResult,
  type JewelleryType,
  type Overlay,
} from './transforms';

// ────────────────────────────────────────────────────────────────────────────
// Public API types
// ────────────────────────────────────────────────────────────────────────────

export type EngineStatus =
  | 'idle'
  | 'loading_models'
  | 'awaiting_camera'
  | 'camera_denied'
  | 'ready'
  | 'tracking'
  | 'no_subject'
  | 'error';

export type EngineMetrics = {
  fps: number;
  inferenceMs: number;
  confidence: number;
  trackedKind: 'face' | 'hand' | 'pose' | 'none';
};

export type EngineOptions = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onStatusChange?: (status: EngineStatus) => void;
  /**
   * Where to load the MediaPipe WASM bundle from. Defaults to the public CDN
   * — fine for cloud deploy. Override to a local mirror for fully-offline
   * shop devices.
   */
  wasmUrl?: string;
};

// MediaPipe model URLs — pinned float16 builds, same as app.js.
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POSE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const DEFAULT_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';

// ────────────────────────────────────────────────────────────────────────────
// TryOnEngine
//
// Boots MediaPipe, owns the camera stream and rAF loop, drives the renderer.
// React layer creates one of these per mount and disposes it on unmount.
// Metrics live in a ref-friendly getter — no per-frame React state churn.
// ────────────────────────────────────────────────────────────────────────────

export class TryOnEngine {
  private readonly video: HTMLVideoElement;
  private readonly renderer: ARRenderer;
  private readonly onStatusChange?: (s: EngineStatus) => void;
  private readonly wasmUrl: string;

  private status: EngineStatus = 'idle';

  private faceLandmarker: FaceLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private poseLandmarker: PoseLandmarker | null = null;

  private mediaStream: MediaStream | null = null;
  private rafHandle: number | null = null;
  private disposed = false;

  private jewelleryType: JewelleryType = 'necklace';
  private calibration: Calibration | null = null;

  private metrics: EngineMetrics = {
    fps: 0,
    inferenceMs: 0,
    confidence: 0,
    trackedKind: 'none',
  };
  private frameCount = 0;
  private fpsTimer = 0;

  constructor(opts: EngineOptions) {
    this.video = opts.video;
    this.renderer = new ARRenderer(opts.canvas);
    this.onStatusChange = opts.onStatusChange;
    this.wasmUrl = opts.wasmUrl ?? DEFAULT_WASM_URL;
  }

  getMetrics(): EngineMetrics {
    return this.metrics;
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  setJewelleryType(t: JewelleryType): void {
    this.jewelleryType = t;
    this.renderer.setJewelleryType(t);
    // Reset smoother history so we don't carry over filter state from the
    // previous tracking target (a face filter looks weird applied to a hand).
    resetSmootherPool();
  }

  setCalibration(c: Calibration | null): void {
    this.calibration = c;
  }

  /** Load a PNG/JPG overlay. Throws on CORS or network failure. */
  async setProduct(imageUrl: string): Promise<void> {
    await this.renderer.setProduct(imageUrl);
  }

  /**
   * Boot order: camera first (so we know the viewport size), then MediaPipe,
   * then the rAF loop. The status callback fires for each phase so the React
   * layer can update its UI without polling.
   */
  async start(): Promise<void> {
    if (this.disposed) throw new Error('Engine disposed');
    this.transition('awaiting_camera');
    try {
      await this.initCamera();
    } catch (err) {
      this.transition('camera_denied');
      throw err;
    }
    this.transition('loading_models');
    await this.initMediaPipe();
    this.transition('ready');
    this.loop();
  }

  /**
   * Stops the camera stream and rAF loop but keeps the engine reusable.
   * `start()` works again afterwards.
   */
  stop(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    this.video.srcObject = null;
    this.transition('idle');
  }

  /** Stop + free WebGL + tear down MediaPipe. Call from React unmount. */
  dispose(): void {
    this.stop();
    this.faceLandmarker?.close();
    this.handLandmarker?.close();
    this.poseLandmarker?.close();
    this.faceLandmarker = null;
    this.handLandmarker = null;
    this.poseLandmarker = null;
    this.renderer.dispose();
    this.disposed = true;
  }

  /**
   * Grab the current camera frame (after the overlay has been drawn) as a
   * PNG blob. Used by the "capture look" button.
   */
  async captureFrame(): Promise<Blob | null> {
    // Composite the video and overlay canvas into a single image. We can't
    // re-use the WebGL canvas alone because the video pixels aren't on it.
    const { width: w, height: h } = this.renderer.size;
    if (w === 0 || h === 0) return null;

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) return null;

    // Re-render immediately before reading back. The rAF loop may have painted
    // some time ago, and on browsers that ignore preserveDrawingBuffer this
    // guarantees the overlay pixels are present in the buffer we're about to
    // copy — otherwise the capture would silently come out as video-only.
    this.renderer.render();

    // Mirror the video so the captured frame matches what the user saw.
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(this.video, -w, 0, w, h);
    ctx.restore();

    // Overlay canvas is already in the same pixel space (setViewportSize uses
    // the video's intrinsic resolution), so it composites 1:1 with no scaling.
    ctx.drawImage(this.renderer.canvas, 0, 0, w, h);

    return new Promise((resolve) => out.toBlob((b) => resolve(b), 'image/png'));
  }

  // ────────────────────────────────────────────────────────────────────────
  // Private
  // ────────────────────────────────────────────────────────────────────────

  private transition(s: EngineStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.onStatusChange?.(s);
  }

  private async initCamera(): Promise<void> {
    // Request 1280×720 so the camera frame has enough headroom to show a
    // user's whole head and shoulders without the face filling the viewport.
    // MediaPipe processes the full frame either way; the AR overlay also
    // scales naturally with the source resolution.
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
    });
    this.mediaStream = stream;
    this.video.srcObject = stream;

    await new Promise<void>((resolve) => {
      const onMeta = () => {
        this.video.removeEventListener('loadedmetadata', onMeta);
        resolve();
      };
      this.video.addEventListener('loadedmetadata', onMeta);
    });

    // playsInline matters on iOS Safari — without it the video doesn't play
    // even when autoplay+muted are set.
    this.video.setAttribute('playsinline', 'true');
    await this.video.play().catch(() => {
      /* will be retried on user gesture */
    });

    const w = this.video.videoWidth || 1280;
    const h = this.video.videoHeight || 720;
    this.renderer.setViewportSize(w, h);
  }

  private async initMediaPipe(): Promise<void> {
    // MediaPipe's WASM runtime writes informational lines like
    //   "INFO: Created TensorFlow Lite XNNPACK delegate for CPU."
    // to stderr, which the Emscripten shim routes through console.error.
    // Next.js's dev overlay then surfaces them as runtime errors even
    // though they're benign init logs. We intercept here and downgrade
    // anything that's clearly an INFO/WARN MediaPipe message to console.info
    // so the overlay leaves it alone.
    if (typeof window !== 'undefined' && !(console as { __lmFiltered?: boolean }).__lmFiltered) {
      const originalError = console.error.bind(console);
      console.error = (...args: unknown[]) => {
        const first = args[0];
        if (
          typeof first === 'string' &&
          /^(INFO|WARNING):/.test(first.trim())
        ) {
          console.info(...args);
          return;
        }
        originalError(...args);
      };
      (console as { __lmFiltered?: boolean }).__lmFiltered = true;
    }

    const vision = await FilesetResolver.forVisionTasks(this.wasmUrl);

    this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: false,
    });

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });

    try {
      this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
    } catch (err) {
      // Pose is optional — necklace falls back to face-only anchoring.
      console.warn('[ar-engine] Pose landmarker unavailable:', err);
      this.poseLandmarker = null;
    }
  }

  private loop = (timestamp = performance.now()): void => {
    if (this.disposed) return;
    this.rafHandle = requestAnimationFrame(this.loop);

    this.frameCount++;
    if (timestamp - this.fpsTimer > 1000) {
      this.metrics = { ...this.metrics, fps: this.frameCount };
      this.frameCount = 0;
      this.fpsTimer = timestamp;
    }

    if (!this.faceLandmarker || !this.handLandmarker) return;
    if (this.video.readyState < 2) return;

    const w = this.video.videoWidth;
    const h = this.video.videoHeight;
    const now = performance.now();

    const needsHand = ['ring_index', 'ring_middle', 'bangle'].includes(this.jewelleryType);
    const needsFace = ['earring_left', 'earring_right', 'necklace'].includes(this.jewelleryType);
    const needsPose = this.jewelleryType === 'necklace' && this.poseLandmarker !== null;

    let faceLMs: Landmark[] | null = null;
    let handResults: HandResult | null = null;
    let poseLMs: Landmark[] | null = null;

    const t0 = performance.now();

    if (needsFace) {
      const r = this.faceLandmarker.detectForVideo(this.video, now) as FaceLandmarkerResult;
      if (r.faceLandmarks && r.faceLandmarks.length > 0) {
        faceLMs = r.faceLandmarks[0] as Landmark[];
      }
    }

    if (needsHand) {
      const r = this.handLandmarker.detectForVideo(this.video, now) as HandLandmarkerResult;
      if (r.landmarks && r.landmarks.length > 0) {
        handResults = {
          landmarks: r.landmarks as Landmark[][],
          handedness: r.handedness as Array<Array<{ score: number }>>,
        };
      }
    }

    if (needsPose && this.poseLandmarker) {
      const r = this.poseLandmarker.detectForVideo(this.video, now) as PoseLandmarkerResult;
      if (r.landmarks && r.landmarks.length > 0) {
        poseLMs = r.landmarks[0] as Landmark[];
      }
    }

    const inferMs = performance.now() - t0;

    // Mirror once at the source — must happen BEFORE smoothing so per-landmark
    // filter histories don't snap from one side of the frame to the other.
    faceLMs = mirrorLandmarks(faceLMs);
    poseLMs = mirrorLandmarks(poseLMs);
    if (handResults && handResults.landmarks[0]) {
      handResults = {
        ...handResults,
        landmarks: [mirrorLandmarks(handResults.landmarks[0]) ?? []],
      };
    }

    faceLMs = smoothLandmarks(faceLMs, 'face', FACE_LM_USED, now);
    poseLMs = smoothLandmarks(poseLMs, 'pose', POSE_LM_USED, now);
    if (handResults && handResults.landmarks[0]) {
      handResults = {
        ...handResults,
        landmarks: [smoothLandmarks(handResults.landmarks[0], 'hand', HAND_LM_USED, now) ?? []],
      };
    }

    const baseOverlay: Overlay = computeOverlay({
      jewelleryType: this.jewelleryType,
      face: faceLMs,
      hands: handResults,
      pose: poseLMs,
      width: w,
      height: h,
    });
    const overlay = applyCalibration(baseOverlay, this.calibration);

    this.renderer.applyOverlay(overlay);
    this.renderer.render();

    const trackedKind: EngineMetrics['trackedKind'] =
      needsFace && faceLMs ? 'face' : needsHand && handResults ? 'hand' : needsPose && poseLMs ? 'pose' : 'none';

    this.metrics = {
      fps: this.metrics.fps,
      inferenceMs: Math.round(inferMs),
      confidence: overlay.confidence,
      trackedKind,
    };

    if (overlay.position) {
      this.transition('tracking');
    } else {
      this.transition('no_subject');
    }
  };
}

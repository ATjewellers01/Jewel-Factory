import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  computeGroupPosition,
  flipUVsVertical,
  imageToVisibleBounds,
  selectAnchorPoint,
  type VisibleBounds,
  visibleBoundsFrom3DBox,
} from './overlayMath';
import type { JewelleryType, Overlay } from './transforms';

type LoadedModel = {
  group: THREE.Group;
  visBounds: VisibleBounds;
};

// ────────────────────────────────────────────────────────────────────────────
// AR Renderer
// ────────────────────────────────────────────────────────────────────────────

export class ARRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly directionalLight: THREE.DirectionalLight;
  private loaded: LoadedModel | null = null;
  private currentJewellery: JewelleryType = 'necklace';
  private viewportWidth = 1280;
  private viewportHeight = 720;

  constructor(canvas: HTMLCanvasElement) {
    // preserveDrawingBuffer keeps the rendered pixels readable after the frame
    // is composited — without it captureFrame() reads an already-cleared buffer
    // and the jewellery layer is missing from the saved photo.
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    // Y-down orthographic camera: top=0, bottom=h, so `y * h` maps directly
    // to screen pixels with the origin at the top-left. Matches app.js.
    this.camera = new THREE.OrthographicCamera(0, this.viewportWidth, 0, this.viewportHeight, 0.1, 1000);
    this.camera.position.z = 500;

    // Lights are harmless for 2D plane overlays (MeshBasicMaterial ignores
    // lighting) but required for GLTF PBR materials to render correctly.
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(0.5, 1, 0.5).normalize();
    this.scene.add(this.ambientLight);
    this.scene.add(this.directionalLight);
  }

  /**
   * Match the renderer to the video element's intrinsic resolution. Should be
   * called once after `video.onloadedmetadata` fires, and again on resize.
   */
  setViewportSize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.renderer.setSize(width, height, false);
    this.camera.right = width;
    this.camera.bottom = height;
    this.camera.updateProjectionMatrix();
  }

  setJewelleryType(t: JewelleryType): void {
    this.currentJewellery = t;
  }

  /** Overlay buffer size in pixels — matches the video's intrinsic resolution. */
  get size(): { width: number; height: number } {
    return { width: this.viewportWidth, height: this.viewportHeight };
  }

  /** The WebGL canvas holding the rendered overlay, for compositing a capture. */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Load a product overlay. Accepts PNG/JPG (2D plane) or GLB/GLTF (3D model).
   * Format is auto-detected from the URL extension.
   */
  async setProduct(imageUrl: string): Promise<void> {
    if (/\.(glb|gltf)(\?.*)?$/i.test(imageUrl)) {
      await this.loadGltf(imageUrl);
    } else {
      await this.loadTexture(imageUrl);
    }
  }

  // ── 2D PNG/JPG ────────────────────────────────────────────────────────────

  private async loadTexture(imageUrl: string): Promise<void> {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const texture: THREE.Texture = await new Promise((resolve, reject) => {
      loader.load(imageUrl, resolve, undefined, reject);
    });

    const img = texture.image as HTMLImageElement;
    const imgW = img.width;
    const imgH = img.height;
    const aspect = imgW / imgH;

    const visBounds = imageToVisibleBounds(img, imgW, imgH);

    const geo = new THREE.PlaneGeometry(aspect, 1);
    flipUVsVertical(geo);

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      alphaTest: 0.02,
      toneMapped: false,
    });
    const baseModel = new THREE.Mesh(geo, mat);

    // Center and normalise so rotation pivots around the visible midpoint and
    // scale math is independent of source-image dimensions.
    const box = new THREE.Box3().setFromObject(baseModel);
    const center = box.getCenter(new THREE.Vector3());
    baseModel.position.sub(center);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) baseModel.scale.set(1 / maxDim, 1 / maxDim, 1 / maxDim);

    this.swapGroup(baseModel, visBounds);
  }

  // ── 3D GLB/GLTF ──────────────────────────────────────────────────────────

  private async loadGltf(url: string): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) model.scale.setScalar(1 / maxDim);

    // Recompute after normalisation for accurate visBounds.
    const normBox = new THREE.Box3().setFromObject(model);
    const normSize = normBox.getSize(new THREE.Vector3());
    const visBounds = visibleBoundsFrom3DBox(normSize);

    this.swapGroup(model, visBounds);
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  private swapGroup(child: THREE.Object3D, visBounds: VisibleBounds): void {
    const wrapper = new THREE.Group();
    wrapper.add(child);
    wrapper.visible = false;

    if (this.loaded) {
      this.scene.remove(this.loaded.group);
      this.disposeGroup(this.loaded.group);
    }

    this.scene.add(wrapper);
    this.loaded = { group: wrapper, visBounds };
  }

  /**
   * Position the loaded model based on this frame's overlay. Returns true if
   * the model was rendered; false means it was hidden (no tracking / no
   * product loaded). Doesn't render — callers must call `render()` after.
   */
  applyOverlay(overlay: Overlay): boolean {
    if (!this.loaded) return false;
    const m = this.loaded.group;

    if (!overlay.position || overlay.confidence < 0.2) {
      m.visible = false;
      return false;
    }

    m.visible = true;
    const [x, y] = overlay.position;
    const vb = this.loaded.visBounds;
    const S = overlay.scale / (vb.widthLocal || 1);

    m.scale.set(S, S, S);
    m.quaternion.identity();
    m.rotation.set(0, 0, overlay.rotationZ);

    const [anchorLocalX, anchorLocalY] = selectAnchorPoint(vb, this.currentJewellery);
    const [px, py] = computeGroupPosition(x, y, anchorLocalX, anchorLocalY, overlay.rotationZ, S);
    m.position.set(px, py, 0);

    // Fade-in when confidence is borderline so the asset doesn't snap on
    // marginal hand detections.
    const opacity = overlay.confidence > 0.5 ? 1 : 0;
    m.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.transparent = true;
        mat.opacity = opacity;
      }
    });

    return true;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Free WebGL resources. Call from the React unmount path. */
  dispose(): void {
    if (this.loaded) {
      this.scene.remove(this.loaded.group);
      this.disposeGroup(this.loaded.group);
      this.loaded = null;
    }
    this.scene.remove(this.ambientLight);
    this.scene.remove(this.directionalLight);
    this.renderer.dispose();
  }

  private disposeGroup(g: THREE.Object3D): void {
    g.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.MeshBasicMaterial | THREE.MeshBasicMaterial[];
        if (Array.isArray(mat)) {
          mat.forEach((m) => {
            m.map?.dispose();
            m.dispose();
          });
        } else if (mat) {
          mat.map?.dispose();
          mat.dispose();
        }
      }
    });
  }
}

"use client";
import { Suspense, useMemo, useRef, useLayoutEffect, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, TransformControls, Html } from "@react-three/drei";
import { STLLoader, GLTFLoader } from "three-stdlib";
import * as THREE from "three";
import { C, FONT } from "@/design/tokens";
import type { Phase, Marker } from "@/lib/viewModel";
import { PrinterLoader } from "@/components/PrinterLoader";

export interface ViewportProps {
  phase: Phase;
  marker: Marker | null;
  gizmo: "translate" | "rotate" | "scale" | null;
  /** When set, the ASCII PrinterLoader rides the bottom-left corner (forming/printing waits). */
  loaderStatus?: string | null;
  /** Live build mesh from the real engine; null falls back to the bundled fixture. */
  meshUrl?: string | null;
  /** textured GLB preview (meshgen results) — rendered with materials when present */
  glbUrl?: string | null;
  textured?: boolean;
}

function FormingStand({ geom, halfH, phase, marker }: { geom: THREE.BufferGeometry; halfH: number; phase: Phase; marker: Marker | null }) {
  // World-space clipping plane: normal (0,-1,0), so it keeps everything at/below world-Y = constant.
  // Raising the constant from -halfH to +halfH reveals the (vertically centered) model bottom-up.
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), halfH), [halfH]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: C.objFill, roughness: 0.85, metalness: 0.0, clippingPlanes: [clipPlane] }),
    [clipPlane],
  );
  const scanRef = useRef<THREE.Mesh>(null);
  const progress = useRef(phase === "forming" ? 0 : 1);

  useFrame((_s, dt) => {
    if (phase === "forming") progress.current = Math.min(1, progress.current + dt / 2.2);
    else progress.current = THREE.MathUtils.damp(progress.current, 1, 6, dt);
    // Settle the cut just ABOVE the model's top (halfH + margin), not exactly AT it. When it lands on halfH
    // the flat top face sits on the clip boundary and its vertices straddle it every frame → a shimmering
    // z-fight that's especially visible on flat-topped parts (coaster, block — "top flickers as always").
    const TOP_MARGIN = 2;
    const h = THREE.MathUtils.lerp(-halfH, halfH + TOP_MARGIN, progress.current); // world-Y cut height
    clipPlane.constant = h;
    if (scanRef.current) {
      // only render the scanline while it is actively sweeping; hiding it (not just opacity 0)
      // avoids z-fighting with the coplanar model top face on a straight-down (top) view.
      const active = phase === "forming" && progress.current > 0.001 && progress.current < 0.985;
      scanRef.current.visible = active;
      scanRef.current.position.y = h;
      (scanRef.current.material as THREE.MeshBasicMaterial).opacity = active ? 0.9 : 0;
    }
  });
  useLayoutEffect(() => { if (phase === "forming") progress.current = 0; }, [phase]);

  const showMarker = phase === "inspecting" && marker;

  return (
    <group>
      <mesh geometry={geom} material={material} rotation={[-Math.PI / 2, 0, 0]} />
      {/* green forming scanline — a horizontal plane riding the cut height (hidden when idle) */}
      <mesh ref={scanRef} visible={false} rotation={[-Math.PI / 2, 0, 0]} position={[0, -halfH, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial color={C.accent} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {showMarker && (
        <group position={[marker!.x * 0.1, marker!.y * 0.1, marker!.z * 0.1]}>
          <mesh>
            <ringGeometry args={[2.4, 3.0, 32]} />
            <meshBasicMaterial color={C.warn} transparent opacity={0.95} depthTest={false} />
          </mesh>
          <Html distanceFactor={120} style={{ pointerEvents: "none" }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.warn, whiteSpace: "nowrap", transform: "translate(10px,-50%)" }}>{marker!.note}</div>
          </Html>
        </group>
      )}
    </group>
  );
}

function bedGrid(y: number) {
  return <Grid args={[400, 400]} cellSize={10} cellColor={C.layer} sectionColor={C.border} fadeDistance={400} fadeStrength={1.5} infiniteGrid position={[0, y, 0]} />;
}

/** Loads + renders the current build mesh IMPERATIVELY: the previous stage stays on screen
 *  until the next STL finishes loading, so swapping stages never blanks/flickers. */
function LoadedModel({ url, phase, marker, gizmo }: { url: string; phase: Phase; marker: Marker | null; gizmo: ViewportProps["gizmo"] }) {
  const [data, setData] = useState<{ geom: THREE.BufferGeometry; halfH: number } | null>(null);
  useEffect(() => {
    let alive = true;
    new STLLoader().loadAsync(url).then((g) => {
      if (!alive) return;
      // Center (idempotent). OpenSCAD STL is Z-up; mesh is rotated -90° about X so local Z → world Y.
      g.center();
      g.computeBoundingBox();
      // Normalize ON-SCREEN size so any model frames the same way the camera + OrbitControls expect —
      // a 254 mm mug otherwise renders at 254 world units and can't be zoomed out to (the GLB path
      // already normalizes the same way). Real mm are shown in the Print Plan panel, not implied here.
      const size = g.boundingBox!.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      g.scale(70 / maxDim, 70 / maxDim, 70 / maxDim);
      g.computeBoundingBox();
      setData({ geom: g, halfH: g.boundingBox!.max.z });
    }).catch(() => { /* keep previous geometry on load error */ });
    return () => { alive = false; };
  }, [url]);

  if (!data) return null; // only before the very first stage (RenderLoader covers that wait)
  const stand = <FormingStand geom={data.geom} halfH={data.halfH} phase={phase} marker={marker} />;
  return (
    <>
      {gizmo ? <TransformControls mode={gizmo}>{stand}</TransformControls> : stand}
      {bedGrid(-data.halfH)}
    </>
  );
}

/** Renders a textured GLB (meshgen result) keeping its PBR materials. Normalizes scale (TRELLIS
 *  GLBs come ~1–2 units) to ~50 world units so it matches the STL viewport scale, centers it,
 *  and sits it on the bed. Orbit-only for v1 (the forming sweep + gizmo stay on the STL path). */
function LoadedGlb({ url }: { url: string }) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    let alive = true;
    new GLTFLoader().loadAsync(url).then((g) => {
      if (!alive) return;
      const root = g.scene;
      // Meshgen (TRELLIS) GLBs default to a metallic PBR material → near-black under analytic lights
      // (no env map). Make them MATTE so the baseColor texture reads, and brighten if a material came
      // in fully dark. (Runtime material patch — per the blender-mcp skill's "dark materials" fix.)
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.material) return;
        const fix = (m: THREE.Material) => {
          const sm = m as THREE.MeshStandardMaterial;
          if ("metalness" in sm) sm.metalness = 0;
          if ("roughness" in sm && sm.roughness > 0.9) sm.roughness = 0.75;
          if ("envMapIntensity" in sm) sm.envMapIntensity = 1.0;
          sm.needsUpdate = true;
        };
        Array.isArray(mesh.material) ? mesh.material.forEach(fix) : fix(mesh.material);
      });
      const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      root.scale.setScalar(50 / maxDim);                       // normalize on-screen size
      const box = new THREE.Box3().setFromObject(root);        // recompute after scaling
      const c = box.getCenter(new THREE.Vector3());
      root.position.sub(c);                                    // center at origin
      root.position.y += (box.max.y - box.min.y) / 2;          // sit on the bed (y=0)
      setObj(root);
    }).catch(() => { /* keep previous on error */ });
    return () => { alive = false; };
  }, [url]);
  if (!obj) return null;
  return (
    <>
      {/* GLB-only fill lighting so the textured model isn't a dark silhouette (STL path untouched) */}
      <hemisphereLight intensity={1.15} color={0xffffff} groundColor={0x9b8f80} />
      <directionalLight position={[30, 55, 45]} intensity={1.6} />
      <directionalLight position={[-45, 25, -30]} intensity={0.9} />
      <directionalLight position={[0, 15, -65]} intensity={0.6} />
      <primitive object={obj} />
      {bedGrid(0)}
    </>
  );
}

function Scene({ phase, marker, gizmo, meshUrl, glbUrl }: ViewportProps) {
  // Textured meshgen preview takes precedence; else the STL build; else the empty bed.
  if (glbUrl) return <LoadedGlb url={glbUrl} />;
  if (!meshUrl) return bedGrid(0);
  return <LoadedModel url={meshUrl} phase={phase} marker={marker} gizmo={gizmo} />;
}

export function Viewport({ phase, marker, gizmo, loaderStatus, meshUrl, glbUrl, textured }: ViewportProps) {
  return (
    <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden", background: C.viewportBg }}>
      {loaderStatus && <PrinterLoader status={loaderStatus} variant="corner" />}
      {!meshUrl && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, pointerEvents: "none", textAlign: "center", padding: 24 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: 22, fontWeight: 700, color: C.text2, letterSpacing: "-0.02em" }}>Your workspace</div>
          <div style={{ fontFamily: FONT.mono, fontSize: 12.5, color: C.faint }}>describe something on the left — watch it build here, step by step</div>
        </div>
      )}
      <Canvas
        camera={{ position: [90, 75, 130], fov: 35 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        style={{ position: "absolute", inset: 0 }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[40, 80, 60]} intensity={0.9} />
        <directionalLight position={[-50, 30, -40]} intensity={0.25} />
        <Suspense fallback={null}>
          <Scene phase={phase} marker={marker} gizmo={gizmo} meshUrl={meshUrl} glbUrl={glbUrl} textured={textured} />
        </Suspense>
        {/* wide zoom range: in close enough to inspect faces/detail, out far enough to frame big models */}
        <OrbitControls enablePan makeDefault minDistance={8} maxDistance={600} />
      </Canvas>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sparkles, Sphere } from "@react-three/drei";
import { Clapperboard, Film, Layers3 } from "lucide-react";
import type { VideoType } from "@/store/wizardStore";
import type { Mesh } from "three";

function browserSupportsWebGL(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

function AnimatedSphere() {
  const meshRef = useRef<Mesh>(null);

  useFrame((_state, delta) => {
    if (!meshRef.current) {
      return;
    }

    meshRef.current.rotation.x += delta * 0.16;
    meshRef.current.rotation.y += delta * 0.22;
  });

  return (
    <Float speed={1.4} rotationIntensity={0.65} floatIntensity={0.7}>
      <Sphere ref={meshRef} args={[1.25, 48, 48]}>
        <MeshDistortMaterial
          color="#8d4db8"
          attach="material"
          distort={0.28}
          speed={1.5}
          roughness={0.14}
          metalness={0.46}
        />
      </Sphere>
      <Sparkles count={36} scale={4.2} size={1.8} speed={0.2} opacity={0.5} color="#b86be6" />
    </Float>
  );
}

function ProcessingFallback({
  status,
  videoType,
}: {
  status: "submitting" | "styling" | "idle" | "completed" | "failed";
  videoType: VideoType;
}) {
  const Icon = videoType === "remotion" ? Film : Clapperboard;
  const statusLabel =
    status === "styling"
      ? "Applying captions"
      : videoType === "remotion"
        ? "Rendering Text Video"
        : "Stitching Video";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8f0ff_34%,#f3e7fd_68%,#ebdaf7_100%)] px-6">
      <div className="w-full max-w-sm rounded-[28px] border border-white/75 bg-white/80 p-6 text-center shadow-[0_24px_120px_rgba(95,18,132,0.14)] backdrop-blur-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-primary/15 bg-primary/10 text-primary">
          <Icon className="h-8 w-8" />
        </div>
        <p className="mt-4 text-sm font-semibold text-foreground">{statusLabel}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          We kept a lightweight preview active so your browser stays responsive while the render finishes.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary/45" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#b86be6] [animation-delay:150ms]" />
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#5f1284] [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

interface ProcessingScreenProps {
  status: "submitting" | "styling" | "idle" | "completed" | "failed";
  estimatedTime?: string;
  isLongVideo?: boolean;
  videoType?: VideoType;
}

export function ProcessingScreen({
  status,
  estimatedTime,
  isLongVideo,
  videoType = "avatar",
}: ProcessingScreenProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(!browserSupportsWebGL());
  }, []);

  useEffect(() => {
    const node = canvasElement ?? shellRef.current;
    if (!node) {
      return;
    }

    const handleContextLost = (event: Event) => {
      if ("preventDefault" in event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      setUseFallback(true);
    };

    node.addEventListener("webglcontextlost", handleContextLost, true);
    return () => node.removeEventListener("webglcontextlost", handleContextLost, true);
  }, [canvasElement]);

  const statusLabel =
    status === "styling"
      ? "Applying final touches"
      : videoType === "remotion"
        ? "Rendering Text Video"
        : "Generating Video";
  const durationHint = estimatedTime ? `Estimated time: ~${estimatedTime} min` : "Estimated time varies with script length";
  const Icon = videoType === "remotion" ? Film : Clapperboard;

  return (
    <div
      ref={shellRef}
      className="relative flex h-[400px] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8f0ff_34%,#f3e7fd_68%,#ebdaf7_100%)]"
    >
      <div className="pointer-events-none absolute -left-10 top-8 h-44 w-44 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 top-12 h-52 w-52 rounded-full bg-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-36 w-72 -translate-x-1/2 rounded-full bg-white/70 blur-3xl" />

      {useFallback ? (
        <ProcessingFallback status={status} videoType={videoType} />
      ) : (
        <div className="absolute inset-0 z-0">
          <Canvas
            dpr={[1, 1.25]}
            camera={{ position: [0, 0, 5], fov: 42 }}
            gl={{ antialias: false, powerPreference: "low-power", alpha: true }}
            onCreated={({ gl }) => {
              setCanvasElement(gl.domElement);
              gl.setClearColor("#f8f0ff", 0);
            }}
          >
            <ambientLight intensity={0.85} />
            <directionalLight position={[6, 8, 4]} intensity={1.1} color="#ffffff" />
            <directionalLight position={[-5, -4, -3]} intensity={0.45} color="#d7a8f4" />
            <directionalLight position={[0, -6, 3]} intensity={0.28} color="#5f1284" />
            <AnimatedSphere />
          </Canvas>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-white/95 via-white/78 to-transparent px-6 pb-6 pt-16">
        <div className="mx-auto max-w-md rounded-[24px] border border-white/80 bg-white/78 px-5 py-4 text-foreground shadow-[0_10px_50px_rgba(95,18,132,0.12)] backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{statusLabel}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{durationHint}</p>
              {isLongVideo ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[11px] font-medium text-primary/80">
                  <Layers3 className="h-3.5 w-3.5" />
                  Longer script detected
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

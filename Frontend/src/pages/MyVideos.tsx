import { Film, PlayCircle, Sparkles, Clock, CheckCircle, ExternalLink, AlertCircle, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/HeaderBar";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchMyVideos } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { WIZARD_STORAGE_KEY, type WizardState } from "@/store/wizardStore";

const STATS = [
  { label: "Total Videos", key: "total", icon: Film },
  { label: "Processing", key: "processing", icon: Sparkles },
  { label: "Ready", key: "ready", icon: PlayCircle },
];

interface VideoListItem {
  video_id: string;
  title: string;
  status: string;
  request_mode: string;
  video_url: string | null;
  created_at: string;
  isLocalDraft?: boolean;
}

function readLocalDraft(): WizardState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const saved = window.localStorage.getItem(WIZARD_STORAGE_KEY);
  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved) as WizardState;
  } catch {
    return null;
  }
}

function hasMeaningfulDraft(state: WizardState | null): state is WizardState {
  if (!state) {
    return false;
  }

  return Boolean(
    state.currentStep > 0 ||
    state.generatedVideo?.video_id ||
    state.generationStatus !== "idle" ||
    state.customerName.trim() ||
    state.lan.trim() ||
    state.clientName.trim() ||
    state.tos.trim() ||
    state.loanAmount.trim(),
  );
}

function buildLocalDraftItem(): VideoListItem | null {
  const draft = readLocalDraft();
  if (!hasMeaningfulDraft(draft)) {
    return null;
  }

  const localVideoUrl = draft.styledVideoUrl || draft.generatedVideo?.video_url || null;
  const status =
    draft.generationStatus === "submitting" || draft.generationStatus === "styling"
      ? "processing"
      : draft.generationStatus === "completed"
      ? "completed"
      : draft.generationStatus === "failed"
      ? "failed"
      : "draft";
  const flowLabel = draft.videoType === "remotion" ? "Text video" : "Avatar video";

  return {
    video_id: draft.generatedVideo?.video_id ?? `local-draft-${draft.videoType}`,
    title: draft.generatedVideo?.title ?? `${draft.customerName.trim() || flowLabel} draft`,
    status,
    request_mode: `${draft.videoType} (local draft)`,
    video_url: localVideoUrl,
    created_at: new Date().toISOString(),
    isLocalDraft: true,
  };
}

export default function MyVideos() {
  const navigate = useNavigate();
  const localDraft = buildLocalDraftItem();
  const { data: videos, isLoading, error, refetch } = useQuery({
    queryKey: ["my-videos"],
    queryFn: fetchMyVideos,
    refetchInterval: 10000, // Poll every 10 seconds for status updates
  });

  const openCreate = (mode: "avatar" | "remotion") => {
    navigate(`/create?mode=${mode}&fresh=1`);
  };

  const mergedVideos: VideoListItem[] = [
    ...(localDraft && !videos?.some((video: any) => video.video_id === localDraft.video_id) ? [localDraft] : []),
    ...((videos ?? []) as VideoListItem[]),
  ];

  const stats = {
    total: mergedVideos.length,
    processing: mergedVideos.filter((video) => video.status === "processing").length,
    ready: mergedVideos.filter((video) => video.status === "completed" || video.status === "styled").length,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeaderBar primaryLabel="Create Video" />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {error instanceof Error ? (
            <section className="surface-card border-destructive/25 bg-destructive/5 p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Cloud videos could not be loaded</p>
                  <p className="text-xs text-muted-foreground">
                    {error.message}
                    {localDraft ? " Your locally saved draft is still available below." : ""}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => void refetch()} className="border-border">
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </section>
          ) : null}

          <section className="surface-card p-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary">Workspace</p>
              <div className="space-y-2">
                <h1 className="font-display text-4xl text-foreground">My Videos</h1>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  View and manage all your videos generated across all flows.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
              <button
                type="button"
                onClick={() => openCreate("avatar")}
                className="rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-surface-hover"
              >
                <p className="text-sm font-semibold text-foreground">Avatar Video</p>
                <p className="mt-1 text-xs text-muted-foreground">Create a human-like avatar video in seconds.</p>
              </button>
              <button
                type="button"
                onClick={() => openCreate("remotion")}
                className="rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-surface-hover"
              >
                <p className="text-sm font-semibold text-foreground">Text to Video</p>
                <p className="mt-1 text-xs text-muted-foreground">Turn your text into engaging videos in seconds.</p>
              </button>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {STATS.map((item) => (
              <div key={item.label} className="surface-card p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-display text-foreground">{stats[item.key as keyof typeof stats]}</p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <item.icon className="h-5 w-5" />
                </div>
              </div>
            ))}
          </section>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 w-full rounded-2xl" />
              ))}
            </div>
          ) : mergedVideos.length === 0 ? (
            error instanceof Error ? (
              <section className="surface-card p-12 text-center flex flex-col items-center justify-center min-h-[320px]">
                <AlertCircle className="h-12 w-12 text-destructive/70 mb-4" />
                <div className="space-y-3 mb-6">
                  <h2 className="font-display text-2xl font-semibold text-foreground">We couldn't reach your video library</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    The backend could not be reached, so cloud drafts and video jobs are temporarily unavailable.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button onClick={() => void refetch()} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/create")} className="border-border">
                    Open Create Page
                  </Button>
                </div>
              </section>
            ) : (
            <section className="surface-card p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring", delay: 0.1 }}
                className="relative mb-6"
              >
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary/10 to-indigo-500/10 border border-primary/20 flex items-center justify-center shadow-inner"
                >
                  <Film className="h-10 w-10 text-primary opacity-80" />
                </motion.div>
              </motion.div>
              <div className="space-y-3 mb-8">
                <h2 className="font-display text-2xl font-semibold text-foreground">Your Canvas is empty</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  No videos yet. Create a video in seconds. Take the credit all day!
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={() => openCreate("avatar")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 glow-purple-sm font-semibold"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Avatar Video
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => openCreate("remotion")}
                  className="border-border font-semibold"
                >
                  Text to Video
                </Button>
              </div>
            </section>
            )
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {mergedVideos.map((video) => (
                <motion.div
                  key={video.video_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="surface-card overflow-hidden group hover:border-primary/30 transition-all border border-border"
                >
                  <div className="aspect-video bg-slate-100 dark:bg-slate-900 relative overflow-hidden flex items-center justify-center">
                    {video.status === "completed" || video.status === "styled" ? (
                      video.video_url ? (
                        <video src={video.video_url} className="w-full h-full object-cover" controls />
                      ) : (
                        <PlayCircle className="h-12 w-12 text-primary opacity-50" />
                      )
                    ) : video.status === "failed" ? (
                      <div className="flex flex-col items-center gap-2 px-6 text-center">
                        <AlertCircle className="h-10 w-10 text-destructive/80" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Failed</span>
                      </div>
                    ) : video.status === "draft" ? (
                      <div className="flex flex-col items-center gap-2 px-6 text-center">
                        <Film className="h-10 w-10 text-primary/70" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Draft</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Clock className="h-10 w-10 text-muted-foreground animate-pulse" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Processing</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground line-clamp-1">{video.title || "Untitled Video"}</h3>
                      {video.status === "completed" || video.status === "styled" ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-1" />
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{video.request_mode.toLowerCase().includes("remotion") ? "Text to Video" : "Avatar Video"}</span>
                      <span>{video.isLocalDraft ? "Saved in browser" : new Date(video.created_at).toLocaleDateString()}</span>
                    </div>
                    {video.isLocalDraft ? (
                      <Button variant="outline" className="border-border text-xs" onClick={() => navigate("/create")}>
                        Resume Draft
                      </Button>
                    ) : null}
                    {video.video_url && (
                      <Button variant="link" className="p-0 h-auto text-primary text-xs" onClick={() => window.open(video.video_url, '_blank')}>
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Open Link
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

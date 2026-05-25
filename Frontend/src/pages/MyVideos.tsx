import { Film, PlayCircle, Sparkles, Clock, CheckCircle, ExternalLink, AlertCircle, RotateCcw, Trash2, Download, Share2, Users, Send, Link, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/HeaderBar";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchMyVideos, deleteVideo } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { WIZARD_STORAGE_KEY, type WizardState } from "@/store/wizardStore";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SOFT_DELETED_DRAFT_STORAGE_KEY = `${WIZARD_STORAGE_KEY}-deleted`;

const STATS = [
  { label: "Total Videos", key: "total", icon: Film },
  { label: "Processing", key: "processing", icon: Sparkles },
  { label: "Ready", key: "ready", icon: PlayCircle },
];

interface VideoListItem {
  _id: string;
  title: string;
  status: string;
  request_mode: string;
  template_key?: string | null;
  video_url: string | null;
  interactive_url?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  isLocalDraft?: boolean;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDownloadFilename(video: VideoListItem): string {
  const preferredName = sanitizeFilenamePart(video.title || "");
  return `${preferredName || "video-draft"}.mp4`;
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
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
    state.generatedVideo?._id ||
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
  const flowLabel =
    draft.videoType === "remotion"
      ? "Text video"
      : draft.videoType === "hybrid_remotion_avatar_pip"
        ? "VisionDesk"
        : "Avatar video";

  return {
    _id: draft.generatedVideo?._id ?? draft.generatedVideo?.video_id ?? `local-draft-${draft.videoType}`,
    title: draft.generatedVideo?.title ?? `${draft.customerName.trim() || flowLabel} draft`,
    status,
    request_mode: `${draft.videoType} (local draft)`,
    video_url: localVideoUrl,
    interactive_url: draft.generatedVideo?.interactive_url ?? null,
    created_at: new Date().toISOString(),
    isLocalDraft: true,
  };
}

function readSoftDeletedDraft(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SOFT_DELETED_DRAFT_STORAGE_KEY);
}

function softDeleteLocalDraft(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const saved = window.localStorage.getItem(WIZARD_STORAGE_KEY);
  if (!saved) {
    return false;
  }

  window.localStorage.setItem(
    SOFT_DELETED_DRAFT_STORAGE_KEY,
    JSON.stringify({ content: saved, deletedAt: new Date().toISOString() }),
  );
  window.localStorage.removeItem(WIZARD_STORAGE_KEY);
  return true;
}

function restoreSoftDeletedDraft(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const saved = readSoftDeletedDraft();
  if (!saved) {
    return false;
  }

  try {
    const parsed = JSON.parse(saved) as { content?: string } | WizardState;
    const content =
      typeof parsed === "object" && parsed !== null && "content" in parsed && typeof parsed.content === "string"
        ? parsed.content
        : JSON.stringify(parsed);

    window.localStorage.setItem(WIZARD_STORAGE_KEY, content);
    window.localStorage.removeItem(SOFT_DELETED_DRAFT_STORAGE_KEY);
    return true;
  } catch {
    window.localStorage.removeItem(SOFT_DELETED_DRAFT_STORAGE_KEY);
    return false;
  }
}

function isServerUnreachableError(error: Error): boolean {
  return /could not reach the server/i.test(error.message);
}

export default function MyVideos() {
  const navigate = useNavigate();
  const [localDraft, setLocalDraft] = useState<VideoListItem | null>(() => buildLocalDraftItem());
  const [hasSoftDeletedDraft, setHasSoftDeletedDraft] = useState(() => Boolean(readSoftDeletedDraft()));
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const { data: videos, isLoading, error, refetch } = useQuery({
    queryKey: ["my-videos"],
    queryFn: fetchMyVideos,
    refetchInterval: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    if (!(error instanceof Error)) {
      return;
    }

    console.error("[my-videos] Failed to load video library", {
      message: error.message,
      error,
    });
  }, [error]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVideo(id),
    onSuccess: () => {
      toast.success("Video deleted successfully.");
      void refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete video.");
    },
  });

  const handleVideoDelete = async (video: VideoListItem) => {
    if (video.isLocalDraft) {
      handleSoftDeleteDraft();
      return;
    }

    if (!window.confirm("Are you sure you want to delete this video? This action cannot be undone.")) {
      return;
    }

    deleteMutation.mutate(video._id);
  };

  const handleShare = async (video: VideoListItem) => {
    const shareTarget = video.interactive_url || video.video_url;
    if (!shareTarget) {
      toast.error("This video does not have a link yet.");
      return;
    }
    const absoluteShareUrl = new URL(shareTarget, window.location.origin).toString();

    try {
      if (navigator.share) {
        // By using 'text' instead of 'url', the native Share Sheet won't explicitly parse
        // the domain (HeyGen) to display as the primary subtitle in the OS UI.
        await navigator.share({
          title: video.title || "Shared video",
          text: `Here is the video: ${absoluteShareUrl}`,
        });
        return;
      }

      await navigator.clipboard.writeText(absoluteShareUrl);
      toast.success("Video link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error("Unable to share this video right now.");
    }
  };

  const handleDownload = async (video: VideoListItem) => {
    if (!video.video_url) {
      toast.error("This video is not ready for download.");
      return;
    }

    const filename = buildDownloadFilename(video);

    try {
      const resolvedUrl = new URL(video.video_url, window.location.href);
      if (resolvedUrl.origin === window.location.origin) {
        const response = await fetch(resolvedUrl.toString(), { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Download request failed with status ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        triggerDownload(objectUrl, filename);
        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1_000);
        toast.success("Download started.");
        return;
      }
    } catch (error) {
      console.error("Falling back to direct download link.", error);
    }

    triggerDownload(video.video_url, filename);
    toast.success("Download started.");
  };

  const openCreate = (mode: "avatar" | "remotion") => {
    navigate(`/create?mode=${mode}&fresh=1`);
  };
  const openPdfSummarizer = () => {
    navigate("/pdf-summarizer");
  };

  const handleSoftDeleteDraft = () => {
    if (!softDeleteLocalDraft()) {
      toast.error("No saved draft was found.");
      return;
    }

    setLocalDraft(null);
    setHasSoftDeletedDraft(true);
    toast.success("Draft removed from view. You can restore it anytime.");
  };

  const handleRestoreDraft = () => {
    if (!restoreSoftDeletedDraft()) {
      toast.error("No deleted draft is available to restore.");
      setHasSoftDeletedDraft(false);
      return;
    }

    setLocalDraft(buildLocalDraftItem());
    setHasSoftDeletedDraft(false);
    toast.success("Draft restored.");
  };

  const mergedVideos: VideoListItem[] = [
    ...(localDraft && !videos?.some((video: any) => video._id === localDraft._id) ? [localDraft] : []),
    ...((videos ?? []) as VideoListItem[]),
  ];
  const isBackendUnreachable = error instanceof Error && isServerUnreachableError(error);

  const stats = {
    total: mergedVideos.length,
    processing: mergedVideos.filter((video) => video.status === "processing").length,
    ready: mergedVideos.filter((video) => video.status === "completed" || video.status === "styled").length,
  };

  const handleCardVideoPlay = (videoId: string) => {
    setActiveVideoId(videoId);
    const element = videoRefs.current[videoId];
    if (!element) {
      return;
    }

    element.currentTime = 0;
    const playPromise = element.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Ignore autoplay interruptions and keep controls visible for manual retry.
      });
    }
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
            <div className="space-y-3 lg:w-[28rem]">
              <div className="grid gap-3 sm:grid-cols-3">
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
                <button
                  type="button"
                  onClick={openPdfSummarizer}
                  className="rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:bg-surface-hover"
                >
                  <p className="text-sm font-semibold text-foreground">PDF Summarizer</p>
                  <p className="mt-1 text-xs text-muted-foreground">Convert PDFs into concise multilingual voice summaries.</p>
                </button>
              </div>
              {hasSoftDeletedDraft ? (
                <Button variant="outline" onClick={handleRestoreDraft} className="w-full border-border">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore Deleted Draft
                </Button>
              ) : null}
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
                  <h2 className="font-display text-2xl font-semibold text-foreground">We couldn't load your video library</h2>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    {isBackendUnreachable
                      ? "The backend could not be reached, so cloud drafts and video jobs are temporarily unavailable."
                      : error.message}
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
                <Button
                  size="lg"
                  variant="outline"
                  onClick={openPdfSummarizer}
                  className="border-border font-semibold"
                >
                  PDF Summarizer
                </Button>
              </div>
            </section>
            )
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {mergedVideos.map((video) => (
                <motion.div
                  key={video._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="surface-card overflow-hidden group hover:border-primary/30 transition-all border border-border"
                >
                  <div className="aspect-video bg-slate-100 dark:bg-slate-900 relative overflow-hidden flex items-center justify-center">
                    {video.status === "completed" || video.status === "styled" ? (
                      video.video_url ? (
                        <div className="relative h-full w-full overflow-hidden">
                          <video
                            ref={(element) => {
                              videoRefs.current[video._id] = element;
                            }}
                            src={video.video_url}
                            poster={video.thumbnail_url ?? undefined}
                            className="h-full w-full object-cover"
                            controls={activeVideoId === video._id}
                            playsInline
                            preload="metadata"
                          />
                          {activeVideoId !== video._id ? (
                            <button
                              type="button"
                              className="absolute inset-0 h-full w-full overflow-hidden"
                              onClick={() => handleCardVideoPlay(video._id)}
                              aria-label={`Play ${video.title || "video"}`}
                            >
                              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/30 transition-transform group-hover:scale-105">
                                  <PlayCircle className="h-8 w-8" />
                                </div>
                              </div>
                            </button>
                          ) : null}
                        </div>
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
                      <span>{video.request_mode.toLowerCase().includes("remotion") ? "Text to Video" : "AI Avatar"}</span>
                      <span>{video.isLocalDraft ? "Saved in browser" : new Date(video.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {video.isLocalDraft && !video.video_url && (
                        <Button variant="outline" size="sm" className="flex-1 border-border text-[11px] h-8" onClick={() => navigate("/create")}>
                          Resume Draft
                        </Button>
                      )}
                      
                      {video.video_url ? (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1 border-border text-[11px] h-8 group/share relative hover:border-primary/50"
                              >
                                <Share2 className="mr-1.5 h-3.5 w-3.5" />
                                Share
                                <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 p-1.5 rounded-xl border-border/80 shadow-xl backdrop-blur-md bg-card/95">
                              <DropdownMenuItem 
                                onClick={() => void handleShare(video)}
                                className="group flex items-center gap-2 rounded-lg py-2 cursor-pointer transition-colors"
                              >
                                <div className="p-1.5 rounded-md bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white group-focus:bg-primary group-focus:text-white group-data-[highlighted]:bg-primary group-data-[highlighted]:text-white transition-colors">
                                  <Link className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[13px] font-semibold group-hover:text-white group-focus:text-white group-data-[highlighted]:text-white transition-colors">Share Link</span>
                                  <span className="text-[10px] text-muted-foreground group-hover:text-white group-focus:text-white group-data-[highlighted]:text-white transition-colors">Copy url to clipboard</span>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => navigate(`/bulk?video_id=${video._id}`)}
                                className="group flex items-center gap-2 rounded-lg py-2 cursor-pointer transition-colors"
                              >
                                <div className="p-1.5 rounded-md bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white group-focus:bg-primary group-focus:text-white group-data-[highlighted]:bg-primary group-data-[highlighted]:text-white transition-colors">
                                  <Users className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[13px] font-semibold group-hover:text-white group-focus:text-white group-data-[highlighted]:text-white transition-colors">Share in Bulk</span>
                                  <span className="text-[10px] text-muted-foreground group-hover:text-white group-focus:text-white group-data-[highlighted]:text-white transition-colors">Send to multiple contacts</span>
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 border-border text-[11px] h-8"
                            onClick={() => void handleDownload(video)}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Download
                          </Button>
                        </>
                      ) : null}

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                        onClick={() => handleVideoDelete(video)}
                        title="Delete video"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {video.video_url && (
                      <Button variant="link" className="p-0 h-auto text-primary text-xs" onClick={() => window.open(video.interactive_url || video.video_url || "", '_blank')}>
                        <ExternalLink className="mr-1 h-3 w-3" />
                        {video.interactive_url ? "Open Interactive Link" : "Open Video"}
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

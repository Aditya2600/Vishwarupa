import { Download, Link, MessageCircle, AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardState } from "@/store/wizardStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FORMATS = [
  { id: "MP4", label: "MP4", desc: "Standard video", available: true },
  { id: "Vertical Social", label: "Vertical Social", desc: "9:16 for Reels/Shorts", available: false },
  { id: "Square Social", label: "Square Social", desc: "1:1 for feeds", available: false },
];

const DELIVERY = [
  { icon: Link, label: "Copy Share Link" },
  { icon: Download, label: "Download Video" },
  { icon: MessageCircle, label: "Send to WhatsApp" },
];

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildDownloadFilename({
  title,
  customerName,
  videoType,
}: {
  title: string | null | undefined;
  customerName: string;
  videoType: WizardState["videoType"];
}): string {
  const preferredName = sanitizeFilenamePart(title ?? "") || sanitizeFilenamePart(customerName);
  const fallbackName =
    videoType === "remotion"
      ? "text-to-video"
      : videoType === "hybrid_remotion_avatar_pip"
        ? "visiondesk"
        : "avatar-video";
  return `${preferredName || fallbackName}.mp4`;
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

function toAbsoluteShareUrl(url: string): string {
  if (!url) {
    return "";
  }

  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

interface StepShareProps {
  state: WizardState;
  update: (partial: Partial<WizardState>) => void;
}

export function StepShare({ state, update }: StepShareProps) {
  const generatedVideo = state.generatedVideo;
  let shareUrl = generatedVideo?.interactive_url || state.styledVideoUrl || generatedVideo?.video_url || "";
  let downloadUrl = state.styledVideoUrl || generatedVideo?.video_url || "";
  
  if (shareUrl.startsWith("/api/artifacts/")) {
    shareUrl = shareUrl.replace("/api/artifacts/", "https://vishvarupa.s3.ap-south-1.amazonaws.com/");
  }
  if (downloadUrl.startsWith("/api/artifacts/")) {
    downloadUrl = downloadUrl.replace("/api/artifacts/", "https://vishvarupa.s3.ap-south-1.amazonaws.com/");
  }
  shareUrl = toAbsoluteShareUrl(shareUrl);
  const avatarName =
    state.videoType === "remotion"
      ? "Text to Video"
      : state.avatarName || state.avatarId || (state.videoType === "hybrid_remotion_avatar_pip" ? "VisionDesk" : "None");
  const styleLabel =
    state.videoType === "remotion"
      ? "Text to Video"
      : state.videoType === "hybrid_remotion_avatar_pip"
        ? "VisionDesk"
        : "Avatar";
  const statusText =
    state.generationStatus === "completed"
      ? generatedVideo?.status ?? "completed"
      : state.generationStatus === "failed"
      ? "failed"
      : state.generationStatus === "styling"
      ? "branding in progress"
      : state.generationStatus === "submitting"
      ? "processing"
      : "not started";

  const handleCopyShareLink = async () => {
    if (!shareUrl) {
      toast.error("Generate a video first.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied.");
    } catch {
      toast.error("Clipboard access failed.");
    }
  };

  const handleDownloadVideo = async () => {
    if (!downloadUrl) {
      toast.error("Generate a video first.");
      return;
    }

    const filename = buildDownloadFilename({
      title: generatedVideo?.title,
      customerName: state.customerName,
      videoType: state.videoType,
    });

    try {
      const resolvedUrl = new URL(downloadUrl, window.location.href);
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
      console.error("Falling back to direct video download link.", error);
    }

    triggerDownload(downloadUrl, filename);
    toast.success("Download started.");
  };

  const handleShareOnWhatsApp = () => {
    if (!shareUrl) {
      toast.error("Generate a video first.");
      return;
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareUrl)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-4xl space-y-8">
      {state.generationStatus === "completed" ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-success/10 border border-success/30">
          <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {state.videoType === "remotion" ? "Your text video is ready." : state.videoType === "hybrid_remotion_avatar_pip" ? "Your VisionDesk video is ready." : "Your video is ready."}
            </p>
            <p className="text-xs text-muted-foreground">
              {state.videoType === "remotion"
                ? "Use the link below to open, copy, or download the finished render."
                : "Use the delivery controls below to share or download it."}
            </p>
          </div>
        </div>
      ) : state.generationStatus === "submitting" ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30">
          <LoaderCircle className="h-6 w-6 text-primary shrink-0 animate-spin" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {state.videoType === "remotion" ? "Rendering text video" : state.videoType === "hybrid_remotion_avatar_pip" ? "Generating VisionDesk video" : "Generating video"}
            </p>
            <p className="text-xs text-muted-foreground">
              {state.videoType === "remotion"
                ? "We are stitching together a personalized text-to-video render for this lead."
                : "Your video is being prepared. We will move you ahead as soon as it is ready."}
            </p>
          </div>
        </div>
      ) : state.generationStatus === "styling" ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/30">
          <LoaderCircle className="h-6 w-6 text-primary shrink-0 animate-spin" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {state.videoType === "remotion" ? "Applying subtitles and logo" : "Finalizing video"}
            </p>
            <p className="text-xs text-muted-foreground">
              {state.videoType === "remotion"
                ? "We are adding the final presentation touches to your video now."
                : "We are finalizing your generated video now."}
            </p>
          </div>
        </div>
      ) : state.generationStatus === "failed" ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30">
          <AlertCircle className="h-6 w-6 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">Generation failed</p>
            <p className="text-xs text-muted-foreground">{state.generationError || "Something went wrong. Please try again or contact support."}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-8">
        {/* Left */}
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Export Format</label>
            <div className="grid gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  disabled={!f.available}
                  onClick={() => f.available && update({ exportFormat: f.id })}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                    !f.available
                      ? "border-border bg-card opacity-50 cursor-not-allowed"
                      : state.exportFormat === f.id
                      ? "border-primary bg-primary/5 glow-purple-sm"
                      : "border-border bg-card hover:bg-surface-hover"
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      {f.label}
                      {!f.available && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide">
                          Soon
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-3">Delivery Options</label>
            <div className="grid grid-cols-2 gap-2">
              {DELIVERY.map((d) => (
                <Button
                  key={d.label}
                  variant="outline"
                  disabled={d.label === "Download Video" ? !downloadUrl : !shareUrl}
                  onClick={() => {
                    if (d.label === "Copy Share Link") {
                      void handleCopyShareLink();
                    } else if (d.label === "Download Video") {
                      void handleDownloadVideo();
                    } else if (d.label === "Send to WhatsApp") {
                      handleShareOnWhatsApp();
                    }
                  }}
                  className="justify-start border-border bg-card text-muted-foreground hover:text-foreground hover:bg-surface-hover h-auto py-3"
                >
                  <d.icon className="mr-2 h-4 w-4" />
                  <span className="text-sm">{d.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Right – metadata */}
        <div className="surface-card p-6 space-y-4 h-fit">
          <h3 className="text-sm font-semibold text-foreground mb-4">Video Metadata</h3>
          <Meta
            label="Video Name"
            value={generatedVideo?.title ?? `${state.customerName.trim() || styleLabel} - Draft`}
          />
          <Meta label="Created At" value={new Date().toLocaleDateString()} />
          <Meta label="Style" value={styleLabel} />
          <Meta label="Language" value={state.language} />
          {state.videoType !== "remotion" ? <Meta label="Avatar" value={avatarName} /> : null}
          <Meta label="Status" value={statusText} />
          <Meta label="Video ID" value={generatedVideo?._id ?? generatedVideo?.video_id ?? "Pending"} />
          {state.videoType === "remotion" ? <Meta label="Logo" value={state.logoFileName || "None"} /> : null}
          <HighlightedOutputLink
            href={shareUrl}
            onCopy={() => void handleCopyShareLink()}
          />
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm border-b border-border pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

function HighlightedOutputLink({
  href,
  onCopy,
}: {
  href: string;
  onCopy: () => void;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 transition-all duration-300",
        href
          ? "border-primary/35 bg-gradient-to-br from-primary/12 via-background to-primary/8 shadow-[0_0_0_1px_rgba(95,18,132,0.08),0_18px_40px_rgba(95,18,132,0.08)]"
          : "border-border bg-secondary/30",
      )}
    >
      {href ? (
        <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(95,18,132,0.18),transparent_40%),linear-gradient(90deg,transparent,rgba(95,18,132,0.12),transparent)] motion-safe:animate-pulse" />
      ) : null}
      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Final Output Link</p>
          <p className="text-sm font-medium text-foreground">
            {href ? "All set! Download or share the link" : "Your video link will appear here once generation completes."}
          </p>
        </div>
        {href ? (
          <span className="inline-flex h-3 w-3 shrink-0 rounded-full bg-primary shadow-[0_0_18px_rgba(95,18,132,0.65)]" />
        ) : null}
      </div>
      {href ? (
        <div className="relative mt-4 space-y-3">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-primary/30 bg-background/80 px-4 py-3 text-left transition-all duration-300 hover:border-primary/50 hover:bg-background hover:shadow-[0_0_24px_rgba(95,18,132,0.14)]"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Link className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-primary">Open video</span>
              <span className="block text-xs text-muted-foreground">
                Open the finished video in a new tab or use the actions below.
              </span>
            </span>
          </a>
          <div className="flex gap-2">
            <Button type="button" asChild className="flex-1">
              <a href={href} target="_blank" rel="noopener noreferrer">
                Open Video
              </a>
            </Button>
            <Button type="button" variant="outline" onClick={onCopy} className="flex-1 border-primary/30 text-primary hover:bg-primary/5">
              Copy Link
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative mt-4 rounded-xl border border-dashed border-border bg-background/50 px-4 py-3 text-sm font-medium text-muted-foreground">
          Pending
        </div>
      )}
    </div>
  );
}

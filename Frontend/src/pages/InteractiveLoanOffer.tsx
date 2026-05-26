import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchInteractiveLoanOffer,
  recordInteractiveLoanOfferEvent,
  type InteractiveLoanOffer,
} from "@/lib/api";

type OfferRow = {
  tenure: string;
  amount: string;
  emi: string;
};

const TENURES = ["24", "30", "36", "42", "48", "60"];

function safeText(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const cleaned = String(value).trim();
  return cleaned || fallback;
}

function isAvailable(value: unknown): boolean {
  const cleaned = safeText(value).toLowerCase();
  return Boolean(cleaned && cleaned !== "na" && cleaned !== "null");
}

function formatAmount(value: unknown, fallback = "NA"): string {
  const cleaned = safeText(value);
  const numeric = Number(cleaned.replace(/[^\d.]/g, ""));
  if (!cleaned || !Number.isFinite(numeric) || numeric <= 0) return cleaned || fallback;
  return `₹ ${Math.round(numeric).toLocaleString("en-IN")}`;
}

function getOfferRows(data: InteractiveLoanOffer): OfferRow[] {
  const offer = data.loan_offer ?? {};
  const rows = TENURES.map((tenure) => {
    const amount = offer[`month_${tenure}_loan_amount`];
    const emi = offer[`emi_calculation${tenure}`];
    return {
      tenure,
      amount: safeText(amount),
      emi: safeText(emi),
    };
  }).filter((row) => isAvailable(row.amount));

  if (rows.length) return rows;

  return [
    {
      tenure: safeText(offer.max_tenure, "60"),
      amount: safeText(offer.max_loan_amount, "105000"),
      emi: safeText(offer.max_emi, "3398"),
    },
  ];
}

function getInitialRow(rows: OfferRow[], data: InteractiveLoanOffer): OfferRow {
  const offer = data.loan_offer ?? {};
  const maxAmount = safeText(offer.max_loan_amount);
  const maxTenure = safeText(offer.max_tenure);
  return (
    rows.find((row) => row.amount === maxAmount && row.tenure === maxTenure) ||
    rows.find((row) => row.amount === maxAmount) ||
    rows[rows.length - 1]
  );
}

function findSubtitleStart(
  subtitles: Array<{ text: string; start: number; end: number }> | undefined,
  phrase: string,
): number | null {
  if (!Array.isArray(subtitles) || !phrase) return null;
  const needle = phrase.toLowerCase();
  const hit = subtitles.find((s) => typeof s?.text === "string" && s.text.toLowerCase().includes(needle));
  if (!hit || typeof hit.start !== "number" || typeof hit.end !== "number") return null;

  const text = hit.text.toLowerCase();
  const index = text.indexOf(needle);
  if (index <= 0) return hit.start;

  const proportion = index / text.length;
  const duration = hit.end - hit.start;
  return hit.start + proportion * duration;
}

function reportEvent(videoId: string, action: string, row?: OfferRow) {
  void recordInteractiveLoanOfferEvent(videoId, {
    action,
    selected_loan_amount: row ? formatAmount(row.amount) : undefined,
    selected_tenure: row ? `${row.tenure} Months` : undefined,
    selected_emi: row ? formatAmount(row.emi) : undefined,
  }).catch(() => undefined);
}

function getTextColorForBg(hex: string): string {
  if (!hex) return "#ffffff";
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length < 6) return "#ffffff";
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#ffffff";
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 145 ? "#000000" : "#ffffff";
}

export default function InteractiveLoanOffer() {
  const { id } = useParams<{ id: string }>();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [videoWidth, setVideoWidth] = useState(430);
  const [hasStarted, setHasStarted] = useState(false);
  const [showAvail, setShowAvail] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [showSelectorsOverlay, setShowSelectorsOverlay] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [selectedTenure, setSelectedTenure] = useState("");
  const [selectedAmount, setSelectedAmount] = useState("");
  const [hasDismissedAvail, setHasDismissedAvail] = useState(false);
  const [hasDismissedSelector, setHasDismissedSelector] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["interactive-loan-offer", id],
    queryFn: () => fetchInteractiveLoanOffer(id!),
    enabled: Boolean(id),
  });

  const rows = useMemo(() => (data ? getOfferRows(data) : []), [data]);

  const sanitizedSubtitles = useMemo(() => {
    if (!data?.subtitles) return undefined;
    return data.subtitles.map((sub) => ({
      ...sub,
      text: typeof sub.text === "string" ? sub.text.replace(/\s+\d+\s*$/, "") : "",
    }));
  }, [data?.subtitles]);

  // Handle container resizing to dynamically calculate overlay dimensions and font sizes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width) {
          setVideoWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const introTransitionTime = useMemo(() => {
    const detected =
      findSubtitleStart(sanitizedSubtitles, "now, choose") ??
      findSubtitleStart(sanitizedSubtitles, "choose your") ??
      findSubtitleStart(sanitizedSubtitles, "select your") ??
      findSubtitleStart(sanitizedSubtitles, "preferred") ??
      findSubtitleStart(sanitizedSubtitles, "अपनी पसंद की") ??
      findSubtitleStart(sanitizedSubtitles, "पसंद की") ??
      findSubtitleStart(sanitizedSubtitles, "अवधि") ??
      10.8;

    if (!videoDuration || !Number.isFinite(videoDuration)) return detected;

    const finalHoldSeconds = Math.min(6, Math.max(4, videoDuration * 0.34));
    const selectorHoldSeconds = Math.min(5, Math.max(3, videoDuration * 0.24));
    const latestIntroTransition = Math.max(4, videoDuration - finalHoldSeconds - selectorHoldSeconds);

    return Math.min(detected, latestIntroTransition);
  }, [sanitizedSubtitles, videoDuration]);

  const selectorTransitionTime = useMemo(() => {
    const detected =
      findSubtitleStart(sanitizedSubtitles, "thank you") ??
      findSubtitleStart(sanitizedSubtitles, "your offer") ??
      findSubtitleStart(sanitizedSubtitles, "our team") ??
      findSubtitleStart(sanitizedSubtitles, "assist") ??
      findSubtitleStart(sanitizedSubtitles, "धन्यवाद") ??
      findSubtitleStart(sanitizedSubtitles, "हमारी टीम") ??
      findSubtitleStart(sanitizedSubtitles, "मदद") ??
      findSubtitleStart(sanitizedSubtitles, "सहायता") ??
      findSubtitleStart(sanitizedSubtitles, "कॉल करें") ??
      findSubtitleStart(sanitizedSubtitles, "संपर्क") ??
      findSubtitleStart(sanitizedSubtitles, "call us") ??
      findSubtitleStart(sanitizedSubtitles, "contact") ??
      findSubtitleStart(sanitizedSubtitles, "support") ??
      22.0;

    if (!videoDuration || !Number.isFinite(videoDuration)) return detected;

    const finalHoldSeconds = Math.min(5, Math.max(3, videoDuration * 0.24));
    const latestSelectorPause = Math.max(introTransitionTime + 1.2, videoDuration - finalHoldSeconds);
    const earliestSelectorPause = Math.min(videoDuration - 1.2, introTransitionTime + 1.2);

    return Math.min(Math.max(detected, earliestSelectorPause), latestSelectorPause);
  }, [introTransitionTime, sanitizedSubtitles, videoDuration]);

  const introEndSeconds = useMemo(() => {
    return Math.max(0, introTransitionTime - 0.35);
  }, [introTransitionTime]);

  const selectorEndSeconds = useMemo(() => {
    return Math.max(0, selectorTransitionTime - 0.1);
  }, [selectorTransitionTime]);

  const selectedRow = useMemo(() => {
    if (!data || !rows.length) return null;
    return (
      rows.find((row) => row.amount === selectedAmount && row.tenure === selectedTenure) ||
      rows.find((row) => row.tenure === selectedTenure) ||
      getInitialRow(rows, data)
    );
  }, [data, rows, selectedAmount, selectedTenure]);

  useEffect(() => {
    if (!data || !rows.length) return;
    const initial = getInitialRow(rows, data);
    setSelectedAmount(initial.amount);
    setSelectedTenure(initial.tenure);
    document.title = `${data.client_name} Loan Offer`;
  }, [data, rows]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !data) return;

    const onTimeUpdate = () => {
      const time = video.currentTime;
      const isPastIntro = hasDismissedAvail && time >= introTransitionTime && !confirmed;
      setShowSelectorsOverlay(isPastIntro);

      // Show the Avail Now button 2.5 seconds before pausing, so it matches the audio
      if (time >= Math.max(0, introEndSeconds - 2.5) && !hasDismissedAvail && !confirmed) {
        setShowAvail(true);
      }

      // Pause at the end of the intro
      if (time >= introEndSeconds && !hasDismissedAvail && !confirmed) {
        setShowSelectorsOverlay(false);
        video.pause();
        video.currentTime = introEndSeconds;
      }

      // Show the Confirm button 3 seconds before pausing
      if (hasDismissedAvail && time >= Math.max(0, selectorEndSeconds - 3.0) && !hasDismissedSelector && !confirmed) {
        setShowSelector(true);
      }

      // Pause at the end of the selector phase
      if (hasDismissedAvail && time >= selectorEndSeconds && !hasDismissedSelector && !confirmed) {
        video.pause();
        video.currentTime = selectorEndSeconds;
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [data, showAvail, showSelector, confirmed, hasDismissedAvail, hasDismissedSelector, introEndSeconds, selectorEndSeconds, introTransitionTime]);

  const brandColor = safeText(data?.primary_color, "#053666");
  const accentColor = safeText(data?.secondary_color, "#0f7734");
  const backgroundColor = safeText(data?.interactive_background_color, "#f5f7fb");
  const ctaColor = safeText(data?.interactive_cta_color, "#702082");
  const ctaDarkColor = ctaColor.length === 7 ? `${ctaColor}e6` : ctaColor;
  const ctaTextColor = getTextColorForBg(ctaColor);
  const phoneNumber = safeText(data?.loan_offer?.cta_phone_number, safeText(data?.contact_details, "1800-555-999"));
  const shouldShowTopControls =
    hasStarted &&
    !hasEnded &&
    !confirmed &&
    !showAvail &&
    !showSelector &&
    !showSelectorsOverlay;

  const playFromStart = async () => {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);
    setShowAvail(false);
    setShowSelector(false);
    setShowSelectorsOverlay(false);
    setConfirmed(false);
    setHasDismissedAvail(false);
    setHasDismissedSelector(false);
    setHasEnded(false);
    video.currentTime = 0;
    await video.play();
    if (id) reportEvent(id, "play");
  };

  const togglePlayPause = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  };

  const handleAvailNow = async () => {
    const video = videoRef.current;
    if (!video || !id) return;
    setShowAvail(false);
    setHasDismissedAvail(true);
    setShowSelectorsOverlay(false);
    await video.play();
    reportEvent(id, "avail_now", selectedRow ?? undefined);
  };

  const handleConfirm = async () => {
    const video = videoRef.current;
    if (!video || !id || !selectedRow) return;
    setShowSelector(false);
    setShowSelectorsOverlay(false);
    setHasDismissedSelector(true);
    setConfirmed(true);
    await video.play();
    reportEvent(id, "confirm_loan_offer", selectedRow);
  };

  const handleCall = () => {
    if (id && selectedRow) reportEvent(id, "call_now", selectedRow);
    window.location.href = `tel:${phoneNumber.replace(/\s+/g, "")}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor }}>
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor }}>
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-11 w-11 text-red-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-950">Offer unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">This interactive offer is unavailable or still processing.</p>
        </div>
      </div>
    );
  }

  const uniqueAmounts = Array.from(new Set(rows.map((row) => row.amount))).sort((a, b) => Number(a) - Number(b));
  const availableTenures = rows.filter((row) => row.amount === selectedAmount);
  const visibleTenures = availableTenures.length ? availableTenures : rows;

  return (
    <main
      className="min-h-screen text-slate-950 flex items-center justify-center p-4 lg:p-8"
      style={{
        backgroundColor,
        "--brand": brandColor,
        "--accent": accentColor,
      } as CSSProperties}
    >
      <style>{`
        .button-pulse {
          position: absolute;
          z-index: 20;
          cursor: pointer;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), filter 0.3s ease;
        }
        .button-pulse:hover {
          transform: translate(-50%, -50%) scale(1.04) !important;
          filter: brightness(1.08);
        }
        .button-pulse:active {
          transform: translate(-50%, -50%) scale(0.98) !important;
        }
        .button-pulse .button__wrapper {
          position: relative;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
        .pulsing {
          width: 99%;
          height: 99%;
          border-radius: 90px;
          z-index: 1;
          position: relative;
        }
        .pulsing:before,
        .pulsing:after {
          content: "";
          position: absolute;
          width: 100%;
          height: 100%;
          border: inherit;
          top: 0;
          left: 0;
          z-index: 0;
          background: var(--pulse-bg, #053666);
          border-radius: inherit;
          animation: pulsing-wave 2.5s linear infinite;
        }
        .pulsing:after {
          animation: pulsing-wave-alt 2.5s linear infinite;
        }
        @keyframes pulsing-wave {
          0% {
            opacity: 1;
            transform: scaleY(1) scaleX(1);
          }
          20% {
            opacity: 0.5;
          }
          70% {
            opacity: 0.2;
            transform: scaleY(1.8) scaleX(1.4);
          }
          80% {
            opacity: 0;
            transform: scaleY(1.8) scaleX(1.4);
          }
          90% {
            opacity: 0;
            transform: scaleY(1) scaleX(1);
          }
        }
        @keyframes pulsing-wave-alt {
          0% {
            opacity: 1;
            transform: scaleY(1) scaleX(1);
          }
          20% {
            opacity: 0.5;
          }
          70% {
            opacity: 0.2;
            transform: scaleY(1.3) scaleX(1.15);
          }
          80% {
            opacity: 0;
            transform: scaleY(1.3) scaleX(1.15);
          }
          90% {
            opacity: 0;
            transform: scaleY(1) scaleX(1);
          }
        }
        .premium-btn-inner {
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          box-shadow: inset 0 1px 1.5px rgba(255, 255, 255, 0.4), 0 12px 30px ${ctaColor}80, 0 0 15px ${ctaColor}66 !important;
          font-weight: 900 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .premium-select {
          border: 1px solid ${ctaColor}2e !important;
          box-shadow: 0 4px 12px ${ctaColor}0d, inset 0 2px 4px rgba(0, 0, 0, 0.01) !important;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .premium-select:hover {
          border-color: ${ctaColor}59 !important;
          box-shadow: 0 6px 16px ${ctaColor}14 !important;
        }
        .premium-select:focus {
          border-color: var(--brand, #053666) !important;
          box-shadow: 0 0 0 3px ${ctaColor}26 !important;
        }
      `}</style>

      <div
        ref={containerRef}
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black md:aspect-[9/16] md:h-auto md:w-full md:max-w-[430px] md:rounded-[2.4rem] md:border-[10px] md:border-slate-950 md:bg-slate-950 md:shadow-2xl"
      >
        <video
          ref={videoRef}
          src={data.video_url}
          className="h-full w-full object-cover"
          playsInline
          preload="metadata"
          controls={false}
          onLoadedMetadata={(event) => {
            const duration = event.currentTarget.duration;
            if (Number.isFinite(duration) && duration > 0) {
              setVideoDuration(duration);
            }
          }}
          onEnded={() => {
            setConfirmed(true);
            setHasEnded(true);
          }}
        />

        {import.meta.env.DEV ? (
          <button
            type="button"
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              video.style.opacity = video.style.opacity === "0.15" ? "1" : "0.15";
            }}
            style={{
              position: "absolute",
              left: 8,
              bottom: 8,
              zIndex: 999,
              fontSize: 10,
              padding: "4px 6px",
              borderRadius: 6,
              background: "rgba(0,0,0,0.5)",
              color: "#fff",
              border: "none",
            }}
          >
            debug fade video
          </button>
        ) : null}

        {/* Play Overlay before start */}
        {!hasStarted ? (
          <button
            type="button"
            onClick={() => void playFromStart()}
            className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 text-white z-30 border-0"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-950 shadow-xl">
              <Play className="ml-1 h-8 w-8 fill-current" />
            </span>
            <span className="mt-5 text-sm font-semibold tracking-wide">{data.client_name}</span>
          </button>
        ) : null}

        {/* Floating Top Controls */}
        {shouldShowTopControls ? (
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            <Button
              type="button"
              onClick={() => void togglePlayPause()}
              className="h-10 w-10 rounded-full p-0 flex items-center justify-center backdrop-blur-md transition-colors border border-white/30"
              style={{ backgroundColor: ctaDarkColor, color: ctaTextColor, boxShadow: `0 8px 20px ${ctaColor}66` }}
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </Button>
          </div>
        ) : null}



        {/* Invisible click target over the Remotion-rendered Continue CTA */}
        {showAvail ? (
          <button
            type="button"
            aria-label="Continue to view loan offer"
            onClick={() => void handleAvailNow()}
            style={{
              position: "absolute",
              left: "7.5%",
              right: "7.5%",
              bottom: "5.7%",
              height: "5.5%",
              zIndex: 30,
              border: "none",
              padding: 0,
              margin: 0,
              background: "transparent",
              opacity: 0,
              cursor: "pointer",
              pointerEvents: "auto",
            }}
          />
        ) : null}

        {/* Interactive Selector UI (HTML Overlay) */}
        {(showSelector || showSelectorsOverlay) && !confirmed && selectedRow ? (
          <div style={{ position: 'absolute', top: '15%', left: 0, right: 0, bottom: 0, backgroundColor, padding: '0 5%', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 12, zIndex: 20 }}>

            {/* Controls Card */}
            <div style={{ width: '100%', backgroundColor: '#fff', borderRadius: 24, padding: '16px', boxShadow: `0 8px 30px ${ctaColor}0d` }}>
              {/* Amount Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ width: 32, height: 32, backgroundColor: `${ctaColor}1a`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ctaColor, marginRight: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Loan Amount</div>
              </div>

              {/* Slider */}
              <div style={{ position: 'relative', width: 'calc(100% - 60px)', margin: '0 auto 16px', height: 8, backgroundColor: '#f3f4f6', borderRadius: 8 }}>
                <input
                  type="range"
                  min={0}
                  max={uniqueAmounts.length - 1}
                  value={uniqueAmounts.indexOf(selectedAmount)}
                  onChange={(e) => {
                    const nextAmount = uniqueAmounts[Number(e.target.value)];
                    const nextRow = rows.find(r => r.amount === nextAmount) ?? rows[0];
                    setSelectedAmount(nextAmount);
                    setSelectedTenure(nextRow.tenure);
                  }}
                  style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'pointer', zIndex: 20, margin: 0, padding: 0 }}
                />
                {(() => {
                  const pct = (uniqueAmounts.indexOf(selectedAmount) / Math.max(1, uniqueAmounts.length - 1)) * 100;
                  const thumbLeft = `calc(${pct}% + ${10 - (pct / 100) * 20}px)`;
                  return (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, backgroundColor: ctaColor, borderRadius: 8 }} />
                      <div style={{ position: 'absolute', left: thumbLeft, top: -6, width: 20, height: 20, backgroundColor: '#fff', borderRadius: '50%', border: `5px solid ${ctaColor}`, transform: 'translateX(-50%)', boxShadow: `0 2px 8px ${ctaColor}4d` }} />
                      <div style={{ position: 'absolute', left: thumbLeft, top: -45, background: `linear-gradient(135deg, ${ctaColor}, ${ctaDarkColor})`, color: ctaTextColor, padding: '6px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, transform: 'translateX(-50%)', boxShadow: `0 4px 12px ${ctaColor}4d`, whiteSpace: 'nowrap' }}>
                        {formatAmount(selectedAmount)}
                        <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%) rotate(45deg)', width: 8, height: 8, backgroundColor: ctaColor }} />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Min/Max Labels */}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', fontSize: 12, fontWeight: 500, marginBottom: 20 }}>
                <div>{formatAmount(uniqueAmounts[0])}</div>
                <div>{formatAmount(uniqueAmounts[uniqueAmounts.length - 1])}</div>
              </div>

              <div style={{ width: '100%', height: 1, backgroundColor: '#f3f4f6', marginBottom: 20 }} />

              {/* Tenure Section Header */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, backgroundColor: `${ctaColor}1a`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ctaColor, marginRight: 12 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Tenure <span style={{ fontWeight: 400, color: '#6b7280', fontSize: 13 }}>(in Months)</span></div>
              </div>

              {/* Tenure Pills */}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                {["12", "24", "36", "48", "60"].map((t) => {
                  const isSelected = t === selectedTenure;
                  const isAvailable = visibleTenures.some(r => r.tenure === t);
                  return (
                    <div
                      key={t}
                      onClick={() => {
                        if (isAvailable) setSelectedTenure(t);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        borderRadius: 10,
                        border: isSelected ? 'none' : '1px solid #e5e7eb',
                        background: isSelected ? `linear-gradient(135deg, ${ctaColor}, ${ctaDarkColor})` : '#fff',
                        color: isSelected ? ctaTextColor : '#4b5563',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                        boxShadow: isSelected ? `0 4px 12px ${ctaColor}33` : 'none',
                        opacity: isAvailable || isSelected ? 1 : 0.4
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{t}</div>
                      <div style={{ fontSize: 10, fontWeight: 500, opacity: isSelected ? 0.9 : 0.6 }}>Months</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary Card */}
            <div style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 24, padding: '16px', border: '1px solid rgba(255,255,255,1)', boxShadow: `0 8px 30px ${ctaColor}0d`, backdropFilter: 'blur(10px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, backgroundColor: `${ctaColor}1a`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ctaColor, marginRight: 10 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path><path d="M16 14h-6"></path><path d="M12 18H8"></path><path d="M16 10h-2"></path><path d="M8 10h.01"></path></svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Loan Summary</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', color: '#4b5563' }}><svg style={{ marginRight: 6, opacity: 0.6 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 18V6"></path></svg> Amount</div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{formatAmount(selectedAmount)}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px dashed #e5e7eb', fontSize: 14, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', color: '#4b5563' }}><svg style={{ marginRight: 6, opacity: 0.6 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> Tenure</div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{selectedTenure} Months</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: ctaColor }}>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 700 }}><svg style={{ marginRight: 6 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"></rect><rect x="10" y="8" width="4" height="13"></rect><rect x="2" y="13" width="4" height="8"></rect></svg> Monthly EMI</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{formatAmount(selectedRow.emi)}</div>
              </div>
            </div>

            {/* Action Button */}
            <div
              onClick={() => void handleConfirm()}
              style={{ marginTop: 'auto', marginBottom: '6%', width: '100%', padding: '16px 0', background: `linear-gradient(135deg, ${ctaColor} 0%, ${ctaDarkColor} 100%)`, borderRadius: 20, color: ctaTextColor, fontSize: 18, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: `0 8px 20px ${ctaColor}40`, cursor: 'pointer' }}
            >
              Proceed
              <svg style={{ marginLeft: 8 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </div>

          </div>
        ) : null}

        {/* Dynamic Confirmed Screen Overlay */}
        {confirmed && selectedRow ? (
          <div style={{ position: 'absolute', inset: 0, zIndex: 40, backgroundColor, display: 'flex', flexDirection: 'column', padding: '20px 16px', overflowY: 'hidden' }}>
            <div style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 28, padding: '20px 16px', boxShadow: `0 12px 30px ${ctaColor}0d`, border: '1px solid rgba(255,255,255,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

              {/* Green Check */}
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #4ade80, #16a34a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(22, 163, 74, 0.3)', marginBottom: 12 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>

              <div style={{ fontSize: 24, fontWeight: 800, color: '#1e1b4b', marginBottom: 6 }}>
                Offer Confirmed!
              </div>
              <div style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, marginBottom: 16, textAlign: 'center' }}>
                Our team will help you complete the next steps
              </div>

              {/* Details Box (Glassmorphism 3-column) */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '12px 6px', backgroundColor: `${ctaColor}0d`, borderRadius: 16, border: `1px solid ${ctaColor}33`, marginBottom: 20 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: `${ctaColor}26`, color: ctaColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"></path><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"></path><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"></path></svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', marginBottom: 2 }}>{formatAmount(selectedRow.amount)}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>Loan Amount</div>
                </div>
                <div style={{ width: 1, backgroundColor: `${ctaColor}33` }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: `${ctaColor}26`, color: ctaColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', marginBottom: 2 }}>{selectedRow.tenure}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>Months</div>
                </div>
                <div style={{ width: 1, backgroundColor: `${ctaColor}33` }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: `${ctaColor}26`, color: ctaColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"></rect><rect x="10" y="8" width="4" height="13"></rect><rect x="2" y="13" width="4" height="8"></rect></svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1e1b4b', marginBottom: 2 }}>{formatAmount(selectedRow.emi)}<span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>/mo</span></div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>EMI</div>
                </div>
              </div>

              {/* Timeline / What's Next */}
              <div style={{ width: '100%', marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>What's next?</div>

                <div style={{ position: 'relative', paddingLeft: 24 }}>
                  {/* Vertical Line */}
                  <div style={{ position: 'absolute', left: 7, top: 10, bottom: 20, width: 2, backgroundColor: `${ctaColor}33` }} />

                  {/* Steps */}
                  {[
                    {
                      title: "1. Document verification",
                      desc: "Our team will verify your documents within 24 hours",
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    },
                    {
                      title: "2. Agreement signing",
                      desc: "e-Sign the agreement securely from your device",
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    },
                    {
                      title: "3. Disbursal",
                      desc: "Loan amount will be credited to your account",
                      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="20" width="20" height="2"></rect><rect x="4" y="10" width="2" height="7"></rect><rect x="10" y="10" width="2" height="7"></rect><rect x="18" y="10" width="2" height="7"></rect><polygon points="12 2 2 7 22 7 12 2"></polygon></svg>
                    }
                  ].map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', marginBottom: 12, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: -24, top: 4, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', zIndex: 1 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <div style={{ width: 28, height: 28, backgroundColor: `${ctaColor}1a`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ctaColor, marginRight: 12, flexShrink: 0 }}>
                        {step.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e1b4b', marginBottom: 2 }}>{step.title}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.3 }}>{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div onClick={handleCall} style={{ width: '100%', padding: '12px 0', background: `linear-gradient(135deg, ${ctaColor} 0%, ${ctaDarkColor} 100%)`, borderRadius: 12, color: ctaTextColor, fontSize: 16, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: `0 8px 16px ${ctaColor}40`, cursor: 'pointer' }}>
                <svg style={{ marginRight: 8 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                Call {phoneNumber}
                <svg style={{ marginLeft: 8 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>

              {hasEnded ? (
                <div onClick={() => void playFromStart()} style={{ marginTop: 16, cursor: 'pointer', color: '#6b7280', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  <svg style={{ marginRight: 4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v6h6"></path><path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path></svg>
                  Replay offer
                </div>
              ) : null}

            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 12, color: '#6b7280', fontSize: 11, fontWeight: 500 }}>
              <svg style={{ marginRight: 4 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Your information is 100% secure with us
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

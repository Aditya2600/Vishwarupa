import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, Pause, Phone, Play, RotateCcw } from "lucide-react";
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
    return (
      findSubtitleStart(sanitizedSubtitles, "now, choose") ??
      findSubtitleStart(sanitizedSubtitles, "choose your") ??
      findSubtitleStart(sanitizedSubtitles, "select your") ??
      findSubtitleStart(sanitizedSubtitles, "preferred") ??
      findSubtitleStart(sanitizedSubtitles, "अपनी पसंद की") ??
      findSubtitleStart(sanitizedSubtitles, "पसंद की") ??
      findSubtitleStart(sanitizedSubtitles, "अवधि") ??
      10.8
    );
  }, [sanitizedSubtitles]);

  const selectorTransitionTime = useMemo(() => {
    return (
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
      22.0
    );
  }, [sanitizedSubtitles]);

  const introEndSeconds = useMemo(() => {
    return Math.max(0, introTransitionTime - 0.1);
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
      const isPastIntro = time >= introTransitionTime && !confirmed;
      setShowSelectorsOverlay(isPastIntro);

      if (time >= introEndSeconds && !showAvail && !hasDismissedAvail && !confirmed) {
        setShowAvail(true);
        video.pause();
        video.currentTime = introEndSeconds;
      }
      if (time >= selectorEndSeconds && !showSelector && !hasDismissedSelector && !confirmed) {
        setShowSelector(true);
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
  const phoneNumber = safeText(data?.loan_offer?.cta_phone_number, safeText(data?.contact_details, "1800-555-999"));

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
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-11 w-11 text-red-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-950">Offer unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">This interactive offer is unavailable or still processing.</p>
        </div>
      </div>
    );
  }

  const uniqueAmounts = Array.from(new Set(rows.map((row) => row.amount)));
  const availableTenures = rows.filter((row) => row.amount === selectedAmount);
  const visibleTenures = availableTenures.length ? availableTenures : rows;

  return (
    <main
      className="min-h-screen bg-[#f5f7fb] text-slate-950 flex items-center justify-center p-4 lg:p-8"
      style={{
        "--brand": brandColor,
        "--accent": accentColor,
        "--pulse-bg": brandColor,
      } as CSSProperties}
    >
      <style>{`
        .button-pulse {
          position: absolute;
          z-index: 20;
          cursor: pointer;
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
        .loan-container::after,
        .tenure-container::after {
          content: "▼";
          font-size: 14px;
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          pointer-events: none;
          color: #7b6c86;
        }
      `}</style>

      <div
        ref={containerRef}
        className="relative aspect-[9/16] w-full max-w-[430px] overflow-hidden rounded-[2.4rem] border-[10px] border-slate-950 bg-slate-950 shadow-2xl"
      >
        <video
          ref={videoRef}
          src={data.video_url}
          className="h-full w-full object-cover"
          playsInline
          preload="metadata"
          controls={false}
          onEnded={() => {
            setConfirmed(true);
            setHasEnded(true);
          }}
        />

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
        {hasStarted && !hasEnded ? (
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            <Button
              type="button"
              onClick={() => void togglePlayPause()}
              className="h-9 w-9 rounded-full p-0 flex items-center justify-center text-white shadow-lg backdrop-blur-md bg-black/40 hover:bg-black/60 transition-colors border-0"
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </Button>
            <Button
              type="button"
              onClick={handleCall}
              className="h-9 rounded-full px-4 text-xs font-bold text-white shadow-lg backdrop-blur-md bg-black/40 hover:bg-black/60 transition-colors border-0"
            >
              <Phone className="mr-2 h-3.5 w-3.5" />
              Call Now
            </Button>
          </div>
        ) : null}

        {/* Applicant Name Overlay */}
        {hasStarted && !hasDismissedAvail ? (
          <div
            style={{
              position: "absolute",
              top: "15%",
              left: "5%",
              width: "90%",
              height: "28%",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              paddingBottom: "10%",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <div
              style={{
                fontSize: `${videoWidth * 0.078}px`,
                color: brandColor,
                fontWeight: "900",
                fontStyle: "normal",
                textAlign: "center",
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                fontFamily: "figtreeregular, Inter, sans-serif",
                textShadow: `0 2px 16px ${brandColor}33`,
              }}
            >
              {data.customer_name}
            </div>
          </div>
        ) : null}

        {/* Pre-approved Amount Overlay */}
        {hasStarted && !hasDismissedAvail ? (
          <div
            style={{
              position: "absolute",
              top: "52%",
              left: "10%",
              width: "80%",
              height: "20%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            <div
              style={{
                fontSize: `${videoWidth * 0.11}px`,
                color: "#ffffff",
                fontWeight: "800",
                textAlign: "center",
                letterSpacing: "-0.02em",
                textShadow: "0 4px 12px rgba(0,0,0,0.15)",
                fontFamily: "figtreeregular, Inter, sans-serif",
              }}
            >
              {formatAmount(selectedAmount || data.loan_offer?.max_loan_amount)}
            </div>
          </div>
        ) : null}

        {/* Avail Now Pulsing Button */}
        {showAvail ? (
          <div
            className="button-pulse"
            style={{
              bottom: "5%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: `${videoWidth * 0.65}px`,
              height: `${videoWidth * 0.14}px`,
              "--pulse-bg": accentColor,
            } as CSSProperties}
            onClick={() => void handleAvailNow()}
          >
            <div className="button__wrapper">
              <div className="pulsing" style={{ border: `1px solid ${accentColor}` }}></div>
              <button
                type="button"
                className="absolute inset-0 z-10 flex items-center justify-center font-bold text-white rounded-full transition-all border-0 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}, ${brandColor})`,
                  fontSize: `${videoWidth * 0.045}px`,
                }}
              >
                Avail Now
              </button>
            </div>
          </div>
        ) : null}

        {/* Interactive Selectors and Summaries Overlay */}
        {(showSelector || showSelectorsOverlay) && !confirmed && selectedRow ? (
          <>
            {/* Amount Dropdown */}
            <div
              className="loan-container"
              style={{
                position: "absolute",
                top: "28.62%",
                left: "25.7%",
                width: "58.6%",
                height: "5.5%",
                zIndex: 20,
              }}
            >
              <select
                value={selectedAmount}
                onChange={(event) => {
                  const nextAmount = event.target.value;
                  const nextRow = rows.find((row) => row.amount === nextAmount) ?? rows[0];
                  setSelectedAmount(nextAmount);
                  setSelectedTenure(nextRow.tenure);
                }}
                className="w-full h-full bg-white font-semibold text-slate-800 rounded-full pl-5 pr-10 outline-none shadow-md cursor-pointer border border-slate-200 transition-all hover:border-slate-300 focus:ring-2 focus:ring-black/5"
                style={{
                  fontSize: `${videoWidth * 0.042}px`,
                  appearance: "none",
                  WebkitAppearance: "none",
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem center",
                  backgroundSize: "1em",
                }}
              >
                {uniqueAmounts.map((amount) => (
                  <option key={amount} value={amount}>
                    {formatAmount(amount)}
                  </option>
                ))}
              </select>
            </div>

            {/* Tenure Dropdown */}
            <div
              className="tenure-container"
              style={{
                position: "absolute",
                top: "49.4%",
                left: "25.7%",
                width: "58.6%",
                height: "5.5%",
                zIndex: 20,
              }}
            >
              <select
                value={selectedTenure}
                onChange={(event) => setSelectedTenure(event.target.value)}
                className="w-full h-full bg-white font-semibold text-slate-800 rounded-full pl-5 pr-10 outline-none shadow-md cursor-pointer border border-slate-200 transition-all hover:border-slate-300 focus:ring-2 focus:ring-black/5"
                style={{
                  fontSize: `${videoWidth * 0.042}px`,
                  appearance: "none",
                  WebkitAppearance: "none",
                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 1rem center",
                  backgroundSize: "1em",
                }}
              >
                {visibleTenures.map((row) => (
                  <option key={`${row.amount}-${row.tenure}`} value={row.tenure}>
                    {row.tenure} Months
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Amount Display Label */}
            <div
              style={{
                position: "absolute",
                top: "65.908%",
                left: "37.7%",
                width: "53.8%",
                height: "5.5%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  fontSize: `${videoWidth * 0.038}px`,
                  color: brandColor,
                  fontWeight: "800",
                  letterSpacing: "0.01em",
                  fontFamily: "figtreeregular, Inter, sans-serif",
                }}
              >
                {formatAmount(selectedRow.amount)}
              </div>
            </div>

            {/* Selected Tenure Display Label */}
            <div
              style={{
                position: "absolute",
                top: "71.647%",
                left: "37.7%",
                width: "53.8%",
                height: "5.5%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  fontSize: `${videoWidth * 0.038}px`,
                  color: brandColor,
                  fontWeight: "800",
                  letterSpacing: "0.01em",
                  fontFamily: "figtreeregular, Inter, sans-serif",
                }}
              >
                {selectedRow.tenure} Months
              </div>
            </div>

            {/* Selected EMI Display Label */}
            <div
              style={{
                position: "absolute",
                top: "78.082%",
                left: "37.7%",
                width: "53.8%",
                height: "5.5%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              <div
                style={{
                  fontSize: `${videoWidth * 0.038}px`,
                  color: brandColor,
                  fontWeight: "800",
                  letterSpacing: "0.01em",
                  fontFamily: "figtreeregular, Inter, sans-serif",
                }}
              >
                {formatAmount(selectedRow.emi)}
              </div>
            </div>
          </>
        ) : null}

        {/* Confirm Loan Offer Pulsing Button */}
        {showSelector && !confirmed && selectedRow ? (
          <div
            className="button-pulse"
            style={{
              bottom: "1%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: `${videoWidth * 0.65}px`,
              height: `${videoWidth * 0.14}px`,
              "--pulse-bg": brandColor,
            } as CSSProperties}
            onClick={() => void handleConfirm()}
          >
            <div className="button__wrapper">
              <div className="pulsing" style={{ border: `1px solid ${brandColor}` }}></div>
              <button
                type="button"
                className="absolute inset-0 z-10 flex items-center justify-center font-bold text-white rounded-full transition-all border-0 shadow-lg px-2"
                style={{
                  background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
                  fontSize: `${videoWidth * 0.04}px`,
                }}
              >
                Confirm Loan Offer
              </button>
            </div>
          </div>
        ) : null}

        {/* End Overlay buttons */}
        {hasEnded ? (
          <div className="absolute inset-x-5 bottom-10 flex flex-col gap-3 animate-in fade-in zoom-in duration-300 z-20">
            <Button
              type="button"
              onClick={handleCall}
              className="h-14 w-full rounded-full text-base font-bold text-white shadow-2xl ring-4 ring-white/20 border-0"
              style={{ backgroundColor: accentColor }}
            >
              <Phone className="mr-2 h-5 w-5 fill-current" />
              Call {phoneNumber}
            </Button>
            <Button
              type="button"
              onClick={() => void playFromStart()}
              className="h-14 w-full rounded-full text-base font-bold bg-white/95 text-slate-900 shadow-xl hover:bg-white border-0"
            >
              <RotateCcw className="mr-2 h-5 w-5" />
              Replay offer
            </Button>
          </div>
        ) : null}
      </div>
    </main>
  );
}

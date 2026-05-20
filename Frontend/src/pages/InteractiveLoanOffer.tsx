import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Pause, Phone, Play, RotateCcw } from "lucide-react";
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
  return hit && typeof hit.start === "number" ? hit.start : null;
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
  const [hasStarted, setHasStarted] = useState(false);
  const [showAvail, setShowAvail] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
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

  // How many seconds BEFORE the guiding subtitle phrase to pause and show the button.
  // This ensures the user sees the button while the narration is still guiding them.
  const PRE_SHOW_BUFFER = 1.5;

  const introEndSeconds = useMemo(() => {
    const subs = data?.subtitles;
    const raw =
      findSubtitleStart(subs, "select your") ??
      findSubtitleStart(subs, "preferred") ??
      findSubtitleStart(subs, "पसंद की") ??
      findSubtitleStart(subs, "अवधि") ??
      10.8;
    return Math.max(0, raw - PRE_SHOW_BUFFER);
  }, [data]);

  const selectorEndSeconds = useMemo(() => {
    const subs = data?.subtitles;
    const raw =
      findSubtitleStart(subs, "our team") ??
      findSubtitleStart(subs, "assist") ??
      findSubtitleStart(subs, "हमारी टीम") ??
      findSubtitleStart(subs, "मदद") ??
      22.0;
    return Math.max(0, raw - PRE_SHOW_BUFFER);
  }, [data]);

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
      if (time >= introEndSeconds - 0.2 && time <= introEndSeconds + 1.0 && !showAvail && !hasDismissedAvail && !confirmed) {
        setShowAvail(true);
        video.pause();
      }
      if (time >= selectorEndSeconds - 0.2 && time <= selectorEndSeconds + 1.0 && !showSelector && !hasDismissedSelector && !confirmed) {
        setShowSelector(true);
        video.pause();
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
  }, [data, showAvail, showSelector, confirmed, hasDismissedAvail, hasDismissedSelector, introEndSeconds, selectorEndSeconds]);

  const brandColor = safeText(data?.primary_color, "#053666");
  const accentColor = safeText(data?.secondary_color, "#0f7734");
  const phoneNumber = safeText(data?.loan_offer?.cta_phone_number, safeText(data?.contact_details, "1800-555-999"));

  const playFromStart = async () => {
    const video = videoRef.current;
    if (!video) return;
    setHasStarted(true);
    setShowAvail(false);
    setShowSelector(false);
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
      className="min-h-screen bg-[#f5f7fb] text-slate-950"
      style={{ "--brand": brandColor, "--accent": accentColor } as CSSProperties}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        <section className="flex flex-1 items-center justify-center px-4 py-6 lg:px-8">
          <div className="relative w-full max-w-[430px] overflow-hidden rounded-[2.4rem] border-[10px] border-slate-950 bg-slate-950 shadow-2xl">
            <video
              ref={videoRef}
              src={data.video_url}
              className="aspect-[9/16] w-full bg-black object-cover"
              playsInline
              preload="metadata"
              controls={false}
              onEnded={() => {
                setConfirmed(true);
                setHasEnded(true);
              }}
            />

            {!hasStarted ? (
              <button
                type="button"
                onClick={() => void playFromStart()}
                className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/65 text-white"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-950 shadow-xl">
                  <Play className="ml-1 h-8 w-8 fill-current" />
                </span>
                <span className="mt-5 text-sm font-semibold tracking-wide">{data.client_name}</span>
              </button>
            ) : null}

            {hasStarted && !hasEnded ? (
              <div className="absolute right-4 top-4 z-10 flex gap-2">
                <Button
                  type="button"
                  onClick={() => void togglePlayPause()}
                  className="h-9 w-9 rounded-full p-0 flex items-center justify-center text-white shadow-lg backdrop-blur-md bg-black/40 hover:bg-black/60 transition-colors"
                >
                  {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                </Button>
                <Button
                  type="button"
                  onClick={handleCall}
                  className="h-9 rounded-full px-4 text-xs font-bold text-white shadow-lg backdrop-blur-md bg-black/40 hover:bg-black/60 transition-colors"
                >
                  <Phone className="mr-2 h-3.5 w-3.5" />
                  Call Now
                </Button>
              </div>
            ) : null}

            {showAvail ? (
              <div className="absolute inset-x-5 bottom-8">
                <Button
                  type="button"
                  onClick={() => void handleAvailNow()}
                  className="h-14 w-full rounded-full text-base font-bold text-white shadow-xl"
                  style={{ backgroundColor: accentColor }}
                >
                  Avail Now
                </Button>
              </div>
            ) : null}

            {showSelector && selectedRow ? (
              <div className="absolute inset-x-4 bottom-5 rounded-3xl bg-white/96 p-4 shadow-2xl ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Loan offer</div>
                    <div className="mt-1 text-lg font-black text-slate-950">{data.customer_name}</div>
                  </div>
                  <CheckCircle2 className="mt-1 h-6 w-6" style={{ color: accentColor }} />
                </div>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">Loan amount</span>
                    <select
                      value={selectedAmount}
                      onChange={(event) => {
                        const nextAmount = event.target.value;
                        const nextRow = rows.find((row) => row.amount === nextAmount) ?? rows[0];
                        setSelectedAmount(nextAmount);
                        setSelectedTenure(nextRow.tenure);
                      }}
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none"
                    >
                      {uniqueAmounts.map((amount) => (
                        <option key={amount} value={amount}>
                          {formatAmount(amount)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">Tenure</span>
                    <select
                      value={selectedTenure}
                      onChange={(event) => setSelectedTenure(event.target.value)}
                      className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none"
                    >
                      {visibleTenures.map((row) => (
                        <option key={`${row.amount}-${row.tenure}`} value={row.tenure}>
                          {row.tenure} Months
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <SummaryTile label="Amount" value={formatAmount(selectedRow.amount)} />
                  <SummaryTile label="Tenure" value={`${selectedRow.tenure} mo`} />
                  <SummaryTile label="EMI" value={formatAmount(selectedRow.emi)} />
                </div>

                <Button
                  type="button"
                  onClick={() => void handleConfirm()}
                  className="mt-4 h-12 w-full rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  Confirm Loan Offer
                </Button>
              </div>
            ) : null}

            {hasEnded ? (
              <div className="absolute inset-x-5 bottom-10 flex flex-col gap-3 animate-in fade-in zoom-in duration-300 z-20">
                <Button
                  type="button"
                  onClick={handleCall}
                  className="h-14 w-full rounded-full text-base font-bold text-white shadow-2xl ring-4 ring-white/20"
                  style={{ backgroundColor: accentColor }}
                >
                  <Phone className="mr-2 h-5 w-5 fill-current" />
                  Call {phoneNumber}
                </Button>
                <Button 
                  type="button" 
                  onClick={() => void playFromStart()} 
                  className="h-14 w-full rounded-full text-base font-bold bg-white/95 text-slate-900 shadow-xl hover:bg-white"
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Replay offer
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="border-t border-slate-200 bg-white px-6 py-7 lg:w-[410px] lg:border-l lg:border-t-0 lg:px-8">
          <div className="max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: accentColor }}>
              {data.client_name}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              Personalized loan offer
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {data.customer_name}, your available offer can be selected and confirmed from this page.
            </p>

            {selectedRow ? (
              <div className="mt-7 grid gap-3">
                <DetailRow label="Selected amount" value={formatAmount(selectedRow.amount)} />
                <DetailRow label="Selected tenure" value={`${selectedRow.tenure} Months`} />
                <DetailRow label="Approx. EMI" value={formatAmount(selectedRow.emi)} />
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xs font-black text-slate-950">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="text-base font-black text-slate-950">{value}</span>
    </div>
  );
}

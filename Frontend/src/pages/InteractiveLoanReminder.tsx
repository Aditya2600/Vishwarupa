import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { LoanVideoPlayer } from "@/components/LoanVideoPlayer";
import { fetchInteractiveLoanReminder, type InteractiveLoanReminder } from "@/lib/api";

export default function InteractiveLoanReminder() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery<InteractiveLoanReminder>({
    queryKey: ["interactive-loan-reminder", id],
    queryFn: () => fetchInteractiveLoanReminder(id!),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading video...
        </div>
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-300" />
            <p className="text-sm font-semibold">Unable to load this video</p>
          </div>
          <p className="mt-3 text-sm text-white/80">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm font-semibold">Video not found</p>
          <p className="mt-3 text-sm text-white/80">This link may be invalid or the video is still processing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white px-6 py-10 flex items-center justify-center">
      <div className="w-full max-w-[460px]">
        <LoanVideoPlayer
          videoSrc={data.video_url}
          paymentUrl={data.payment_url}
          callbackPhone={data.contact_details}
          showCtaAt={46}
        />
        <p className="mt-5 text-center text-xs text-white/60">
          The MP4 visuals are not clickable. Use the on-screen buttons.
        </p>
      </div>
    </div>
  );
}

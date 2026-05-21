import React, { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Play, Loader2, Volume2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/api";

const fetchSharedPdf = async (id: string) => {
  const res = await fetch(buildApiUrl(`/pdf/share/${id}`));
  if (!res.ok) throw new Error("Failed to load notice summary");
  return res.json();
};

export default function PublicPDF() {
  const { id } = useParams<{ id: string }>();
  const [playingKind, setPlayingKind] = useState<"summary" | "next_actions" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-pdf", id],
    queryFn: () => fetchSharedPdf(id!),
    enabled: !!id,
  });

  // Top-Notch: Set professional page title
  React.useEffect(() => {
    if (data?.filename) {
      document.title = `Legal Notice: ${data.filename}`;
    }
  }, [data]);

  const getPdfViewerUrl = (pdfUrl: string) => {
    const separator = pdfUrl.includes("#") ? "&" : "#";
    return `${pdfUrl}${separator}toolbar=0&navpanes=0&scrollbar=0`;
  };

  const toggleAudio = (kind: "summary" | "next_actions") => {
    const url = kind === "summary" ? data?.audio_url : data?.next_actions_audio_url;
    if (!url) return;

    if (playingKind === kind) {
      audioRef.current?.pause();
      setPlayingKind(null);
    } else {
      setPlayingKind(kind);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a]">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] text-white p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold">This link has expired or reached its limit.</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col font-sans">
      {/* Top Action Buttons (Matching your Screenshot) */}
      <div className="p-6 bg-[#1e293b] border-b border-white/5 flex flex-wrap items-center justify-center gap-4 sticky top-0 z-50">
        {data.audio_url && (
          <Button 
            className={`h-14 px-8 w-full sm:w-auto rounded-xl font-bold text-lg transition-all flex items-center gap-3 active:scale-95 shadow-lg ${
              playingKind === "summary" 
                ? "bg-indigo-500 text-white animate-pulse" 
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
            onClick={() => toggleAudio("summary")}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Play className={`w-4 h-4 fill-current ${playingKind === "summary" ? "hidden" : "block"}`} />
              <Volume2 className={`w-4 h-4 ${playingKind === "summary" ? "block" : "hidden"}`} />
            </div>
            Play Summary
          </Button>
        )}

        {data.next_actions_audio_url && (
          <Button 
            className={`h-14 px-8 w-full sm:w-auto rounded-xl font-bold text-lg transition-all flex items-center gap-3 active:scale-95 shadow-lg ${
              playingKind === "next_actions" 
                ? "bg-pink-500 text-white animate-pulse" 
                : "bg-pink-600 hover:bg-pink-500 text-white"
            }`}
            onClick={() => toggleAudio("next_actions")}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Play className={`w-4 h-4 fill-current ${playingKind === "next_actions" ? "hidden" : "block"}`} />
              <Volume2 className={`w-4 h-4 ${playingKind === "next_actions" ? "block" : "hidden"}`} />
            </div>
            Play Next Actions
          </Button>
        )}
      </div>

      {/* Main Content: PDF Viewer */}
      <div className="flex-1 flex flex-col p-4 md:p-8 bg-[#0f172a]">
        <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden border border-white/10">
          <div className="bg-[#334155] px-4 py-3 flex items-center gap-3 border-b border-white/5">
             <FileText className="w-5 h-5 text-indigo-400" />
             <span className="text-white text-sm font-bold truncate">{data.filename}</span>
          </div>
          
          <div className="flex-1 min-h-[600px] bg-[#1e293b] relative">
            {data.pdf_url ? (
              <iframe
                src={getPdfViewerUrl(data.pdf_url)}
                title={data.filename || "Notice PDF"}
                className="w-full h-full min-h-[600px] border-0"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                 <FileText className="w-16 h-16 opacity-10" />
                 <p className="font-medium">Original PDF preview not available.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <audio 
        ref={audioRef} 
        onEnded={() => setPlayingKind(null)}
        className="hidden"
      />
    </div>
  );
}

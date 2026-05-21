import React, { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Upload, Sparkles, MessageCircle, Volume2, Loader2, CheckCircle2, RotateCcw, ArrowRight, X, Send, Phone, List, Layers, Share2, Eye } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl, createCampaign, pushCampaignLeads, updateCampaignStatus } from "@/lib/api";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

const PDF_ID_KEY = "pdf_summarizer_last_id";
const DEFAULT_WHATSAPP_TEMPLATE_ID = "wsp_test2";
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const normalizeCsvHeader = (value: string) =>
  value.trim().replace(/^\uFEFF/, "").toLowerCase().replace(/\s+/g, "_");

const splitCsvLine = (line: string) =>
  line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, ""));

const parseBulkCsvPreview = (csvText: string) => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(normalizeCsvHeader);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
};

const firstPresent = (row: Record<string, string>, keys: string[]) => {
  for (const key of keys) {
    const value = row[normalizeCsvHeader(key)]?.trim();
    if (value) return value;
  }
  return "";
};

const PdfSummarizer = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [restoredFilename, setRestoredFilename] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("Hindi");
  const [gender, setGender] = useState<string>("Female");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [nextActions, setNextActions] = useState<string | null>(null);
  const [nextActionsAudioUrl, setNextActionsAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("single");
  const [bulkItems, setBulkItems] = useState<any[]>([]); // To track multiple files/csv rows
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkTextEditorItem, setBulkTextEditorItem] = useState<any | null>(null);
  const [bulkNextActionsDraft, setBulkNextActionsDraft] = useState("");
  const [isSavingBulkNextActions, setIsSavingBulkNextActions] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const { toast } = useToast();

  const requestAudioGeneration = async ({
    targetId,
    kind,
    lang,
    voiceGender,
    text,
  }: {
    targetId: string;
    kind: "summary" | "next_actions";
    lang: string;
    voiceGender: string;
    text?: string | null;
  }) => {
    const url = buildApiUrl(`/pdf/${targetId}/generate-audio?language=${encodeURIComponent(lang)}&gender=${encodeURIComponent(voiceGender)}&kind=${encodeURIComponent(kind)}`);
    const hasText = typeof text === "string" && text.trim().length > 0;
    const headers = hasText
      ? { ...authHeader(), "Content-Type": "application/json" }
      : authHeader();

    console.info("[pdf-audio] request:start", {
      url,
      kind,
      lang,
      voiceGender,
      hasText,
      textPreview: hasText ? text!.slice(0, 160) : null,
    });

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: hasText ? JSON.stringify({ text }) : undefined,
    });

    const rawBody = await response.text();
    let parsedBody: unknown = rawBody;
    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      parsedBody = rawBody;
    }

    if (!response.ok) {
      console.error("[pdf-audio] request:failed", {
        url,
        status: response.status,
        statusText: response.statusText,
        response: parsedBody,
      });
      const detail =
        parsedBody && typeof parsedBody === "object" && "detail" in parsedBody
          ? String((parsedBody as { detail?: unknown }).detail)
          : `Audio generation failed (${response.status})`;
      throw new Error(detail);
    }

    console.info("[pdf-audio] request:success", {
      url,
      status: response.status,
      response: parsedBody,
    });

    return (parsedBody ?? {}) as { audio_url?: string };
  };

  // On mount: restore last session and fetch config
  useEffect(() => {
    fetch(buildApiUrl("/meta/config"))
      .then(r => r.json())
      .then(data => setConfig(data))
      .catch(e => console.error("Config fetch failed", e));

    const savedId = localStorage.getItem(PDF_ID_KEY);
    if (!savedId) return;
    fetch(buildApiUrl(`/pdf/${savedId}/status`), { headers: authHeader() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.filename) {
          setPdfId(savedId);
          setRestoredFilename(data.filename);
          if (data.summary) setSummary(data.summary);
          if (data.audio_url) setAudioUrl(data.audio_url);
          setNextActions(data.next_actions ?? "");
          if (data.next_actions_audio_url) setNextActionsAudioUrl(data.next_actions_audio_url);
          toast({ title: "Session restored", description: `Resumed: ${data.filename}`, duration: 2000 });
        } else {
          localStorage.removeItem(PDF_ID_KEY);
        }
      })
      .catch(() => localStorage.removeItem(PDF_ID_KEY));
  }, []);

  // Save pdfId to localStorage whenever it changes
  useEffect(() => {
    if (pdfId) localStorage.setItem(PDF_ID_KEY, pdfId);
  }, [pdfId]);

  // Polling for bulk items status
  useEffect(() => {
    const pendingItems = bulkItems.filter(item => item.status !== 'completed' && item.status !== 'failed');
    if (pendingItems.length === 0) return;

    const interval = setInterval(async () => {
      const updatedItems = await Promise.all(bulkItems.map(async (item) => {
        if (item.status === 'completed' || item.status === 'failed') return item;
        
        try {
          const res = await fetch(buildApiUrl(`/pdf/${item._id}/status`), { headers: authHeader() });
          if (res.ok) {
            const data = await res.json();
            return {
              ...item,
              status: data.status,
              phone_number: data.phone_number ?? item.phone_number,
              language: data.language ?? item.language,
              pdf_url: data.pdf_url ?? item.pdf_url,
              summary_text: data.summary ?? item.summary_text,
              next_actions: data.next_actions ?? "",
              audio_url: data.audio_url ?? item.audio_url,
              next_actions_audio_url: data.next_actions_audio_url ?? null,
              name: data.filename || item.name
            };
          }
        } catch (e) {
          console.error("Polling error", e);
        }
        return item;
      }));
      
      setBulkItems(updatedItems);
    }, 3000);

    return () => clearInterval(interval);
  }, [bulkItems]);

  const handleReset = () => {
    setFile(null);
    setPdfId(null);
    setSummary(null);
    setNextActions(null);
    setAudioUrl(null);
    setNextActionsAudioUrl(null);
    setRestoredFilename(null);
    localStorage.removeItem(PDF_ID_KEY);
    toast({ title: "Ready for new document", description: "Upload a new PDF to get started.", duration: 2000 });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (uploadedFile.type !== "application/pdf") {
      toast({ variant: "destructive", title: "Invalid file type", description: "Please upload a PDF document.", duration: 2000 });
      return;
    }

    setFile(uploadedFile);
    setIsUploading(true);
    setSummary(null);
    setAudioUrl(null);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const previewRows = parseBulkCsvPreview(await uploadedFile.text());
      const response = await fetch(buildApiUrl("/pdf/upload"), { method: "POST", headers: authHeader(), body: formData });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setPdfId(data.pdf_id);
      const initialItems = (data.ids || []).map((id: string, idx: number) => {
        const preview = previewRows[idx] ?? {};
        const phoneNumber = firstPresent(preview, ["phone_number", "phone", "mobile", "mobile_number", "contact_number", "whatsapp", "whatsapp_number"]);
        const pdfUrl = firstPresent(preview, ["pdf_link", "pdf_url", "url", "link", "source", "source_url"]);
        const lang = firstPresent(preview, ["language", "lang", "language_name"]) || "Hindi";

        return {
          _id: id,
          name: `Record ${idx + 1}`,
          phone_number: phoneNumber,
          pdf_url: pdfUrl,
          language: lang,
          type: "PDF LINK",
          lang,
          status: "pending",
        };
      });
      setBulkItems(initialItems);
      toast({ title: "PDF Uploaded", description: "Text extracted. Summarizing...", duration: 2000 });
      handleSummarize(language, data.pdf_id); // Auto-summarize on upload
    } catch {
      toast({ variant: "destructive", title: "Upload failed", description: "There was an error processing your PDF.", duration: 2000 });
    } finally {
      setIsUploading(false);
    }
  };


  const handleSummarize = async (lang = language, overridePdfId?: string, voiceGender = gender) => {
    const targetId = overridePdfId || pdfId;
    if (!targetId) return;
    
    setIsSummarizing(true);
    setSummary(null); // Clear old summary while loading new one
    setAudioUrl(null);
    setNextActionsAudioUrl(null);
    setNextActions("");
    try {
      const response = await fetch(buildApiUrl(`/pdf/${targetId}/summarize?language=${lang}&gender=${voiceGender}`), {
        method: "POST", headers: authHeader(),
      });
      if (!response.ok) throw new Error("Summarization failed");
      const data = await response.json();
      setSummary(data.summary);
      setNextActions(data.next_actions ?? "");
      toast({ title: "Summary Generated", description: `Summary ready in ${lang} (${voiceGender} voice).`, duration: 2000 });
      
      // Auto-generate both audios for the new summary
      setIsGeneratingAudio(true);
      try {
        const [summaryAudioRes, nextActionsAudioRes] = await Promise.all([
          requestAudioGeneration({
            targetId,
            kind: "summary",
            lang,
            voiceGender,
            text: data.summary,
          }),
          data.next_actions && String(data.next_actions).trim().length > 0
            ? requestAudioGeneration({
                targetId,
                kind: "next_actions",
                lang,
                voiceGender,
                text: data.next_actions,
              })
            : Promise.resolve(null)
        ]);

        if (summaryAudioRes?.audio_url) {
          setAudioUrl(summaryAudioRes.audio_url);
        }
        if (nextActionsAudioRes?.audio_url) {
          setNextActionsAudioUrl(nextActionsAudioRes.audio_url);
        }
        toast({
          title: "Audio Generated",
          description: nextActionsAudioRes?.audio_url
            ? "Summary and next actions audio ready."
            : "Summary audio ready. Next actions remain blank until you add text.",
          duration: 2000
        });
      } catch (audioErr) {
        console.error("[pdf-audio] auto-generation failed", {
          targetId,
          lang,
          voiceGender,
          error: audioErr,
        });
        toast({ variant: "destructive", title: "Audio generation failed", description: "Could not generate audio for the summary.", duration: 2000 });
      } finally {
        setIsGeneratingAudio(false);
      }
    } catch {
      toast({ variant: "destructive", title: "Summarization failed", description: "The system was unable to generate a summary.", duration: 2000 });
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleLanguageChange = (newLang: string) => {
    setLanguage(newLang);
    if (pdfId) {
      toast({ title: `Switching to ${newLang}`, description: "Re-generating summary...", duration: 2000 });
      handleSummarize(newLang);
    }
  };

  const handleGenderChange = (newGender: string) => {
    setGender(newGender);
    if (pdfId && summary) {
      // Re-summarize with the new gender for gender-specific Hindi greeting
      toast({ title: `Switching to ${newGender} voice`, description: "Re-generating summaries...", duration: 2000 });
      handleSummarize(language); // This will use the updated gender state
    }
  };

  const handleGenerateAudio = async () => {
    // default wrapper kept for compatibility — generate summary audio
    return handleGenerateAudioKind("summary");
  };

  const handleGenerateAudioKind = async (kind: "summary" | "next_actions") => {
    if (!pdfId) return;
    setIsGeneratingAudio(true);
    const textToUse = kind === "summary" ? summary : nextActions;
    try {
      const data = await requestAudioGeneration({
        targetId: pdfId,
        kind,
        lang: language,
        voiceGender: gender,
        text: textToUse,
      });
      // store urls appropriately
      if (kind === "summary") {
        setAudioUrl(data.audio_url);
      } else {
        setNextActionsAudioUrl(data.audio_url);
        // Removed setAudioUrl(data.audio_url) to prevent overwriting summary player
      }
      toast({ title: "Audio Generated", description: "Voice message is ready.", duration: 2000 });
    } catch (e: any) {
      console.error("[pdf-audio] manual-generation failed", {
        pdfId,
        kind,
        language,
        gender,
        error: e,
      });
      toast({ variant: "destructive", title: "Audio failed", description: e.message || "Could not generate audio.", duration: 2000 });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!phoneNumber || !pdfId) {
      toast({ variant: "destructive", title: "Missing details", description: "Please enter a valid phone number." });
      return;
    }
    const cleanPhone = phoneNumber.startsWith("91") ? phoneNumber : `91${phoneNumber.replace(/\D/g, '')}`;
    setIsSendingWhatsApp(true);
    try {
      const baseUrl = config?.frontend_url || window.location.origin;
      const summaryPageUrl = `${baseUrl}/s/${pdfId}`;
      const preferredUrl = summaryPageUrl;

      const now = Date.now();
      const campaignPayload = {
        name: `Single Document Share ${new Date(now).toLocaleDateString("en-GB")}`,
        description: `Direct WP send for PDF ${pdfId}`,
        startDate: new Date(now + 60_000).toISOString(),
        endDate: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        templateId: DEFAULT_WHATSAPP_TEMPLATE_ID,
        communicationType: "WHATSAPP",
        campaignType: "WHATSAPP",
      };

      console.info("[pdf-whatsapp] createCampaign payload", campaignPayload);

      const campaignResponse = await createCampaign(campaignPayload);
      console.info("[pdf-whatsapp] createCampaign response", campaignResponse);
      const campaignCode = campaignResponse.data?.campaignCode || campaignResponse.data;
      if (!campaignCode) throw new Error("Could not retrieve campaign code from CPaaS");

      const variables = {
        url: preferredUrl,
        pdfUrl: preferredUrl,
        pdf_url: preferredUrl,
        video_url: preferredUrl,
        summaryUrl: summaryPageUrl,
        summary_url: summaryPageUrl,
      };

      console.info("[pdf-whatsapp] pushCampaignLeads payload", {
        campaignCode,
        leads: [{ phoneNumber: cleanPhone, uniqueId: pdfId, variables }],
      });

      await pushCampaignLeads({
        campaignCode: campaignCode,
        leads: [{ phoneNumber: cleanPhone, uniqueId: pdfId, variables }]
      });

      await updateCampaignStatus(campaignCode, "STARTED");

      toast({ title: "Campaign Started", description: "WhatsApp message has been dispatched." });
      setPhoneNumber("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to send", description: e.message || "An API error occurred." });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const handleBulkFinalizeAndSend = async () => {
    const completedItems = bulkItems.filter((item) => item.status === "completed" && item._id);
    if (!completedItems.length) {
      toast({
        variant: "destructive",
        title: "No completed rows",
        description: "Wait until at least one bulk PDF finishes processing before sending.",
      });
      return;
    }

    setIsSendingBulk(true);
    try {
      const baseUrl = config?.frontend_url || window.location.origin;
      const now = Date.now();
      const campaignPayload = {
        name: `Bulk PDF Share ${new Date(now).toLocaleDateString("en-GB")}`,
        description: `Bulk WhatsApp send for ${completedItems.length} PDF notices`,
        startDate: new Date(now + 60_000).toISOString(),
        endDate: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        templateId: DEFAULT_WHATSAPP_TEMPLATE_ID,
        communicationType: "WHATSAPP",
        campaignType: "WHATSAPP",
      };

      const campaignResponse = await createCampaign(campaignPayload);
      const campaignCode = campaignResponse.data?.campaignCode || campaignResponse.data;
      if (!campaignCode) throw new Error("Could not retrieve campaign code from CPaaS");

      const leads = completedItems
        .map((item) => {
          const pdfId = String(item._id || "").trim();
          const phone = String(item.phone_number || "").trim();
          if (!pdfId || !phone) return null;

          const shareUrl = `${baseUrl}/s/${pdfId}`;
          return {
            phoneNumber: phone.startsWith("91") ? phone : `91${phone.replace(/\D/g, "")}`,
            uniqueId: pdfId,
            variables: {
              url: shareUrl,
              pdfUrl: shareUrl,
              pdf_url: shareUrl,
              video_url: shareUrl,
              summaryUrl: shareUrl,
              summary_url: shareUrl,
            },
          };
        })
        .filter(Boolean);

      if (!leads.length) {
        throw new Error("No valid completed rows with phone numbers were found.");
      }

      await pushCampaignLeads({
        campaignCode,
        leads: leads as Array<{
          phoneNumber: string;
          uniqueId: string;
          variables: Record<string, string>;
        }>,
      });

      await updateCampaignStatus(campaignCode, "STARTED");

      toast({
        title: "Bulk campaign started",
        description: `Queued ${leads.length} WhatsApp messages using ${DEFAULT_WHATSAPP_TEMPLATE_ID}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Bulk send failed",
        description: error?.message || "Could not start the bulk WhatsApp campaign.",
      });
    } finally {
      setIsSendingBulk(false);
    }
  };

  const openBulkTextEditor = (item: any) => {
    setBulkTextEditorItem(item);
    setBulkNextActionsDraft(String(item.next_actions ?? ""));
  };

  const handleSaveBulkNextActions = async () => {
    if (!bulkTextEditorItem?._id) return;

    setIsSavingBulkNextActions(true);
    try {
      const response = await fetch(
        buildApiUrl(`/pdf/${bulkTextEditorItem._id}/generate-audio?language=${encodeURIComponent(bulkTextEditorItem.language || language)}&gender=${encodeURIComponent(gender)}&kind=next_actions`),
        {
          method: "POST",
          headers: { ...authHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ text: bulkNextActionsDraft }),
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Failed to regenerate next actions audio.");
      }

      const data = await response.json();
      const nextActionsText = bulkNextActionsDraft.trim();
      setBulkItems((prev) =>
        prev.map((item) =>
          item._id === bulkTextEditorItem._id
            ? {
                ...item,
                next_actions: bulkNextActionsDraft,
                next_actions_audio_url: nextActionsText ? (data.audio_url || item.next_actions_audio_url) : null,
              }
            : item
        )
      );

      toast({
        title: nextActionsText ? "Next actions updated" : "Next actions cleared",
        description: nextActionsText
          ? "The edited next-actions audio was regenerated successfully."
          : "Next actions text is blank, so no audio was generated.",
      });
      setBulkTextEditorItem(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error?.message || "Could not update next actions audio.",
      });
    } finally {
      setIsSavingBulkNextActions(false);
    }
  };

  const handleWhatsAppLog = async () => {
    if (!pdfId) return;
    try {
      const response = await fetch(buildApiUrl(`/pdf/${pdfId}/whatsapp-log`), { method: "POST", headers: authHeader() });
      if (!response.ok) throw new Error("Logging failed");
      toast({ title: "WhatsApp Logged", description: "The summary has been recorded in your WhatsApp logs.", duration: 2000 });
    } catch {
      toast({ variant: "destructive", title: "Logging failed", description: "Could not record activity in logs.", duration: 2000 });
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
      <HeaderBar primaryLabel="PDF Summarizer" />
      
      <main className="container mx-auto px-6 py-12 max-w-6xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8 flex flex-col items-center">
            <TabsList className="grid w-80 grid-cols-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1">
              <TabsTrigger value="single" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Single
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Bulk
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="single" className="w-full mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <Card className="border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-primary" />
                Upload PDF
              </CardTitle>
              <CardDescription>Drag and drop or click to select a file</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`relative group h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all ${
                  file ? "border-primary bg-primary/5 shadow-inner" : "border-slate-300 dark:border-slate-700 hover:border-primary"
                }`}
              >
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleFileUpload}
                  accept=".pdf"
                />
                
                {isUploading ? (
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                ) : file ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-primary mb-2" />
                    <span className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                      {file.name}
                    </span>
                  </>
                ) : restoredFilename ? (
                  <>
                    <CheckCircle2 className="w-10 h-10 text-primary mb-2" />
                    <span className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                      {restoredFilename}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">Tap to replace</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-10 h-10 text-slate-400 group-hover:text-primary mb-2 transition-colors" />
                    <span className="text-slate-500 font-medium font-display">Click to select PDF</span>
                  </>
                )}
              </div>

              <div className="mt-6">
                <Button 
                  className="w-full h-12 text-lg font-semibold glow-purple-sm transition-all hover:scale-[1.02]"
                  disabled={!pdfId || isSummarizing}
                  onClick={() => handleSummarize()}
                >
                  {isSummarizing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Analyzing document...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate AI Summary
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <AnimatePresence>
            {pdfId ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="col-span-1"
              >
                <Card className="h-full border-primary/20 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden glassmorphism">
                  <div className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex justify-between items-center">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-primary" />
                      Document Insights
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors font-medium"
                        title="Start over with a new PDF"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        New PDF
                      </button>
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-400"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                     <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800 overflow-y-auto mb-6 flex flex-col max-h-[400px]">
                        {isSummarizing ? (
                          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                            <p className="text-sm font-medium animate-pulse">AI is analyzing document...</p>
                          </div>
                        ) : summary ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Summary</p>
                              <textarea 
                                value={summary || ''} 
                                onChange={(e) => setSummary(e.target.value)}
                                className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans italic"
                                placeholder="Edit summary here..."
                              />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Next Actions</p>
                              <textarea 
                                value={nextActions || ''} 
                                onChange={(e) => setNextActions(e.target.value)}
                                className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary/20 transition-all font-sans italic"
                                placeholder="Edit next actions here..."
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2 opacity-60">
                            <Sparkles className="w-8 h-8 opacity-20" />
                            <p className="text-sm">Ready to summarize</p>
                          </div>
                        )}
                     </div>

                     <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Language</label>
                            <select 
                                value={language} 
                                onChange={(e) => handleLanguageChange(e.target.value)}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            >
                                <option value="English">English</option>
                                <option value="Hindi">Hindi</option>
                                <option value="Marathi">Marathi</option>
                                <option value="Tamil">Tamil</option>
                                <option value="Telugu">Telugu</option>
                                <option value="Kannada">Kannada</option>
                                <option value="Bengali">Bengali</option>
                                <option value="Gujarati">Gujarati</option>
                                <option value="Malayalam">Malayalam</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Voice Gender</label>
                            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                <button 
                                    onClick={() => handleGenderChange("Male")}
                                    disabled={isGeneratingAudio}
                                    className={`flex-1 h-8 rounded-md text-xs font-bold transition-all ${gender === "Male" ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-500"} disabled:opacity-50`}
                                >
                                    {isGeneratingAudio && gender === "Male" ? "..." : "Male"}
                                </button>
                                <button 
                                    onClick={() => handleGenderChange("Female")}
                                    disabled={isGeneratingAudio}
                                    className={`flex-1 h-8 rounded-md text-xs font-bold transition-all ${gender === "Female" ? "bg-white dark:bg-slate-700 shadow-sm text-primary" : "text-slate-500"} disabled:opacity-50`}
                                >
                                    {isGeneratingAudio && gender === "Female" ? "..." : "Female"}
                                </button>
                            </div>
                        </div>
                     </div>

                     {audioUrl && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-6 space-y-3"
                        >
                            {audioUrl && (
                              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Summary Audio</p>
                                <audio src={audioUrl} controls className="w-full h-10" />
                              </div>
                            )}
                            {nextActionsAudioUrl && (
                              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10">
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">Next Actions Audio</p>
                                <audio src={nextActionsAudioUrl} controls className="w-full h-10" />
                              </div>
                            )}
                        </motion.div>
                     )}
                     
                     <div className="grid grid-cols-2 gap-4 mt-auto">
                        <Button 
                            variant="outline" 
                            className="h-12 border-primary/20 hover:bg-primary/5 font-semibold"
                            onClick={handleGenerateAudio}
                            disabled={isGeneratingAudio}
                        >
                          {isGeneratingAudio ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Volume2 className="mr-2 h-4 w-4 text-primary" />
                          )}
                                Voice Summary
                        </Button>
                              <Button 
                                  variant="outline"
                                  className="h-12 border-primary/20 hover:bg-primary/5 font-semibold"
                                  onClick={() => handleGenerateAudioKind("next_actions")}
                                  disabled={isGeneratingAudio || !nextActions?.trim()}
                              >
                                {isGeneratingAudio ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <Volume2 className="mr-2 h-4 w-4 text-primary" />
                                )}
                                Voice Next Actions
                              </Button>
                  <Button 
                                   className="h-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20"
                                   onClick={() => setShowPreview(true)}
                                   disabled={!audioUrl}
                               >
                                 Next
                                 <ArrowRight className="w-4 h-4 ml-2" />
                               </Button>
                     </div>
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                          <Button 
                              variant="secondary" 
                              className="flex-1 h-11 rounded-xl font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-none transition-all flex items-center justify-center gap-2"
                              onClick={() => {
                                  const baseUrl = config?.frontend_url || window.location.origin;
                                  const shareUrl = `${baseUrl}/s/${pdfId}`;
                                  navigator.clipboard.writeText(shareUrl);
                                  toast({ title: "Share Link Copied!", description: "You can now paste this link on WhatsApp.", duration: 2000 });
                              }}
                              disabled={!summary}
                          >
                              <Share2 className="w-4 h-4" />
                              Copy Share Link
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                  variant="secondary"
                                  className="flex-1 h-11 rounded-xl font-bold bg-green-500/10 text-green-600 hover:bg-green-500/20 border-none transition-all flex items-center justify-center gap-2"
                                  disabled={!summary}
                              >
                                  <MessageCircle className="w-4 h-4" />
                                  Send on WhatsApp
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[280px] shadow-2xl border-slate-200 dark:border-slate-800">
                              <div className="flex flex-col gap-3">
                                <Input 
                                    placeholder="e.g. 919876543210" 
                                    value={phoneNumber} 
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="h-10"
                                  />
                                <Button 
                                  onClick={handleSendWhatsApp} 
                                  disabled={isSendingWhatsApp || !phoneNumber}
                                  className="w-full font-bold bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {isSendingWhatsApp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                  Dispatch Template
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button 
                              variant="outline"
                              className="px-4 h-11 rounded-xl border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all"
                              onClick={() => {
                                  window.open(`${window.location.origin}/s/${pdfId}`, '_blank');
                              }}
                              disabled={!summary}
                              title="Test Locally"
                          >
                              <Eye className="w-4 h-4" />
                          </Button>
                      </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="hidden md:flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-900/10">
                <Sparkles className="w-12 h-12 mb-4 opacity-10 text-primary animate-pulse" />
                <p className="text-sm font-medium font-display opacity-40">PDF Summarizer</p>
              </div>
            )}
          </AnimatePresence>
            </div>
            </TabsContent>

            <TabsContent value="bulk" className="w-full mt-8">
              <Card className="border-primary/20 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden glassmorphism">
                <CardHeader className="bg-primary/5 px-6 py-4 border-b border-primary/10 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Layers className="w-5 h-5 text-primary" />
                      Bulk Processing Mode
                    </CardTitle>
                    <CardDescription>Upload multiple PDFs or a CSV to process in batch</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-primary/20 text-primary" onClick={() => setBulkItems([])}>
                    <RotateCcw className="w-3 h-3" />
                    Reset List
                  </Button>
                </CardHeader>
                <CardContent className="p-8">
                  <div 
                    className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-16 flex flex-col items-center justify-center bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50/50 transition-all cursor-pointer group relative overflow-hidden mb-12"
                    onClick={() => document.getElementById('bulk-upload-csv')?.click()}
                  >
                    <input 
                      type="file" 
                      id="bulk-upload-csv" 
                      hidden 
                      accept=".csv"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const formData = new FormData();
                        formData.append("file", file);
                        
                        try {
                          const previewRows = parseBulkCsvPreview(await file.text());
                          const res = await fetch(buildApiUrl("/pdf/bulk-csv"), { method: "POST", headers: authHeader(), body: formData });
                          const data = await res.json();
                          const initialItems = (data.ids || []).map((id: string, idx: number) => {
                            const preview = previewRows[idx] ?? {};
                            const phoneNumber = firstPresent(preview, ["phone_number", "phone", "mobile", "mobile_number", "contact_number", "whatsapp", "whatsapp_number"]);
                            const pdfUrl = firstPresent(preview, ["pdf_link", "pdf_url", "url", "link", "source", "source_url"]);
                            const lang = firstPresent(preview, ["language", "lang", "language_name"]) || "Hindi";

                            return {
                              _id: id,
                              name: `Record ${idx + 1}`,
                              phone_number: phoneNumber,
                              pdf_url: pdfUrl,
                              language: lang,
                              type: 'PDF LINK',
                              lang,
                              status: 'pending'
                            };
                          });
                          setBulkItems(initialItems);
                          const skippedCount = Number(data.skipped_rows || 0);
                          const description = skippedCount > 0
                            ? `Processing ${initialItems.length} items from CSV. Skipped ${skippedCount} rows that were missing phone or pdf link.`
                            : `Processing ${initialItems.length} items from CSV.`;
                          toast({ title: "Batch Started", description });
                        } catch {
                          toast({ variant: "destructive", title: "Bulk error", description: "Failed to upload mapping CSV." });
                        }
                      }}
                    />
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <List className="w-8 h-8 text-primary opacity-60" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Upload Mapping CSV</h3>
                    <div className="flex flex-col items-center gap-1 text-slate-400 text-xs text-center max-w-sm">
                      <p className="font-medium">Upload a CSV with **phone_number, pdf_link, language** columns.</p>
                      <p className="mt-2 opacity-40 font-mono text-[10px]">The system will stream PDFs directly from the links.</p>
                    </div>
                  </div>

                  {bulkItems.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mt-8 shadow-sm"
                    >
                      <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
                        <Table>
                          <TableHeader className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
                            <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                              <TableHead className="font-bold uppercase tracking-widest text-[10px] py-4 pl-6">Recipient</TableHead>
                              <TableHead className="font-bold uppercase tracking-widest text-[10px]">Source</TableHead>
                              <TableHead className="font-bold uppercase tracking-widest text-[10px]">Lang</TableHead>
                              <TableHead className="font-bold uppercase tracking-widest text-[10px]">Status</TableHead>
                              <TableHead className="text-right font-bold uppercase tracking-widest text-[10px] pr-6">Preview</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {bulkItems.map((item, idx) => (
                              <TableRow key={idx} className="border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                <TableCell className="font-bold text-slate-800 dark:text-slate-100 pl-6 text-sm">{item.phone_number || item.name}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold py-0.5 border-primary/20 text-primary/80 bg-primary/5">URL</Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0 text-slate-300 hover:text-blue-500 hover:bg-blue-500/10"
                                      onClick={() => {
                                        if (!item._id) return;
                                        const baseUrl = config?.frontend_url || window.location.origin;
                                        window.open(`${baseUrl}/s/${item._id}`, "_blank", "noopener,noreferrer");
                                      }}
                                      disabled={!item._id}
                                      title="Open borrower preview"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-slate-400 text-[10px] font-bold">{item.language?.toUpperCase() || '...'}</TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    item.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary animate-pulse'
                                  }`}>
                                    {item.status}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <div className="flex justify-end gap-2">
                                  {(item.summary_text || item.next_actions) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-slate-300 hover:text-violet-500 hover:bg-violet-500/10"
                                      onClick={() => openBulkTextEditor(item)}
                                      title="View / edit text"
                                    >
                                      <FileText className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {item.audio_url && (
                                    <>
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-300 hover:text-emerald-500 hover:bg-emerald-500/10" onClick={() => {
                                        setAudioUrl(item.audio_url);
                                        setSummary(item.summary_text);
                                        setShowPreview(true);
                                      }} title="Preview Audio">
                                        <Volume2 className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-300 hover:text-blue-500 hover:bg-blue-500/10" onClick={() => {
                                        const baseUrl = config?.frontend_url || window.location.origin;
                                        const shareUrl = `${baseUrl}/s/${item._id}`;
                                        navigator.clipboard.writeText(shareUrl);
                                        toast({ title: "Link Copied!", description: "Shareable link for this notice copied to clipboard." });
                                      }} title="Copy Share Link">
                                        <Share2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </motion.div>
                  )}
                  
                  <div className="flex justify-between items-center mt-12 pt-8 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{bulkItems.length} Records In-Queue</span>
                    </div>
                    <Button 
                      className="bg-[#00a884] hover:bg-[#06cf9c] text-secondary font-bold h-14 px-12 shadow-2xl shadow-emerald-500/20 uppercase tracking-widest text-xs transition-all hover:scale-105 active:scale-95"
                      disabled={bulkItems.length === 0 || isSendingBulk}
                      onClick={handleBulkFinalizeAndSend}
                    >
                      {isSendingBulk ? (
                        <Loader2 className="w-4 h-4 mr-3 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-3" />
                      )}
                      Bulk Finalize & Send
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            </Tabs>
      </main>

      {/* WhatsApp Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0b141a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            >
              {/* WhatsApp Header */}
              <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-lg">
                    {restoredFilename?.[0] || file?.name?.[0] || "C"}
                  </div>
                  <div>
                    <h3 className="text-white font-medium text-sm leading-none mb-1">Customer Name</h3>
                    <p className="text-[#8696a0] text-xs">online</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[#8696a0]">
                  <Phone className="w-4 h-4" />
                  <MessageCircle className="w-4 h-4" />
                </div>
              </div>

              {/* WhatsApp Chat Area */}
              <div className="h-[400px] bg-[#0b141a] p-4 flex flex-col gap-4 overflow-y-auto" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: "cover" }}>
                {/* Notice Bubble */}
                <div className="bg-[#202c33] rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm border border-white/5">
                  <div className="flex items-center gap-3 bg-[#111b21] p-2 rounded border border-white/5 mb-2">
                    <FileText className="w-8 h-8 text-primary" />
                    <div className="overflow-hidden">
                      <p className="text-white text-xs font-medium truncate">{restoredFilename || file?.name || "Legal_Notice.pdf"}</p>
                      <p className="text-[#8696a0] text-[10px]">Document • PDF</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[10px] text-[#8696a0]">12:45 PM</span>
                  </div>
                </div>

                {/* Voice Note Bubble */}
                <div className="bg-[#005c4b] rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm self-start">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-black/20 flex items-center justify-center">
                        <Volume2 className="w-6 h-6 text-emerald-300" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#005c4b] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      </div>
                    </div>
                    <div className="flex-1">
                       <audio src={audioUrl || ""} controls className="w-full h-8 opacity-80 filter invert grayscale" />
                       <div className="flex justify-between mt-1">
                         <span className="text-[10px] text-[#8696a0]">0:24</span>
                         <span className="text-[10px] text-[#8696a0]">12:45 PM ✓✓</span>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Input Field */}
              <div className="bg-[#202c33] p-3 flex items-center gap-3">
                <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-2 text-sm text-[#8696a0]">
                  Type a message
                </div>
                <Button 
                  onClick={() => {
                    handleWhatsAppLog();
                    setShowPreview(false);
                  }}
                  className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#06cf9c] p-0 flex items-center justify-center text-[#111b21] shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Text Editor Modal */}
      <AnimatePresence>
        {bulkTextEditorItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 20 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-slate-950 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Preview and Edit</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {bulkTextEditorItem.phone_number || "Unknown number"} · {String(bulkTextEditorItem.language || "Hindi").toUpperCase()}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setBulkTextEditorItem(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5 overflow-y-auto">
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Summary Text</h4>
                      {bulkTextEditorItem.audio_url && (
                        <audio src={bulkTextEditorItem.audio_url} controls className="w-48 h-8" />
                      )}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded-lg p-4 max-h-72 overflow-y-auto">
                      {bulkTextEditorItem.summary_text || "No summary available yet."}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Current Next Actions Audio</h4>
                      {bulkTextEditorItem.next_actions_audio_url ? (
                        <audio src={bulkTextEditorItem.next_actions_audio_url} controls className="w-48 h-8" />
                      ) : (
                        <span className="text-xs text-slate-400">No audio yet</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Edit the next-actions text on the right, then regenerate audio.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-slate-900 dark:text-white">Next Actions Text</h4>
                      <span className="text-xs text-slate-400">Editable</span>
                    </div>
                    <textarea
                      value={bulkNextActionsDraft}
                      onChange={(e) => setBulkNextActionsDraft(e.target.value)}
                      rows={16}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <Button variant="outline" onClick={() => setBulkTextEditorItem(null)}>
                      Close
                    </Button>
                    <Button
                      onClick={handleSaveBulkNextActions}
                      disabled={isSavingBulkNextActions}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      {isSavingBulkNextActions ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Save & Regenerate Audio
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PdfSummarizer;

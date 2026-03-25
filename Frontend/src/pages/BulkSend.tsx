import React, { useState, useEffect } from "react";
import { HeaderBar } from "@/components/HeaderBar";
import {
  Upload,
  FileSpreadsheet,
  Play,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Settings2,
  Users,
  Video,
  ChevronRight,
  ArrowLeft,
  Smartphone,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { fetchAvatars, fetchVoices, isVoiceCompatibleWithLanguage, type AvatarOption, type VoiceOption } from "@/lib/api";
import { cn } from "@/lib/utils";

type Step = "config" | "assets" | "upload" | "mapping" | "preview" | "launch";

export default function BulkSend() {
  const [currentStep, setCurrentStep] = useState<Step>("config");
  const [engine, setEngine] = useState<"avatar" | "remotion">("avatar");
  const [mode, setMode] = useState<"personalized" | "universal">("personalized");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en-US");
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(
    "Hello {{name}},\n\nThis is a friendly reminder from CredResolve regarding your outstanding balance for LAN: {{lan}}. We have prepared a brief explanation for you here: {{video_url}}\n\nPlease resolve the amount of {{loan_amount}} at your earliest convenience to avoid further action.\n\nRegards,\nTeam CredResolve"
  );
  const [videoScript, setVideoScript] = useState<string>(
    "Hello {{customer_name}}. I am calling from {{client_name}} regarding your {{product_type}} account. The total outstanding balance is {{tos}}. Please contact us at {{contact_details}} to discuss repayment options."
  );
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedMsgTemplate, setSelectedMsgTemplate] = useState<string>("reminder");

  const CAMPAIGN_STRATEGIES = [
    {
      id: "reminder",
      name: "Standard Recall",
      desc: "Gentle reminder for initial follow-ups.",
      color: "blue",
      whatsapp: "Hello {{name}},\n\nThis is a friendly reminder from CredResolve regarding your outstanding balance for LAN: {{lan}}. We have prepared a brief explanation for you here: {{video_url}}\n\nPlease resolve the amount of {{loan_amount}} at your earliest convenience to avoid further action.\n\nRegards,\nTeam CredResolve",
      scriptPersonalized: "Hello {{customer_name}}. I am calling from {{client_name}} regarding your {{product_type}} account. The total outstanding balance is {{tos}}. Please contact us at {{contact_details}} to discuss repayment options.",
      scriptUniversal: "Hello. I am calling from your service provider regarding your account. This is a formal notification regarding an outstanding balance. Please contact our recovery department at your earliest convenience to discuss repayment options."
    },
    {
      id: "settlement",
      name: "Settlement Offer",
      desc: "One-time discounts to resolve debts.",
      color: "green",
      whatsapp: "Hi {{name}},\n\nGood news! CredResolve has an exclusive one-time settlement offer for your account {{lan}}. Watch this video to see your discounted amount: {{video_url}}\n\nReply 'YES' to avail this offer today.\n\nBest,\nCredResolve Recovery Team",
      scriptPersonalized: "Greetings {{customer_name}}. We have a special settlement offer for your {{product_type}} account with {{client_name}}. You can now settle your total dues of {{tos}} with a significant discount. Watch the details in this video and contact us immediately.",
      scriptUniversal: "Greetings. We are pleased to inform you that a special settlement offer is now available for your account. You can now settle your outstanding dues with a significant discount. Please watch the details in this video and contact our team to avail of this one-time offer."
    },
    {
      id: "escort",
      name: "Legal Notice",
      desc: "Final escalation for non-cooperative leads.",
      color: "red",
      whatsapp: "URGENT: {{name}},\n\nYour account {{lan}} with CredResolve is now under review for legal escalation. Before we proceed, we've shared a final message for you: {{video_url}}\n\nPlease settle the dues of {{loan_amount}} immediately to halt any further proceedings.\n\nFinal Call,\nLegal Dept, CredResolve",
      scriptPersonalized: "This is a formal legal notice for {{customer_name}} regarding your unpaid {{product_type}} balance at {{client_name}}. Your account is now being reviewed for legal escalation. This is your final opportunity to resolve the outstanding amount of {{tos}} before we proceed.",
      scriptUniversal: "This is a formal legal notification regarding an unpaid balance on your account. Please be advised that your file is now being reviewed for further escalation. This is your final opportunity to resolve the outstanding amount and avoid recovery proceedings. Please contact us immediately."
    },
    {
      id: "success",
      name: "Acknowledgment",
      desc: "Confirming receipt of payment.",
      color: "purple",
      whatsapp: "Thank you {{name}}!\n\nCredResolve has successfully received your payment for LAN: {{lan}}. Your account status has been updated. Watch the summary here: {{video_url}}\n\nWe appreciate your cooperation.\n\nGlobal Collections, CredResolve",
      scriptPersonalized: "Thank you {{customer_name}}. We have successfully received your payment for your {{product_type}} account with {{client_name}}. Your records are now being updated. We appreciate your prompt action.",
      scriptUniversal: "Thank you for your recent payment. We have successfully received the funds and your account records are being updated accordingly. We appreciate your prompt action and cooperation."
    }
  ];

  const handleTemplateSelect = (id: string) => {
    const strategy = CAMPAIGN_STRATEGIES.find(s => s.id === id);
    if (strategy) {
      setWhatsappTemplate(strategy.whatsapp);
      setVideoScript(mode === "personalized" ? strategy.scriptPersonalized : strategy.scriptUniversal);
      setSelectedMsgTemplate(id);
      toast.success(`Switched to ${strategy.name} strategy`);
    }
  };

  const avatarsQuery = useQuery({
    queryKey: ["avatars"],
    queryFn: fetchAvatars,
    enabled: engine === "avatar",
  });

  const voicesQuery = useQuery({
    queryKey: ["voices"],
    queryFn: fetchVoices,
    enabled: engine === "avatar",
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);

      // Basic CSV header parsing
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const firstLine = text.split('\n')[0];
        const headers = firstLine.split(',').map(h => h.trim().replace(/"/g, ''));
        setCsvHeaders(headers);

        // Auto-mapping
        const newMapping: Record<string, string> = {};
        const systemVars = ["name", "phone", "loan_amount", "lan", "client_name"];
        systemVars.forEach(sysVar => {
          const match = headers.find(h => h.toLowerCase().includes(sysVar.toLowerCase()));
          if (match) newMapping[sysVar] = match;
        });
        setMapping(newMapping);
      };
      reader.readAsText(selectedFile);

      toast.success("CSV uploaded successfully!");
      setCurrentStep("mapping");
    }
  };

  const insertVariable = (variable: string) => {
    setWhatsappTemplate(prev => prev + ` {{${variable}}}`);
  };

  const renderConfig = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          className={cn("cursor-pointer border-2 transition-all hover:shadow-md", engine === "avatar" ? "border-primary bg-primary/5" : "border-border")}
          onClick={() => setEngine("avatar")}
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2">
              <Video className="w-6 h-6 text-purple-600" />
            </div>
            <CardTitle>Avatar Video</CardTitle>
            <CardDescription>Use the talking-avatar pipeline to generate personalized videos.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card
          className={cn("cursor-pointer border-2 transition-all hover:shadow-md", engine === "remotion" ? "border-primary bg-primary/5" : "border-border")}
          onClick={() => setEngine("remotion")}
        >
          <CardHeader>
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-2">
              <Play className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle>Text-to-Video</CardTitle>
            <CardDescription>Create cinematic videos from scripts using our Text to Video engine.</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="space-y-4">
        <Label className="text-lg font-semibold">Campaign Type</Label>
        <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cn("flex items-center space-x-3 p-4 rounded-xl border-2 transition-all", mode === "personalized" ? "border-primary bg-primary/5" : "border-border")}>
            <RadioGroupItem value="personalized" id="personalized" />
            <Label htmlFor="personalized" className="flex-1 cursor-pointer">
              <div className="font-bold">Personalized Video</div>
              <div className="text-xs text-muted-foreground">Each recipient gets a unique video with their specific data.</div>
            </Label>
          </div>
          <div className={cn("flex items-center space-x-3 p-4 rounded-xl border-2 transition-all", mode === "universal" ? "border-primary bg-primary/5" : "border-border")}>
            <RadioGroupItem value="universal" id="universal" />
            <Label htmlFor="universal" className="flex-1 cursor-pointer">
              <div className="font-bold">Universal Video</div>
              <div className="text-xs text-muted-foreground">The same video is sent to everyone listed in the CSV.</div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => setCurrentStep("assets")}>
          Continue to Assets <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const [genderFilter, setGenderFilter] = useState<"male" | "female">("male");

  const renderAssets = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-4 bg-secondary/20 rounded-3xl border border-secondary shadow-sm">
        <div className="flex flex-col gap-1.5">
           <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Persona Gender</Label>
           <div className="flex items-center gap-2 p-1.5 bg-background rounded-2xl border">
              {["male", "female"].map(g => (
                <Button 
                  key={g}
                  variant={genderFilter === g ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGenderFilter(g as any)}
                  className="rounded-xl text-xs font-bold capitalize h-8 px-6"
                >
                  {g}
                </Button>
              ))}
           </div>
        </div>

        <div className="w-[200px] flex flex-col gap-1.5">
           <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Campaign Language</Label>
           <select 
              className="w-full bg-background border rounded-2xl p-1.5 text-xs font-bold focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm h-11"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="en-US">English</option>
              <option value="hi-IN">Hindi</option>
              <option value="mr-IN">Marathi</option>
              <option value="ta-IN">Tamil</option>
              <option value="te-IN">Telugu</option>
              <option value="kn-IN">Kannada</option>
              {engine === "remotion" && <option value="bn-IN">Bengali</option>}
              <option value="gu-IN">Gujarati</option>
              {engine === "remotion" && <option value="ml-IN">Malayalam</option>}
              {/* Punjabi removed from both */}
            </select>
        </div>
      </div>

      {engine === "avatar" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <Label>Select Avatar</Label>
            <div className="grid grid-cols-3 gap-3">
              {(avatarsQuery.data || [])
                .filter((av: any) => av.gender?.toLowerCase() === genderFilter)
                .slice(0, 6)
                .map((av: any) => (
                <div
                  key={av.id}
                  onClick={() => setSelectedAvatar(av.id)}
                  className={cn(
                    "relative aspect-[3/4] rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-105",
                    selectedAvatar === av.id ? "border-primary" : "border-transparent"
                  )}
                >
                  <img src={av.preview_image_url} alt={av.name} className="w-full h-full object-cover" />
                  {selectedAvatar === av.id && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-white drop-shadow-md" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 p-1 bg-black/60 text-[10px] text-white truncate text-center">
                    {av.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Label>Select Voice</Label>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {(voicesQuery.data || [])
                .filter((v: any) => v.gender?.toLowerCase() === genderFilter && isVoiceCompatibleWithLanguage(v, selectedLanguage))
                .slice(0, 15).map((v: any) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVoice(v.id)}
                  className={cn(
                    "p-3 rounded-lg border text-sm cursor-pointer transition-colors flex items-center justify-between",
                    selectedVoice === v.id ? "border-primary bg-primary/5" : "hover:bg-secondary/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Play className="w-3 h-3 text-muted-foreground" />
                    </div>
                    <span>{v.name}</span>
                  </div>
                  {selectedVoice === v.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Label className="text-base font-bold">Campaign Strategy Template</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CAMPAIGN_STRATEGIES.map((tmpl) => (
              <Card 
                key={tmpl.id}
                className={cn(
                  "cursor-pointer border-2 transition-all hover:shadow-md h-full",
                  selectedMsgTemplate === tmpl.id ? "border-primary bg-primary/5 shadow-md" : "border-border"
                )}
                onClick={() => handleTemplateSelect(tmpl.id)}
              >
                <CardContent className="pt-6 text-center space-y-2">
                  <div className={cn("w-10 h-10 rounded-full mx-auto flex items-center justify-center",
                      tmpl.color === 'blue' ? "bg-blue-100 text-blue-600" :
                      tmpl.color === 'green' ? "bg-green-100 text-green-600" : 
                      tmpl.color === 'red' ? "bg-red-100 text-red-600" : "bg-purple-100 text-purple-600"
                  )}>
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm">{tmpl.name}</h4>
                  <p className="text-[10px] text-muted-foreground leading-tight">{tmpl.desc}</p>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <div className="text-[8px] px-1 bg-secondary rounded text-muted-foreground uppercase font-bold tracking-widest">{genderFilter + " only"}</div>
                  </div>
                  {selectedMsgTemplate === tmpl.id && (
                    <div className="pt-2">
                      <CheckCircle2 className="w-5 h-5 text-primary mx-auto" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="bg-secondary/10 p-4 rounded-xl border border-dashed animate-in fade-in duration-300">
            <Label className="text-[10px] uppercase font-bold text-muted-foreground mb-2 block tracking-widest">
               {engine === "remotion" ? "AI Video Script Preview" : "WhatsApp Message Preview"}
            </Label>
            <div className="text-xs text-foreground bg-background p-3 rounded-lg border leading-relaxed italic whitespace-pre-wrap opacity-80">
              {engine === "remotion" 
                ? (mode === "personalized" 
                    ? (CAMPAIGN_STRATEGIES.find(t => t.id === selectedMsgTemplate)?.scriptPersonalized || "Select strategy") 
                    : (CAMPAIGN_STRATEGIES.find(t => t.id === selectedMsgTemplate)?.scriptUniversal || "Select strategy"))
                : (CAMPAIGN_STRATEGIES.find(t => t.id === selectedMsgTemplate)?.whatsapp || "Select strategy")
              }
            </div>
          </div>

          <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 flex items-center gap-3">
            <Info className="w-5 h-5 text-primary shrink-0" />
            <p className="text-xs text-muted-foreground">Choosing a strategy here will automatically pre-fill your WhatsApp message and video layout later.</p>
          </div>

          <div className="pt-4 border-t space-y-4">
             <p className="text-[10px] text-muted-foreground ml-1">
               <Info className="w-3 h-3 inline mr-1 text-primary" />
               The system will automatically select the best professional **{genderFilter}** voice for your chosen language ({selectedLanguage}).
             </p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep("config")}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button size="lg" disabled={engine === "avatar" && (!selectedAvatar || !selectedVoice)} onClick={() => setCurrentStep("upload")}>
          Continue to Upload <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-secondary/20 group hover:border-primary/50 transition-colors">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <FileSpreadsheet className="w-10 h-10 text-primary" />
        </div>
        <CardTitle className="mb-2">Upload your audience data</CardTitle>
        <CardDescription className="mb-8 max-w-sm">
          Prepare a CSV with customer info like name, phone, and specific placeholders for your video.
        </CardDescription>
        <div className="flex items-center gap-4">
          <Label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/95 h-12 px-8 flex items-center justify-center rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95">
            Select CSV File
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </Label>
          <Button variant="outline" className="h-12 border-2 px-6 rounded-xl">
            Download Sample CSV
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center bg-secondary/10 p-4 rounded-2xl border-2 border-dashed border-secondary">
        <Button variant="ghost" onClick={() => setCurrentStep("assets")} className="rounded-xl font-bold">
          <ArrowLeft className="mr-2 w-4 h-4" /> Back to Assets
        </Button>
        <Button 
          size="lg" 
          disabled={!file}
          onClick={() => setCurrentStep("mapping")} 
          className="rounded-xl font-black shadow-lg shadow-primary/20 transition-all active:scale-95"
        >
          Continue to Mapping <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-bold">Map CSV Columns</Label>
            <span className="text-xs text-green-500 font-medium bg-green-500/10 px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Auto-detected
            </span>
          </div>
          <div className="space-y-3 bg-secondary/10 p-4 rounded-xl border relative overflow-hidden group">
            {["name", "phone", "loan_amount", "lan", "client_name"].map(sysVar => (
              <div key={sysVar} className="flex items-center gap-3">
                <div className="flex-1 text-sm font-mono bg-primary/5 border border-primary/20 px-3 py-2 rounded-lg text-primary truncate max-w-[140px]">
                  {"{{"} {sysVar} {"}}"}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <select 
                    className="w-full bg-background border-2 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                    value={mapping[sysVar] || ""}
                    onChange={(e) => setMapping(prev => ({ ...prev, [sysVar]: e.target.value }))}
                  >
                    <option value="">-- Choose Column --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-bold">WhatsApp Message Personalized Preview</Label>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-full font-bold uppercase tracking-widest leading-none">
              Auto-filled
            </span>
          </div>
          <div className="space-y-3">
            <div className="relative group">
              <Textarea 
                className="min-h-[220px] rounded-xl border-2 resize-none p-4 text-sm leading-relaxed"
                placeholder="Type your WhatsApp message here..."
                value={whatsappTemplate}
                onChange={(e) => setWhatsappTemplate(e.target.value)}
              />
              <div className="absolute top-2 right-2 opacity-50"><MessageSquare className="w-4 h-4" /></div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] text-muted-foreground w-full">Insert Variable Tag:</span>
              {["name", "video_url", "loan_amount", "lan", "client_name"].map(v => (
                <button 
                  key={v}
                  onClick={() => insertVariable(v)}
                  className="text-[10px] font-bold bg-secondary hover:bg-primary hover:text-white px-2 py-1 rounded-lg border transition-all uppercase"
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-start gap-2">
              <Smartphone className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-blue-700/80">Message will be sent to the phone numbers in your mapped <strong>phone</strong> column.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep("upload")}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button size="lg" onClick={() => setCurrentStep("preview")}>
          Continue to Preview <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-8 animate-in mt-2 fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
             <Label className="text-lg font-bold">Video Preview</Label>
             <span className="text-[10px] px-2 py-1 rounded bg-red-100 text-red-600 font-black animate-pulse uppercase">Live Simulation</span>
          </div>
          <Card className="w-full bg-black border-none overflow-hidden relative shadow-2xl">
            <div className="aspect-video bg-slate-900 flex items-center justify-center relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-8 text-white space-y-2">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Account: {mapping['lan'] || 'LANXXXX'}</h2>
                <p className="text-xl font-medium text-white/90">Amount Due: <span className="text-primary font-bold">₹{mapping['loan_amount'] || '0,000'}</span></p>
                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs uppercase font-bold tracking-widest text-white/40">CredResolve | {selectedMsgTemplate}</span>
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40">
                    <Video className="w-5 h-5 text-primary" />
                  </div>
                </div>
              </div>
              <Play className="w-12 h-12 text-white/20 animate-pulse" />
              <div className="absolute top-8 left-8">
                 <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-primary" />
                 </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Label className="text-lg font-bold">WhatsApp Preview</Label>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/40 relative min-h-[300px] flex flex-col shadow-sm">
             <div className="flex-1 font-sans text-sm text-emerald-900 dark:text-emerald-100 leading-relaxed whitespace-pre-wrap">
               {whatsappTemplate.replace('{{name}}', '[Customer Name]').replace('{{lan}}', mapping['lan'] || '[LAN]').replace('{{loan_amount}}', mapping['loan_amount'] || '[Amount]').replace('{{video_url}}', 'https://vishwarupe.ai/v/example')}
             </div>
             <div className="mt-6 pt-4 border-t border-emerald-200/50 dark:border-emerald-800/50">
                <div className="flex items-center gap-2 text-[10px] text-emerald-600/70 font-bold uppercase tracking-widest">
                   <Smartphone className="w-3 h-3" /> Sending to {mapping['phone'] || 'Mapped Column'}
                </div>
             </div>
             <div className="absolute -top-3 -left-3">
                <div className="bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                   <MessageSquare className="w-4 h-4" />
                </div>
             </div>
          </div>
          <div className="p-3 bg-secondary/30 rounded-xl text-[11px] text-muted-foreground italic flex items-start gap-2">
             <Info className="w-4 h-4 mt-0.5 shrink-0" />
             This preview uses mapping data to simulate the final look. Final videos will vary based on exact CSV values.
          </div>
        </div>
      </div>

      <div className="flex justify-between border-t pt-8">
        <Button variant="ghost" onClick={() => setCurrentStep("mapping")}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back to Mapping
        </Button>
        <Button size="lg" className="px-12" onClick={() => setCurrentStep("launch")}>
          Looks Good, Review Launch <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const renderLaunch = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-card rounded-2xl border-2 overflow-hidden shadow-xl">
        <div className="p-6 bg-primary/5 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-bold">Campaign Ready</h3>
              <p className="text-xs text-muted-foreground">Review your settings before firing.</p>
            </div>
          </div>
          <div className="px-3 py-1 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest">
            Pending
          </div>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Generation Engine</Label>
            <div className="font-bold flex items-center gap-2">
              {engine === "avatar" ? (
                <><Users className="w-4 h-4 text-purple-500" /> Avatar Video</>
              ) : (
                <><Video className="w-4 h-4 text-blue-500" /> Text Video</>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Total Recipients</Label>
            <div className="font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-green-500" /> 1,248 Rows Detected
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Campaign Mode</Label>
            <div className="font-bold flex items-center gap-2 capitalize">
              <Play className="w-4 h-4 text-primary" /> {mode}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Primary Language</Label>
            <div className="font-bold flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" /> {selectedLanguage}
            </div>
          </div>
        </div>
        <div className="p-8 border-t bg-secondary/5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 block">Message Preview</Label>
          <div className="p-4 bg-background border rounded-xl font-mono text-sm line-clamp-3 opacity-60 italic">
            {whatsappTemplate}
          </div>
        </div>
      </div>

      <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-start gap-4">
        <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-700/80">
          <strong>Important:</strong> Launching this campaign will immediately queue all jobs to AWS SQS.
          Avatar videos can take 2-10 mins each to process depending on length. Text renders are usually faster (~45s each).
        </p>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setCurrentStep("preview")}>
          <ArrowLeft className="mr-2 w-4 h-4" /> Back
        </Button>
        <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white px-12" onClick={() => {
          toast.success("1,248 Video Jobs Queued Successfully!");
          setTimeout(() => window.location.href = "/", 2000);
        }}>
          Launch Full Campaign <Sparkles className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <HeaderBar primaryLabel="Bulk Send" />

      <main className="flex-1 w-full max-w-5xl mx-auto p-6 flex flex-col pt-8">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl text-left">
              Bulk Video <span className="text-primary">Campaigns</span>
            </h1>
            <p className="mt-4 text-xl text-muted-foreground max-w-2xl text-left font-medium">
              Scale your personalized communication by reaching thousands via CSV.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-secondary/20 p-2 rounded-2xl border">
            {["config", "assets", "upload", "mapping", "preview", "launch"].map((s, i) => (
              <div
                key={s}
                onClick={() => setCurrentStep(s as Step)}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all cursor-pointer hover:scale-105 active:scale-95",
                  currentStep === s ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-background text-muted-foreground hover:bg-secondary/50"
                )}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1">
          {currentStep === "config" && renderConfig()}
          {currentStep === "assets" && renderAssets()}
          {currentStep === "upload" && renderUpload()}
          {currentStep === "mapping" && renderMapping()}
          {currentStep === "preview" && renderPreview()}
          {currentStep === "launch" && renderLaunch()}
        </div>

        {/* Features section removed as requested */}
      </main>
    </div>
  );
}


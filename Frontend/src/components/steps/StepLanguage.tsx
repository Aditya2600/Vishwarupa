import { useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { REMOTION_SUPPORTED_LANGUAGES } from "@/lib/templates";
import type { VideoType } from "@/store/wizardStore";

const LANGUAGES = [
  { name: "Hindi", native: "हिन्दी" },
  { name: "English", native: "English" },
  { name: "Marathi", native: "मराठी" },
  { name: "Tamil", native: "தமிழ்" },
  { name: "Telugu", native: "తెలుగు" },
  { name: "Kannada", native: "ಕನ್ನಡ" },
  { name: "Bengali", native: "বাংলা" },
  { name: "Gujarati", native: "ગુજરાતી" },
  { name: "Malayalam", native: "മലയാളം" },
  { name: "Punjabi", native: "ਪੰਜਾਬੀ" },
];

interface StepLanguageProps {
  selected: string;
  onSelect: (lang: string) => void;
  videoType: VideoType;
  onVideoTypeChange: (type: VideoType) => void;
  gender: "male" | "female";
  onGenderChange: (gender: "male" | "female") => void;
}

export function StepLanguage({ 
  selected, 
  onSelect, 
  videoType, 
  onVideoTypeChange,
  gender,
  onGenderChange
}: StepLanguageProps) {
  const [search, setSearch] = useState("");
  const remotionLanguageSet = new Set(REMOTION_SUPPORTED_LANGUAGES);
  const avatarUnsupported = new Set(["Bengali", "Malayalam", "Punjabi"]);

  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.native.toLowerCase().includes(search.toLowerCase())
  ).sort((a, b) => {
    const aComingSoon = videoType === "remotion" ? !remotionLanguageSet.has(a.name) : avatarUnsupported.has(a.name);
    const bComingSoon = videoType === "remotion" ? !remotionLanguageSet.has(b.name) : avatarUnsupported.has(b.name);
    if (aComingSoon && !bComingSoon) return 1;
    if (!aComingSoon && bComingSoon) return -1;
    return 0;
  });

  return (
    <div>
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex gap-8">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block">Choose Creation Flow</label>
            <div className="flex p-1 bg-secondary rounded-xl w-fit border border-border">
              <button
                onClick={() => onVideoTypeChange("avatar")}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${videoType === "avatar"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Avatar Video
              </button>
              <button
                onClick={() => onVideoTypeChange("remotion")}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${videoType === "remotion"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Text to Video
              </button>
              <button
                onClick={() => onVideoTypeChange("hybrid_remotion_avatar_pip")}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${videoType === "hybrid_remotion_avatar_pip"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                VisionDesk
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-3 block">Narrator Voice</label>
            <div className="flex p-1 bg-secondary rounded-xl w-fit border border-border relative z-10">
              <button
                onClick={() => onGenderChange("male")}
                className={`relative z-20 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${gender === "male"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Male
              </button>
              <button
                onClick={() => onGenderChange("female")}
                className={`relative z-20 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${gender === "female"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Female
              </button>
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search languages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map((lang) => {
          const isSelected = selected === lang.name;
          const isComingSoon = videoType === "remotion" 
            ? !remotionLanguageSet.has(lang.name as any)
            : avatarUnsupported.has(lang.name as any);
          const isAvailable = !isComingSoon;
          return (
            <button
              key={lang.name}
              disabled={!isAvailable}
              onClick={() => onSelect(lang.name)}
              className={`relative flex items-center p-4 rounded-xl border transition-all duration-200 text-left ${isSelected
                  ? "glow-purple-border border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-surface-hover hover:border-muted-foreground/30"
                } ${!isAvailable ? "opacity-60 cursor-not-allowed grayscale-[0.5]" : ""}`}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {lang.name}
                  {isComingSoon && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 text-[8px] font-bold bg-muted text-muted-foreground rounded tracking-tighter uppercase whitespace-nowrap">
                      Coming Soon
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{lang.native}</p>
              </div>
              {isSelected && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

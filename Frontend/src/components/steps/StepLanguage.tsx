import { useState } from "react";
import { Check, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { REMOTION_SUPPORTED_LANGUAGES } from "@/lib/templates";

const LANGUAGES = [
  { name: "Hindi", native: "हिन्दी", flag: "🇮🇳" },
  { name: "English", native: "English", flag: "🇺🇸" },
  { name: "Marathi", native: "मराठी", flag: "🇮🇳" },
  { name: "Tamil", native: "தமிழ்", flag: "🇮🇳" },
  { name: "Telugu", native: "తెలుగు", flag: "🇮🇳" },
  { name: "Kannada", native: "ಕನ್ನಡ", flag: "🇮🇳" },
  { name: "Bengali", native: "বাংলা", flag: "🇧🇩" },
  { name: "Gujarati", native: "ગુજરાતી", flag: "🇮🇳" },
  { name: "Malayalam", native: "മലയാളം", flag: "🇮🇳" },
  { name: "Punjabi", native: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
];

interface StepLanguageProps {
  selected: string;
  onSelect: (lang: string) => void;
  videoType: "avatar" | "remotion";
  onVideoTypeChange: (type: "avatar" | "remotion") => void;
}

export function StepLanguage({ selected, onSelect, videoType, onVideoTypeChange }: StepLanguageProps) {
  const [search, setSearch] = useState("");
  const remotionLanguageSet = new Set(REMOTION_SUPPORTED_LANGUAGES);
  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.native.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col gap-6 mb-8">
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
          const isComingSoon = videoType === "remotion" && !remotionLanguageSet.has(lang.name);
          const isAvailable = !isComingSoon;
          return (
            <button
              key={lang.name}
              disabled={!isAvailable}
              onClick={() => onSelect(lang.name)}
              className={`relative flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left ${isSelected
                  ? "glow-purple-border border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-surface-hover hover:border-muted-foreground/30"
                } ${!isAvailable ? "opacity-60 cursor-not-allowed grayscale-[0.5]" : ""}`}
            >
              <span className="text-2xl">{lang.flag}</span>
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

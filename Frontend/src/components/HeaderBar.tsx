import { ChevronDown, Clapperboard, LayoutTemplate, Sparkles, Video, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type CreateMode = "avatar" | "remotion";

interface HeaderBarProps {
  onCreateVideo?: (mode?: CreateMode) => void;
  primaryLabel?: string;
}

export function HeaderBar({ onCreateVideo, primaryLabel = "Create Video" }: HeaderBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isVideosPage = location.pathname === "/";
  const isCreatePage = location.pathname === "/create";
  const isTemplatesPage = location.pathname === "/templates";

  const launchCreate = (mode: CreateMode) => {
    navigate(`/create?mode=${mode}&fresh=1`);
    onCreateVideo?.(mode);
  };

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        onClick={() => navigate("/")}
        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity select-none"
      >
        {/* Product wordmark */}
        <span className="font-display text-[1.15rem] font-bold tracking-tight bg-gradient-to-r from-[#5F1284] to-[#8D4DB8] bg-clip-text text-transparent">
          Vishvarupa
        </span>
        {/* "by" label */}
        <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground/50 tracking-wide">by</span>
        {/* CredResolve logo – transparent PNG sized to match cap-height */}
        <img
          src="/credresolve_logo.png"
          alt="CredResolve"
          className="hidden sm:block h-6 md:h-7 w-auto object-contain object-left"
          draggable={false}
        />
      </motion.div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/templates")}
          className={isTemplatesPage ? "text-foreground bg-secondary" : "text-muted-foreground hover:bg-primary hover:text-white"}
        >
          <LayoutTemplate className="md:mr-2 h-4 w-4" />
          <span className="hidden md:inline">Template Library</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className={
            isVideosPage
              ? "text-foreground bg-secondary hover:bg-primary hover:text-white"
              : "text-muted-foreground hover:bg-primary hover:text-white"
          }
        >
          <Video className="md:mr-2 h-4 w-4" />
          <span className="hidden md:inline">My Videos</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className={`bg-primary text-primary-foreground hover:bg-primary/90 glow-purple-sm font-semibold ${isCreatePage ? "ring-1 ring-primary/40" : ""
                }`}
            >
              <Sparkles className="mr-1.5 h-4 w-4" />
              {primaryLabel}
              <ChevronDown className="ml-1.5 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Choose Creation Flow</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => launchCreate("avatar")} className="group items-start gap-3 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-white/15 group-hover:text-white group-data-[highlighted]:bg-white/15 group-data-[highlighted]:text-white">
                <Clapperboard className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-primary group-hover:text-white group-data-[highlighted]:text-white">
                  Avatar Video
                </p>
                <p className="text-xs text-muted-foreground group-hover:text-white group-data-[highlighted]:text-white">
                  Use the talking-avatar pipeline to generate personalized videos.
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => launchCreate("remotion")} className="group items-start gap-3 py-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/12 text-sky-700 transition-colors group-hover:bg-white/15 group-hover:text-white group-data-[highlighted]:bg-white/15 group-data-[highlighted]:text-white">
                <LayoutTemplate className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-sky-700 group-hover:text-white group-data-[highlighted]:text-white">
                  Text to Video
                </p>
                <p className="text-xs text-muted-foreground group-hover:text-white group-data-[highlighted]:text-white">
                  Create cinematic videos from scripts using our Text to Video engine.
                </p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user?.fullName || user?.email || 'User'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

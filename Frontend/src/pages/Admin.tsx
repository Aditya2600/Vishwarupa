import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Users, Video, BarChart3, ShieldCheck, Activity, User, ExternalLink,
  Mail, Clock, LogOut, ChevronLeft, Trash2, Play, X, ChevronDown,
  ChevronRight, Search, Filter, CheckCircle, XCircle, AlertCircle,
  PlayCircle, Ban, Eye
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { buildApiUrl } from "@/lib/api";

/* ─────────────── helpers ─────────────── */
const authFetch = (url: string, token: string, opts?: RequestInit) =>
  fetch(buildApiUrl(url), { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) } });

const statusColor = (s: string) => {
  if (s === "completed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "queued" || s === "processing") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-600 border-red-200";
};

const StatusIcon = ({ s }: { s: string }) => {
  if (s === "completed") return <CheckCircle className="w-3.5 h-3.5" />;
  if (s === "queued" || s === "processing") return <AlertCircle className="w-3.5 h-3.5" />;
  return <XCircle className="w-3.5 h-3.5" />;
};

/* ─────────────── Video Player Modal ─────────────── */
const VideoModal = ({ video, onClose }: { video: any; onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div className="w-full max-w-3xl bg-white rounded-3xl overflow-hidden border border-purple-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-purple-50">
        <div>
          <h3 className="font-bold text-slate-800 truncate max-w-md">{video.title || "Untitled Video"}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {video.request_mode} &nbsp;•&nbsp; <span className={`capitalize font-bold ${video.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>{video.status}</span>
          </p>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-purple-50 transition-colors">
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>
      <div className="bg-slate-50 aspect-video flex items-center justify-center">
        {video.video_url ? (
          <video src={video.video_url} controls autoPlay className="w-full h-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-300">
            <PlayCircle className="w-16 h-16" />
            <span className="text-sm font-bold">No video URL available</span>
          </div>
        )}
      </div>
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-purple-50/40">
        {[
          { label: "User ID", val: video.user_id?.slice(-8) || "—" },
          { label: "Mode", val: video.request_mode || "—" },
          { label: "Status", val: video.status || "—" },
          { label: "Video ID", val: video._id?.slice(-8) || "—" },
        ].map((f) => (
          <div key={f.label}>
            <div className="text-[9px] font-black uppercase tracking-widest text-purple-400">{f.label}</div>
            <div className="text-sm font-bold text-slate-700 mt-0.5 truncate">{f.val}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─────────────── User Row with expandable videos ─────────────── */
const UserRow = ({ u, token, onDeleteVideo }: { u: any; token: string; onDeleteVideo: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<any>(null);

  const videosQuery = useQuery({
    queryKey: ["admin-user-videos", u.id],
    queryFn: () => authFetch(`/admin/users/${u.id}/videos`, token).then((r) => r.json()),
    enabled: open,
  });

  const disableMut = useMutation({
    mutationFn: () => authFetch(`/admin/users/${u.id}/disable`, token, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: (data) => toast.success(data.disabled ? "User disabled" : "User re-enabled"),
  });

  return (
    <>
      {playingVideo && <VideoModal video={playingVideo} onClose={() => setPlayingVideo(null)} />}
      <TableRow className="border-purple-100/70 hover:bg-purple-50/50 transition-colors group cursor-pointer">
        <TableCell className="px-6 py-4" onClick={() => setOpen(!open)}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
              <Mail className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <div className="font-bold text-slate-800">{u.email}</div>
              <div className="text-[10px] text-slate-400 font-medium">{u.full_name}</div>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-center" onClick={() => setOpen(!open)}>
          <div className="flex flex-col items-center">
            <span className="px-3 py-1 bg-purple-50 rounded-full text-sm font-black text-purple-700">{u.video_count}</span>
            <span className="text-[9px] text-emerald-600 font-bold mt-0.5">{u.completed_count} done</span>
          </div>
        </TableCell>
        <TableCell onClick={() => setOpen(!open)}>
          {u.is_admin ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-purple-600">
              <ShieldCheck className="w-3.5 h-3.5" /> Admin
            </span>
          ) : (
            <span className={`text-xs font-medium ${u.disabled ? "text-red-500" : "text-slate-400"}`}>
              {u.disabled ? "Disabled" : "Standard User"}
            </span>
          )}
        </TableCell>
        <TableCell className="pr-6">
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => disableMut.mutate()}
              disabled={u.is_admin}
              className={`p-1.5 rounded-lg text-xs font-bold transition-colors ${u.disabled ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-red-50 text-red-500 hover:bg-red-100"} disabled:opacity-30 disabled:cursor-not-allowed`}
              title={u.disabled ? "Re-enable user" : "Disable user"}
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setOpen(!open)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 transition-colors">
              {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
            </button>
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded video list */}
      {open && (
        <TableRow className="border-purple-100/70 bg-purple-50/30">
          <TableCell colSpan={4} className="px-6 py-4">
            {videosQuery.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full bg-purple-100 rounded-xl" />)}
              </div>
            ) : !Array.isArray(videosQuery.data) || videosQuery.data.length === 0 ? (
              <p className="text-slate-400 text-xs font-bold text-center py-4">No videos found for this user.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {videosQuery.data.map((v: any) => (
                  <div key={v._id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-purple-100 hover:border-purple-300 transition-all group/card shadow-sm">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${statusColor(v.status)}`}>
                      <StatusIcon s={v.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{v.title || "Untitled"}</p>
                      <p className="text-[10px] text-slate-400">{v.request_mode}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
                      {v.video_url && (
                        <button onClick={() => setPlayingVideo(v)} className="p-1.5 rounded-lg bg-purple-50 text-purple-500 hover:bg-purple-100 transition-colors">
                          <Play className="w-3 h-3" />
                        </button>
                      )}
                      <button onClick={() => onDeleteVideo(v._id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

/* ─────────────── Main Dashboard ─────────────── */
const AdminDashboard = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { logout, user } = useAuth();
  const token = localStorage.getItem("token") || "";
  const isAdmin = user?.isAdmin || localStorage.getItem("is_admin") === "true";
  const [tab, setTab] = useState<"overview" | "users" | "videos" | "campaigns">("overview");
  const [videoSearch, setVideoSearch] = useState("");
  const [videoStatus, setVideoStatus] = useState("");
  const [playingVideo, setPlayingVideo] = useState<any>(null);

  useEffect(() => {
    if (!token || !isAdmin) navigate("/admin-login");
  }, [token, isAdmin, navigate]);

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => authFetch("/admin/stats", token).then((r) => r.json()),
  });

  const campaignsQuery = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: () => authFetch("/admin/campaign-analytics", token).then((r) => r.json()),
    enabled: tab === "campaigns",
    refetchInterval: 5000,
  });

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => authFetch("/admin/users", token).then((r) => r.json()),
    enabled: tab === "users",
  });

  const videosQuery = useQuery({
    queryKey: ["admin-all-videos", videoSearch, videoStatus],
    queryFn: () => authFetch(`/admin/all-videos?search=${encodeURIComponent(videoSearch)}&status=${videoStatus}`, token).then((r) => r.json()),
    enabled: tab === "videos",
  });

  const deleteVideoMut = useMutation({
    mutationFn: (id: string) => authFetch(`/admin/videos/${id}`, token, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("Video deleted.");
      qc.invalidateQueries({ queryKey: ["admin-all-videos"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to delete video."),
  });

  if (!isAdmin) return null;

  const stats = statsQuery.data;
  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "videos", label: "All Videos", icon: Video },
    { id: "campaigns", label: "Campaigns", icon: Activity },
  ] as const;

  const campaignStats = campaignsQuery.data?.summary || {};
  const recentCampaigns = campaignsQuery.data?.recent || [];

  return (
    <div className="min-h-screen bg-[#faf8ff] text-slate-800 pb-16" style={{ fontFamily: "'Inter', sans-serif" }}>
      {playingVideo && <VideoModal video={playingVideo} onClose={() => setPlayingVideo(null)} />}

      {/* Admin Nav */}
      <nav className="h-16 flex items-center justify-between px-8 border-b border-purple-100 bg-white/80 backdrop-blur-xl sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-black uppercase tracking-widest text-purple-600">Master Console</span>
          </div>
          <div className="hidden md:flex items-center gap-1 ml-4 bg-purple-50/60 rounded-xl p-1 border border-purple-100">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === t.id ? "bg-white text-purple-700 shadow-sm border border-purple-100" : "text-slate-400 hover:text-purple-600"}`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/")} className="text-xs font-bold text-slate-400 hover:text-purple-600 flex items-center gap-1.5 transition-colors">
            <ChevronLeft className="w-4 h-4" /> User Portal
          </button>
          <button
            onClick={() => { logout(); navigate("/admin-login"); }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-red-50 hover:text-red-500 text-slate-500 rounded-xl text-xs font-bold transition-all border border-purple-100 hover:border-red-200"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
        {/* Page Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500 mb-1">System Oversight</p>
            <h1 className="text-4xl font-black tracking-tighter text-slate-800" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Command <span className="text-purple-600 italic">Center</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-600">API Online</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[
            { label: "Users", val: stats?.total_users, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
            { label: "All Videos", val: stats?.total_videos, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
            { label: "Completed", val: stats?.completed, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
            { label: "Queued", val: stats?.queued, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
            { label: "Failed", val: stats?.failed, color: "text-red-500", bg: "bg-red-50", border: "border-red-100" },
            { label: "Custom Layouts", val: stats?.remotion, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100" },
            { label: "AI Narrator", val: stats?.direct, color: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-100" },
          ].map((s, i) => (
            <Card key={i} className={`${s.bg} border ${s.border} rounded-2xl overflow-hidden shadow-none`}>
              <CardContent className="p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">{s.label}</p>
                <p className={`text-2xl font-black tracking-tighter ${s.color}`}>
                  {statsQuery.isLoading ? <Skeleton className="h-7 w-12 bg-white/70" /> : (s.val ?? "—")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Mobile Tab Switcher */}
        <div className="md:hidden flex items-center gap-1 bg-purple-50/60 rounded-xl p-1 border border-purple-100">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${tab === t.id ? "bg-white text-purple-700 shadow-sm" : "text-slate-400"}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>


        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border border-purple-100 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="border-b border-purple-50 bg-purple-50/40 px-6 py-5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-700">
                  <Clock className="w-4 h-4 text-amber-500" /> Recent Videos (Global)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {statsQuery.isLoading ? [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full bg-purple-50 rounded-xl" />) :
                  <p className="text-xs text-slate-400 p-4 text-center">Switch to <b className="text-purple-600">All Videos</b> tab for full log.</p>
                }
              </CardContent>
            </Card>
            <Card className="bg-white border border-purple-100 rounded-3xl overflow-hidden shadow-sm">
              <CardHeader className="border-b border-purple-50 bg-purple-50/40 px-6 py-5">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-700">
                  <BarChart3 className="w-4 h-4 text-purple-500" /> Generation Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: "Custom Layout Videos", val: stats?.remotion ?? 0, total: stats?.total_videos ?? 1, color: "bg-purple-500" },
                  { label: "Narrator Videos", val: stats?.direct ?? 0, total: stats?.total_videos ?? 1, color: "bg-indigo-400" },
                  { label: "API Templates", val: stats?.template ?? 0, total: stats?.total_videos ?? 1, color: "bg-violet-400" },
                ].map((b) => (
                  <div key={b.label}>
                    <div className="flex justify-between text-xs font-bold mb-1.5">
                      <span className="text-slate-500">{b.label}</span>
                      <span className="text-slate-700">{b.val}</span>
                    </div>
                    <div className="h-2 bg-purple-50 rounded-full overflow-hidden border border-purple-100">
                      <div className={`h-full ${b.color} rounded-full transition-all`} style={{ width: `${Math.min(100, (b.val / b.total) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <Card className="bg-white border border-purple-100 rounded-3xl overflow-hidden shadow-sm">
            <CardHeader className="border-b border-purple-50 bg-purple-50/40 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-700">
                    <User className="w-5 h-5 text-purple-500" /> User Management
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5 text-slate-400">Click any row to expand and view that user's videos.</CardDescription>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {Array.isArray(usersQuery.data) ? usersQuery.data.length : 0} users
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-purple-50/30">
                  <TableRow className="border-purple-100 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] px-6">Email / Name</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] text-center">Videos</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px]">Role</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersQuery.isLoading
                    ? [1, 2, 3, 4].map(i => (
                      <TableRow key={i} className="border-purple-100">
                        <TableCell colSpan={4}><Skeleton className="h-12 w-full bg-purple-50 rounded-xl" /></TableCell>
                      </TableRow>
                    ))
                    : Array.isArray(usersQuery.data) && usersQuery.data.map((u: any) => (
                      <UserRow key={u.id} u={u} token={token} onDeleteVideo={(id) => deleteVideoMut.mutate(id)} />
                    ))
                  }
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* ── VIDEOS TAB ── */}
        {tab === "videos" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by title or user ID..."
                  className="pl-9 bg-white border-purple-100 text-slate-700 rounded-xl h-10 focus:border-purple-300 focus:ring-purple-200"
                  value={videoSearch}
                  onChange={(e) => setVideoSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                {["", "completed", "queued", "failed"].map((s) => (
                  <button key={s} onClick={() => setVideoStatus(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${videoStatus === s ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-400 border-purple-100 hover:border-purple-300 hover:text-purple-600"}`}>
                    {s || "All"}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Grid */}
            {videosQuery.isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-24 w-full bg-purple-50 rounded-2xl" />)}
              </div>
            ) : !Array.isArray(videosQuery.data) || videosQuery.data.length === 0 ? (
              <Card className="bg-white border border-purple-100 rounded-2xl p-12 text-center shadow-none">
                <Video className="w-10 h-10 text-purple-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">No videos found.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videosQuery.data.map((v: any) => (
                  <div key={v._id} className="group bg-white border border-purple-100 rounded-2xl p-4 hover:border-purple-300 hover:shadow-md transition-all flex gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${statusColor(v.status)}`}>
                      <StatusIcon s={v.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{v.title || "Untitled Video"}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        {v.request_mode} &nbsp;·&nbsp; uid: {v.user_id?.slice(-6)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {v.video_url && (
                          <button onClick={() => setPlayingVideo(v)}
                            className="flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-[10px] font-bold transition-colors">
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        )}
                        {v.video_url && (
                          <a href={v.video_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-500 hover:text-purple-600 rounded-lg text-[10px] font-bold transition-colors">
                            <ExternalLink className="w-3 h-3" /> Open
                          </a>
                        )}
                        <button onClick={() => deleteVideoMut.mutate(v._id)}
                          className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg text-[10px] font-bold transition-colors ml-auto">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CAMPAIGNS TAB ── */}
        {tab === "campaigns" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-white p-4 rounded-2xl border border-purple-100 shadow-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delivered</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{campaignStats.DELIVERED || 0}</p>
              </Card>
              <Card className="bg-white p-4 rounded-2xl border border-purple-100 shadow-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Seen / Read</p>
                <p className="text-2xl font-black text-blue-600 mt-1">{campaignStats.READ || 0}</p>
              </Card>
              <Card className="bg-white p-4 rounded-2xl border border-purple-100 shadow-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Failed / Rejected</p>
                <p className="text-2xl font-black text-red-500 mt-1">{(campaignStats.FAILED || 0) + (campaignStats.REJECTED || 0)}</p>
              </Card>
              <Card className="bg-white p-4 rounded-2xl border border-purple-100 shadow-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending</p>
                <p className="text-2xl font-black text-amber-500 mt-1">{campaignStats.PENDING || 0}</p>
              </Card>
            </div>

            <Card className="bg-white border border-purple-100 rounded-3xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-purple-50/30">
                  <TableRow className="border-purple-100">
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] px-6">Customer</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px]">Phone Number</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px]">Status</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[10px] pr-6 text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignsQuery.isLoading ? [1, 2, 3].map(i => (
                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                  )) : recentCampaigns.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-300 font-bold">No campaign logs yet.</TableCell></TableRow>
                  ) : recentCampaigns.map((log: any) => (
                    <TableRow key={log._id} className="border-purple-50">
                      <TableCell className="px-6 font-bold text-slate-700">{log.customer_name}</TableCell>
                      <TableCell className="text-slate-500 text-sm">{log.phone}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight ${
                          log.status === "DELIVERED" || log.status === "READ" ? "bg-emerald-50 text-emerald-600" :
                          log.status === "FAILED" || log.status === "REJECTED" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                        }`}>
                          {log.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-[10px] text-slate-400 pr-6">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}
      </main>

    </div>
  );
};

export default AdminDashboard;

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, HandCoins, LayoutTemplate, Loader2, PictureInPicture2, Smartphone, Sparkles, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HeaderBar } from "@/components/HeaderBar";
import { Button } from "@/components/ui/button";
import { fetchTemplates } from "@/lib/api";
import { REMOTION_TEMPLATE_OPTIONS, TEMPLATE_LIBRARY_QUICK_STARTS, type RemotionTemplateKey } from "@/lib/templates";

export default function TemplateLibrary() {
  const navigate = useNavigate();
  const templatesQuery = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });

  const getTemplateIcon = (key: string) => {
    switch (key) {
      case "account_notice":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-blue-500/10">
            <FileText className="h-6 w-6" />
          </div>
        );
      case "payment_guidance":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-400 border border-violet-500/10">
            <Video className="h-6 w-6" />
          </div>
        );
      case "payment_link_guidance":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/10">
            <Smartphone className="h-6 w-6" />
          </div>
        );
      case "overdue_template":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 text-rose-400 border border-rose-500/10">
            <AlertTriangle className="h-6 w-6" />
          </div>
        );
      case "loan_offer_interactive":
      case "scene_loan_offer":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-sky-500/20 text-green-400 border border-green-500/10">
            <HandCoins className="h-6 w-6" />
          </div>
        );
      case "loan_reminder":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 text-sky-400 border border-sky-500/10">
            <Video className="h-6 w-6" />
          </div>
        );
      case "collection_reminder":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 text-amber-400 border border-amber-500/10">
            <AlertTriangle className="h-6 w-6" />
          </div>
        );
      case "hybrid_avatar_pip":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 text-rose-400 border border-rose-500/10">
            <PictureInPicture2 className="h-6 w-6" />
          </div>
        );
      case "tvs_credit_emi":
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 text-indigo-400 border border-indigo-500/10">
            <Video className="h-6 w-6" />
          </div>
        );
      default:
        return (
          <div className="p-3 rounded-xl bg-gradient-to-br from-gray-500/20 to-slate-500/20 text-gray-400 border border-gray-500/10">
            <LayoutTemplate className="h-6 w-6" />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeaderBar primaryLabel="Create Video" />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Header Hero Section */}
          <section className="surface-card p-8 space-y-4 border border-border/40 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary">Workspace</p>
            <div className="space-y-2">
              <h1 className="font-display text-4xl text-foreground font-bold tracking-tight">Template Library</h1>
              <p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
                Select from our library of custom and avatar templates to launch the video generator.
              </p>
            </div>
          </section>

          {/* Section 1: Custom Templates */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-primary" />
              <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                Custom Video Templates
                <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                  Ready to Use
                </span>
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {TEMPLATE_LIBRARY_QUICK_STARTS.map((starter) => (
                <article
                  key={starter.mode}
                  className="surface-card p-6 flex flex-col gap-5 border border-border/45 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group"
                >
                  <div className="flex items-start gap-4">
                    {getTemplateIcon(starter.iconKey)}
                    <div className="space-y-1">
                      <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                        {starter.name}
                      </h3>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed min-h-[3rem]">
                    {starter.description}
                  </p>

                  <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between gap-3">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/create?mode=${starter.mode}&fresh=1`)}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-medium shadow-sm"
                    >
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                      Create Video
                    </Button>
                  </div>
                </article>
              ))}
              {REMOTION_TEMPLATE_OPTIONS.map((template) => (
                <article
                  key={template.key}
                  className="surface-card p-6 flex flex-col gap-5 border border-border/45 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group"
                >
                  <div className="flex items-start gap-4">
                    {getTemplateIcon(template.key)}
                    <div className="space-y-1">
                      <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed min-h-[3rem]">
                    {template.description}
                  </p>

                  <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between gap-3">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/create?mode=remotion&fresh=1&template=${template.key}`)}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-medium shadow-sm"
                    >
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                      Create Video
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Section 2: Avatar Templates */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1 rounded-full bg-violet-500" />
              <h2 className="text-xl font-bold font-display text-foreground">
                Avatar Templates
              </h2>
            </div>

            {templatesQuery.isLoading ? (
              <div className="surface-card p-10 text-center space-y-4 border border-border/40">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading templates from API...</p>
              </div>
            ) : null}

            {templatesQuery.error instanceof Error ? (
              <div className="surface-card p-10 text-center space-y-4 border border-border/40">
                <h3 className="font-display text-lg font-semibold text-foreground">Failed to load templates</h3>
                <p className="text-sm text-muted-foreground">Something went wrong while fetching templates. Please check your API connection.</p>
                <Button
                  variant="outline"
                  onClick={() => templatesQuery.refetch()}
                  className="mt-2 border-border"
                >
                  Retry API Fetch
                </Button>
              </div>
            ) : null}

            {!templatesQuery.isLoading && !templatesQuery.error && (templatesQuery.data?.length ?? 0) === 0 ? (
              <div className="surface-card p-8 text-center border border-border/30 bg-muted/10">
                <p className="text-sm text-muted-foreground">No templates found. Make sure templates are created in your dashboard.</p>
              </div>
            ) : null}

            {!templatesQuery.isLoading && !templatesQuery.error && (templatesQuery.data?.length ?? 0) > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {templatesQuery.data!.map((template) => (
                  <article
                    key={template.id}
                    className="surface-card p-6 flex flex-col gap-5 border border-border/40 hover:border-violet-500/30 transition-all duration-300"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-display text-lg font-semibold text-foreground">{template.name}</h3>
                        {template.status ? (
                          <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-violet-400 border border-violet-500/20">
                            {template.status}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground min-h-[3rem]">
                        {template.description ?? "No description was returned for this template."}
                      </p>
                    </div>

                    <div className="mt-auto pt-4 border-t border-border/40 flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {template.updatedAt ? `Updated ${template.updatedAt}` : "Update date unavailable"}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate("/create?mode=avatar&fresh=1")}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-6"
                      >
                        Open Creator
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

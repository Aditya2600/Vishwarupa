import { useQuery } from "@tanstack/react-query";
import { Copy, LayoutTemplate, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { HeaderBar } from "@/components/HeaderBar";
import { Button } from "@/components/ui/button";
import { fetchTemplates } from "@/lib/api";

export default function TemplateLibrary() {
  const navigate = useNavigate();
  const templatesQuery = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });

  const copyTemplateId = async (templateId: string) => {
    try {
      await navigator.clipboard.writeText(templateId);
      toast.success("Template ID copied.");
    } catch {
      toast.error("Unable to copy the template ID.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeaderBar primaryLabel="Create Video" />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <section className="surface-card p-8 space-y-3">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-primary">Workspace</p>
            <div className="space-y-2">
              <h1 className="font-display text-4xl text-foreground">Template Library</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Browse the templates available from the backend and copy a template ID when you need it.
              </p>
            </div>
          </section>

          {templatesQuery.isLoading ? (
            <section className="surface-card p-10 text-center space-y-4">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading templates from the backend...</p>
            </section>
          ) : null}

          {templatesQuery.error instanceof Error ? (
            <section className="surface-card p-10 text-center space-y-4">
              <h2 className="font-display text-xl text-foreground">Failed to load templates</h2>
              <p className="text-sm text-muted-foreground">Something went wrong while fetching templates. Please try again.</p>
              <button
                onClick={() => templatesQuery.refetch()}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-secondary text-foreground hover:bg-primary hover:text-white transition-colors"
              >
                Retry
              </button>
            </section>
          ) : null}

          {!templatesQuery.isLoading && !templatesQuery.error && (templatesQuery.data?.length ?? 0) === 0 ? (
            <section className="surface-card p-10 text-center">
              <h2 className="font-display text-2xl text-foreground">Coming Soon</h2>
            </section>
          ) : null}

          {!templatesQuery.isLoading && !templatesQuery.error && (templatesQuery.data?.length ?? 0) > 0 ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templatesQuery.data!.map((template) => (
                <article key={template.id} className="surface-card p-6 flex flex-col gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-display text-2xl text-foreground">{template.name}</h2>
                      {template.status ? (
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                          {template.status}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground break-all">{template.id}</p>
                    <p className="text-sm text-muted-foreground min-h-[3rem]">
                      {template.description ?? "No description was returned for this template."}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      {template.updatedAt ? `Updated ${template.updatedAt}` : "Update date unavailable"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyTemplateId(template.id)}
                        className="hover:text-white hover:bg-primary hover:border-primary"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy ID
                      </Button>
                      <Button size="sm" onClick={() => navigate("/create?mode=remotion&fresh=1")} className="hover:text-white">
                        Open Text to Video
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

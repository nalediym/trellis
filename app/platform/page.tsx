import { listManifestTree } from "@/lib/manifests";
import { ManifestViewer } from "@/components/manifest-viewer";

export const dynamic = "force-dynamic";

export default function PlatformPage() {
  const tree = listManifestTree();

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:py-12 space-y-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.14em] muted">
          platform/ control plane
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          The whole platform, as files
        </h1>
        <p className="max-w-3xl muted text-[14px] leading-relaxed">
          Every skill, persona, policy binding, DLP rule, and connector is a
          YAML manifest. The UI you&apos;re clicking through is a rendering of
          this tree — nothing is stored in a database. A change to any file is
          a pull request.
        </p>
      </header>

      <ManifestViewer tree={tree} />
    </main>
  );
}

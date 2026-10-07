import AppsDirectory, { type CatalogApp } from "@/components/AppsDirectory";
import catalog from "@/data/apps.json";

export const metadata = { title: "Apps · Codex-open-dot" };

export default function Page() {
  return <AppsDirectory apps={catalog.apps as CatalogApp[]} />;
}

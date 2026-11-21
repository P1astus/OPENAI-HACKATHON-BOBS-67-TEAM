import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { searchCompaniesOnWeb, type WebSearchResponse } from "@/lib/api-client";
import type { Property, Trade } from "@/types";
import { tradeLabels } from "./trades";

export function WebResults({ trade, property }: { trade: Trade; property: Property }) {
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<WebSearchResponse | null>(null);
  const message = response?.note === "Web search unavailable"
    ? "Online search is unavailable right now."
    : response?.results.length === 0 ? "Nothing found online. reltix will find someone." : null;
  const linkClass = "inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 wrap-anywhere";

  async function search() {
    setPending(true);
    try {
      setResponse(await searchCompaniesOnWeb(trade, property.postcode, property.city));
    } catch {
      setResponse({ results: [], note: "Web search unavailable" });
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Online company suggestions" className="space-y-2">
      <Button type="button" variant="link" className="min-h-11 whitespace-normal px-0 text-left"
        disabled={pending} onClick={() => void search()}>
        <Search aria-hidden="true" className="size-4" />
        Search online for a local {tradeLabels[trade].toLowerCase()} company
      </Button>
      <div role="status" className="text-sm text-muted-foreground">
        {pending ? "Searching online…" : message}
      </div>
      {!pending && !!response?.results.length && (
        <ul className="space-y-2">
          {response.results.map((result, index) => (
            <li key={`${result.source_url}:${index}`} className="space-y-1 rounded-[14px] border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">Found online · not checked</p>
              <p className="font-semibold wrap-anywhere">{result.name}</p>
              {result.address && <p className="text-sm text-muted-foreground wrap-anywhere">{result.address}</p>}
              <div className="flex flex-wrap gap-x-4">
                {result.phone && <a className={linkClass} href={`tel:${result.phone.replace(/[^+\d]/g, "")}`}>{result.phone}</a>}
                {result.website && <a className={linkClass} href={result.website} target="_blank" rel="noopener">Website</a>}
                <a className={linkClass} href={result.source_url} target="_blank" rel="noopener">Source</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

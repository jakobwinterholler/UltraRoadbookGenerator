import { useState } from "react";
import type { CompanionBundle } from "../types";
import { isCompanionBundle } from "../types";
import { saveCompanionBundle } from "../db";

interface ImportScreenProps {
  onImported: (bundle: CompanionBundle) => void;
}

export default function ImportScreen({ onImported }: ImportScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isCompanionBundle(parsed)) {
        throw new Error("This file is not a valid Companion race bundle.");
      }
      await saveCompanionBundle(parsed);
      onImported(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
        Race Companion
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-white">Import your race</h1>
      <p className="mt-2 max-w-sm text-sm text-white/55">
        Export a race from Ultra Roadbook, then import it here for offline use during the event.
      </p>

      <label className="mt-8 inline-flex cursor-pointer rounded-full bg-white px-5 py-3 text-sm font-semibold text-black">
        {loading ? "Importing…" : "Choose race file"}
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          disabled={loading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
          }}
        />
      </label>

      {error ? <p className="mt-4 max-w-sm text-sm text-red-300">{error}</p> : null}

      <p className="mt-10 max-w-xs text-xs text-white/35">
        Works offline after import. Map tiles cache as you pan along the route while online.
      </p>
    </div>
  );
}

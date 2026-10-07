"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const BUCKET = "wh-photos";

export function photoUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Снимки към документ. На телефон бутонът отваря директно камерата.
 * Пътищата се пазят в колоната photo_paths на документа.
 */
export default function PhotoUpload({
  folder,
  paths,
  onChange,
  disabled,
}: {
  folder: string; // напр. "deliveries/<id>"
  paths: string[];
  onChange: (paths: string[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    setErr("");
    const added: string[] = [];
    for (const f of files) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${folder}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) {
        setErr(error.message);
        break;
      }
      added.push(path);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (added.length) onChange([...paths, ...added]);
  }

  async function remove(p: string) {
    setBusy(true);
    await supabase.storage.from(BUCKET).remove([p]);
    setBusy(false);
    onChange(paths.filter((x) => x !== p));
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Качване…" : "📷 Добави снимка"}
        </button>
        {paths.length > 0 && (
          <span className="text-xs text-slate-400 tabular-nums">{paths.length} бр.</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>

      {err && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      )}

      {paths.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {paths.map((p) => (
            <div key={p} className="relative">
              <a href={photoUrl(p)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(p)}
                  alt="снимка"
                  className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                />
              </a>
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => remove(p)}
                className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-white border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300 text-sm leading-none shadow-sm"
                title="Премахни"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

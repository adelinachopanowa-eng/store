"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Табло", icon: "📊" },
  { href: "/kantar", label: "Кантарни бележки", icon: "⚖️" },
  { href: "/dostavki", label: "Доставки", icon: "📥" },
  { href: "/prodazhbi", label: "Продажби", icon: "📤" },
  { href: "/presortirane", label: "Пресортиране", icon: "🔀" },
  { href: "/nomenklatura", label: "Номенклатури", icon: "📚" },
  { href: "/pechalba", label: "Печалба", icon: "💰" },
  { href: "/istoria", label: "История", icon: "🕓" },
  { href: "/spravki", label: "Справки", icon: "📈" },
  { href: "/nastroyki", label: "Настройки", icon: "⚙️" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ─── Десктоп: странична лента ─── */}
      <aside className="hidden md:flex w-56 shrink-0 bg-brand-700 text-brand-50 min-h-screen flex-col">
        <div className="px-5 py-5 border-b border-brand-600">
          <div className="text-lg font-bold text-white">
            Прогрестрейд<span className="text-accent-400"> ·</span>
          </div>
          <div className="text-xs text-brand-200">Складова програма</div>
        </div>
        <nav className="flex-1 py-3">
          {links.map((l) => {
            const active = isActive(path, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition border-l-4 ${
                  active
                    ? "bg-brand-600 text-white font-medium border-accent-400"
                    : "text-brand-100 hover:bg-brand-600/60 border-transparent"
                }`}
              >
                <span>{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-3 text-xs text-brand-200 border-t border-brand-600">
          v1.0 · средно претеглена цена
        </div>
      </aside>

      {/* ─── Мобилен: горна лента ─── */}
      <div className="md:hidden sticky top-0 z-40 bg-brand-700 text-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="font-bold">
            Прогрестрейд<span className="text-accent-400"> ·</span>
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Меню"
            className="rounded-lg p-2 hover:bg-brand-600"
          >
            <span className="block text-xl leading-none">{open ? "✕" : "☰"}</span>
          </button>
        </div>
        {open && (
          <nav className="border-t border-brand-600 pb-2">
            {links.map((l) => {
              const active = isActive(path, l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm border-l-4 ${
                    active
                      ? "bg-brand-600 text-white font-medium border-accent-400"
                      : "text-brand-100 border-transparent"
                  }`}
                >
                  <span>{l.icon}</span>
                  {l.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </>
  );
}

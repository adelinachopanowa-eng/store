"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Табло", icon: "📊" },
  { href: "/kantar", label: "Кантарни бележки", icon: "⚖️" },
  { href: "/dostavki", label: "Доставки", icon: "📥" },
  { href: "/prodazhbi", label: "Продажби", icon: "📤" },
  { href: "/presortirane", label: "Пресортиране", icon: "🔀" },
  { href: "/nomenklatura", label: "Номенклатури", icon: "📚" },
  { href: "/istoria", label: "История", icon: "🕓" },
  { href: "/spravki", label: "Справки", icon: "📈" },
  { href: "/nastroyki", label: "Настройки", icon: "⚙️" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-brand-700 text-brand-50 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-brand-600">
        <div className="text-lg font-bold text-white">
          Прогрестрейд<span className="text-accent-400"> ·</span>
        </div>
        <div className="text-xs text-brand-200">Складова програма</div>
      </div>
      <nav className="flex-1 py-3">
        {links.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
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
  );
}

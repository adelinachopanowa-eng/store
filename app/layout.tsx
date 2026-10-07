import "./globals.css";
import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Прогрестрейд · Складова програма",
  description: "Складова програма за скрап със средно претеглена цена",
};

// Без maximumScale/userScalable — зуумът при фокус е решен с 16px полета,
// а ръчното увеличаване остава достъпно.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>
        <div className="md:flex">
          <Nav />
          <main className="flex-1 min-w-0 min-h-screen p-4 md:p-6 max-w-[1400px] w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}

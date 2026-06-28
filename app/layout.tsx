import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Прогрестрейд · Складова програма",
  description: "Складова програма за скрап със средно претеглена цена",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>
        <div className="md:flex">
          <Nav />
          <main className="flex-1 min-h-screen p-4 md:p-6 max-w-[1400px] w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}

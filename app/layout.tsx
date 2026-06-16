import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Progresstrade · Складова програма",
  description: "Складова програма за скрап със средно претеглена цена по групи",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>
        <div className="flex">
          <Nav />
          <main className="flex-1 min-h-screen p-6 max-w-[1400px]">{children}</main>
        </div>
      </body>
    </html>
  );
}

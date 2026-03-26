import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: {
    default: "qiymetleri.com — Azərbaycanda ən ucuz texnikanı tap",
    template: "%s | qiymetleri.com",
  },
  description:
    "Azərbaycanda elektron məhsulların qiymət müqayisəsi. Kontakt Home, Baku Electronics, Irshad Electronics, iSpace — bütün mağazaların qiymətlərini müqayisə edin.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="az">
      <body className={`${inter.className} bg-white text-gray-900 antialiased`}>
        <header className="border-b border-gray-200">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <a href="/" className="text-xl font-bold text-blue-600">
              qiymetleri.com
            </a>
            <div className="hidden gap-6 md:flex">
              <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
                Ana səhifə
              </a>
              <a
                href="/search?category=smartphones"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Smartfonlar
              </a>
              <a
                href="/search?category=laptops"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Noutbuklar
              </a>
              <a
                href="/search?category=headphones"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Qulaqlıqlar
              </a>
            </div>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="mt-16 border-t border-gray-200 bg-gray-50 py-8">
          <div className="mx-auto max-w-7xl px-4 text-center text-sm text-gray-500">
            © {new Date().getFullYear()} qiymetleri.com — Azərbaycanda ən ucuz
            texnikanı tap
          </div>
        </footer>
      </body>
    </html>
  );
}

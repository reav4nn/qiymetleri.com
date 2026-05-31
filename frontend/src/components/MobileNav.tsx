"use client";

import { useState, useEffect } from "react";

interface MobileNavProps {
  locale: string;
  links: { href: string; label: string }[];
}

export function MobileNav({ locale, links }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition hover:text-[var(--color-text-primary)]"
        aria-label="Toggle menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed left-0 right-0 top-0 z-50 transform border-b border-[var(--color-border)] bg-[var(--color-bg-page)] transition-transform duration-200 ease-out ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <a
            href={`/${locale}`}
            className="flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <img src="/qiymetleriTransparentDark.png" alt="" className="logo-for-light h-7 w-7" />
            <img src="/qiymetleriTransparentWhite.png" alt="" className="logo-for-dark h-7 w-7" />
            <span className="text-base font-semibold text-[var(--color-text-primary)]">
              qiymetleri.com
            </span>
          </a>
          <button
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary)]"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="px-4 py-2">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex h-11 items-center rounded-lg px-3 text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

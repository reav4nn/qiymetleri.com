"use client";

import { useState, useEffect } from "react";

interface MobileNavProps {
  locale: string;
  links: { href: string; label: string }[];
}

export function MobileNav({ locale, links }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, []);

  // Prevent body scroll when menu is open
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
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] transition hover:bg-[var(--color-bg-surface-hover)]"
        aria-label="Toggle menu"
      >
        <svg
          className={`h-5 w-5 text-[var(--color-text-secondary)] transition-transform duration-300 ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          {open ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-down menu */}
      <div
        className={`fixed left-0 right-0 top-0 z-50 transform bg-[var(--color-bg-surface)] shadow-xl transition-transform duration-300 ease-in-out ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
          <a
            href={`/${locale}`}
            className="flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <img
              src="/qiymetleriTransparentDark.png"
              alt=""
              className="logo-for-light h-7 w-7"
            />
            <img
              src="/qiymetleriTransparentWhite.png"
              alt=""
              className="logo-for-dark h-7 w-7"
            />
            <span className="text-xl font-bold text-[var(--color-accent)]">
              qiymetleri.com
            </span>
          </a>
          <button
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="px-4 py-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex h-12 items-center rounded-lg px-3 text-base font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-surface-hover)] hover:text-[var(--color-text-primary)] active:bg-[var(--color-accent-subtle)]"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

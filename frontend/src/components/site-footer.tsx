import { Link } from "@/i18n/navigation";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="bg-[#fafafa] pt-16 pb-8 text-[#71717a] border-t border-border">
      <div className="mx-auto max-w-[1280px] px-6">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-8">
          {/* Brand Column */}
          <div className="flex flex-col gap-6">
            <Link href="#" className="flex items-center gap-2 text-2xl font-extrabold tracking-[-0.02em] text-[#09090b]">
              <Image src="/logo.svg" alt="qiymetleri.com" width={28} height={28} />
              <div className="flex items-baseline gap-0.5">
                <span>qiymetleri</span>
                <span className="text-accent">.com</span>
              </div>
            </Link>
            <p className="font-serif italic text-[#a1a1aa]">
              Ən sərfəli qiymətlər.
            </p>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[13px] font-bold tracking-[0.08em] text-[#09090b] uppercase">Mağaza</h3>
            <ul className="flex flex-col gap-3 text-[14px]">
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Smartfonlar</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Noutbuklar</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Televizorlar</Link></li>
            </ul>
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[13px] font-bold tracking-[0.08em] text-[#09090b] uppercase">Məlumat</h3>
            <ul className="flex flex-col gap-3 text-[14px]">
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Haqqımızda</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Tərəfdaşlıq</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Sosial media</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Əlaqə</Link></li>
            </ul>
          </div>

          {/* Column 4 */}
          <div className="flex flex-col gap-4">
            <h3 className="text-[13px] font-bold tracking-[0.08em] text-[#09090b] uppercase">Hüquqi</h3>
            <ul className="flex flex-col gap-3 text-[14px]">
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">İstifadə şərtləri</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Gizlilik və təhlükəsizlik</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Fərdi məlumatların qorunması</Link></li>
              <li><Link href="#" className="transition-colors hover:text-[#09090b]">Razılıq mətni</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 border-t border-[#e4e4e7] pt-8 text-[13px] text-[#a1a1aa]">
          <p>© 2026 qiymetleri.com, Bakı. Bütün hüquqlar qorunur.</p>
        </div>
      </div>
    </footer>
  );
}

import { AdminShell } from "@/components/admin-shell";

export default async function PanelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <AdminShell locale={locale}>{children}</AdminShell>;
}

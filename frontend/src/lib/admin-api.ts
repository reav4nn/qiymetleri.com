export async function adminFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/v1/admin${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? "Sorğu yerinə yetirilmədi");
  }
  return response.json() as Promise<T>;
}

export function formatDate(value?: string | null) {
  return value
    ? new Intl.DateTimeFormat("az-AZ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}

export function statusLabel(status?: string | null) {
  return (
    (
      {
        queued: "Növbədə",
        running: "İşləyir",
        success: "Uğurlu",
        partial: "Qismən",
        failed: "Uğursuz",
        conflict: "Aktivdir",
      } as Record<string, string>
    )[status ?? ""] ?? "Məlum deyil"
  );
}

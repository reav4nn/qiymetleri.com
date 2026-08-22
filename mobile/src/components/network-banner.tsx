import { useNetInfo } from "@react-native-community/netinfo";
import { Text } from "react-native";

import type { DataSource } from "@/api/types";
import { useLocale } from "@/i18n/locale-context";

const copy = {
  az: {
    offline: "İnternet bağlantısı yoxdur. Yadda saxlanmış kataloq göstərilir.",
    snapshot: "Canlı qiymət xidməti əlçatan deyil. {date} tarixində saxlanmış kataloq göstərilir.",
    mixed: "Canlı məlumatın bir hissəsi əlçatan deyil. Çatışmayan hissələr {date} tarixli kataloqla tamamlanır.",
  },
  ru: {
    offline: "Нет подключения к интернету. Показан сохранённый каталог.",
    snapshot: "Сервис актуальных цен недоступен. Показан каталог, сохранённый {date}.",
    mixed: "Часть актуальных данных недоступна. Недостающие данные дополнены каталогом от {date}.",
  },
} as const;

export function NetworkBanner({
  dataSource,
  snapshotGeneratedAt,
}: {
  dataSource?: DataSource;
  snapshotGeneratedAt?: string;
}) {
  const network = useNetInfo();
  const { formatDate, locale } = useLocale();
  const isOffline = network.isConnected === false;
  if (!isOffline && (!dataSource || dataSource === "live")) return null;

  const formattedSnapshotDate = snapshotGeneratedAt
    ? formatDate(new Date(snapshotGeneratedAt), { day: "2-digit", month: "short", year: "numeric" })
    : "—";
  const snapshotDate = locale === "ru" ? formattedSnapshotDate.replace(/\.$/u, "") : formattedSnapshotDate;
  const message = isOffline
    ? copy[locale].offline
    : copy[locale][dataSource === "mixed" ? "mixed" : "snapshot"].replace("{date}", snapshotDate);

  return (
    <Text
      selectable
      role="alert"
      style={{
        backgroundColor: "#fff7ed",
        borderCurve: "continuous",
        borderRadius: 12,
        color: "#9a3412",
        fontFamily: "Manrope",
        fontSize: 12,
        lineHeight: 18,
        padding: 12,
      }}
    >
      {message}
    </Text>
  );
}

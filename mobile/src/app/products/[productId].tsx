import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";

import { useLocale } from "@/i18n/locale-context";
import { navigationCopy } from "@/i18n/navigation-copy";
import { ProductDetailScreen } from "@/screens/product-detail";

export default function ProductDetailRoute() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { locale } = useLocale();

  return (
    <>
      <Stack.Title>{navigationCopy[locale].product}</Stack.Title>
      <ProductDetailScreen productId={productId} />
    </>
  );
}

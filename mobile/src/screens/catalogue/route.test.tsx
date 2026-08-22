import { render, screen, userEvent } from "@testing-library/react-native";

import CatalogueRoute from "@/app/(tabs)/(catalogue)/products";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@/screens/catalogue", () => {
  const { Pressable, Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    CatalogueScreen: ({ onUpdateQuery }: { onUpdateQuery: (updates: { q: string }) => void }) => (
      <Pressable role="button" aria-label="Sorğunu yenilə" onPress={() => onUpdateQuery({ q: "iPhone" })}>
        <Text>Sorğunu yenilə</Text>
      </Pressable>
    ),
  };
});

jest.useFakeTimers();

test("replaces catalogue query params without growing the navigation stack", async () => {
  const user = userEvent.setup();
  await render(<CatalogueRoute />);

  await user.press(screen.getByRole("button", { name: "Sorğunu yenilə" }));

  expect(mockReplace).toHaveBeenCalledWith({
    pathname: "/products",
    params: { page: "1", q: "iPhone", sort_by: "name" },
  });
});

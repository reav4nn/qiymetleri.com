import { colors } from "@/theme/colors";

test("uses the public web application's visual identity", () => {
  expect(colors).toMatchObject({
    accent: "#e11d2a",
    accentSoft: "#fef2f2",
    background: "#f4f4f5",
    border: "#ececed",
    text: "#18181b",
  });
});

import { safeExternalUrl } from "@/utils/external-url";

test.each([
  ["https://example.com/item", "https://example.com/item"],
  ["http://example.com", "http://example.com/"],
  ["mailto:info@qiymetleri.com", "mailto:info@qiymetleri.com"],
  ["javascript:alert(1)", null],
  ["not a url", null],
  [null, null],
])("safeExternalUrl(%s)", (input: string | null, expected: string | null) => {
  expect(safeExternalUrl(input)).toBe(expected);
});

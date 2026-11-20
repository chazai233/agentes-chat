import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasUriPart } from "../src/lib/upload-fetch";

const form = (parts: object[]) => ({ getParts: () => parts }) as unknown as FormData;

test("a FormData with a file by uri goes through React Native's networking; others stay on fetch", () => {
  expect(
    hasUriPart(
      form([
        { string: "x", fieldName: "title" },
        { uri: "file:///a.pdf", name: "报告.pdf" },
      ]),
    ),
  ).toBe(true);
  expect(hasUriPart(form([{ string: "x", fieldName: "title" }]))).toBe(false);
  // Expo's own FormData (no getParts) never matches.
  expect(hasUriPart(new FormData())).toBe(false);
});

test("the phone's API client uses it", () => {
  const api = readFileSync(join(import.meta.dir, "../src/lib/api.ts"), "utf8");
  expect(api).toContain("fetch: uploadAwareFetch");
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_TESTS } from "./proof";

describe("home page facts", () => {
  it("counts the contract's tests correctly", () => {
    const src = readFileSync(join(__dirname, "../../../../contracts/habeas/src/test.rs"), "utf8");
    expect(src.match(/#\[test\]/g)?.length).toBe(CONTRACT_TESTS);
  });
});

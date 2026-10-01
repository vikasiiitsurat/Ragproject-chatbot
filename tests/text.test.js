import { describe, expect, it } from "vitest";
import { chunkText, preview, safeFileName } from "../src/lib/text.js";

describe("text utilities", () => {
  it("creates overlapping readable chunks without losing the tail", () => {
    const text = "Sentence one. ".repeat(250);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)).toContain("Sentence one");
  });
  it("creates a safe filename and short preview", () => {
    expect(safeFileName("my resume (final).pdf")).toBe("my_resume__final_.pdf");
    expect(preview("a".repeat(300))).toHaveLength(283);
  });
});

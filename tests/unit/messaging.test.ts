import { describe, expect, it } from "vitest";
import {
  buildThreadItems,
  dayLabel,
  formatBytes,
  linkify,
  mergeMessages,
  receiptLabel,
  seenBy,
  summarizeReactions,
  typingLabel,
} from "../../src/components/messaging/thread-utils";

describe("linkify", () => {
  it("links http(s) and www URLs, leaving other text alone", () => {
    const segs = linkify("See https://youandme.app/x and www.example.com.");
    expect(segs).toEqual([
      { type: "text", value: "See " },
      { type: "link", value: "https://youandme.app/x", href: "https://youandme.app/x" },
      { type: "text", value: " and " },
      { type: "link", value: "www.example.com", href: "https://www.example.com/" },
      { type: "text", value: "." },
    ]);
  });

  it("never links dangerous schemes", () => {
    for (const s of ["javascript:alert(1)", "data:text/html,hi", "vbscript:x", "file:///etc/passwd"]) {
      expect(linkify(s).every((x) => x.type === "text")).toBe(true);
    }
  });

  it("keeps balanced parentheses but drops trailing punctuation", () => {
    const [, link] = linkify("(https://en.wikipedia.org/wiki/Foo_(bar))");
    expect(link).toMatchObject({ type: "link", value: "https://en.wikipedia.org/wiki/Foo_(bar)" });
  });
});

const at = (iso: string) => new Date(iso).toISOString();
const msg = (id: string, senderId: string | null, createdAt: string, kind = "text") => ({ id, senderId, kind, createdAt: at(createdAt) });

describe("buildThreadItems", () => {
  it("adds day separators and groups consecutive messages from the same sender", () => {
    const items = buildThreadItems(
      [
        msg("1", "a", "2026-09-20T10:00:00"),
        msg("2", "a", "2026-09-20T10:01:00"),
        msg("3", "b", "2026-09-20T10:02:00"),
        msg("4", "b", "2026-09-20T10:30:00"),
        msg("5", null, "2026-09-21T09:00:00", "system"),
      ],
      "a",
      new Date("2026-09-21T12:00:00"),
    );
    const kinds = items.map((i) => (i.kind === "day" ? `day:${i.label}` : `${i.message.id}:${i.startsGroup ? "S" : ""}${i.endsGroup ? "E" : ""}${i.own ? "*" : ""}`));
    expect(kinds).toEqual(["day:Yesterday", "1:S*", "2:E*", "3:SE", "4:SE", "day:Today", "5:SE"]);
  });
});

describe("read receipts", () => {
  it("counts members who have read up to the message", () => {
    const reads = [
      { userId: "b", lastReadAt: at("2026-09-20T10:05:00") },
      { userId: "c", lastReadAt: at("2026-09-20T09:00:00") },
      { userId: "d", lastReadAt: null },
    ];
    expect(seenBy(at("2026-09-20T10:00:00"), reads)).toMatchObject({ seen: 1, total: 3, userIds: ["b"] });
    expect(receiptLabel(1, 3, true)).toBe("Seen by 1");
    expect(receiptLabel(3, 3, true)).toBe("Seen by everyone");
    expect(receiptLabel(1, 1, false)).toBe("Seen");
    expect(receiptLabel(0, 1, false)).toBe("Sent");
  });
});

describe("helpers", () => {
  it("summarises reactions in a stable order", () => {
    const r = summarizeReactions(
      [
        { emoji: "🔥", userId: "a" },
        { emoji: "👍", userId: "b" },
        { emoji: "🔥", userId: "me" },
      ],
      "me",
      ["👍", "❤️", "🔥"],
    );
    expect(r).toEqual([
      { emoji: "👍", count: 1, mine: false },
      { emoji: "🔥", count: 2, mine: true },
    ]);
  });

  it("merges polled messages by id in chronological order", () => {
    const a = { id: "a", createdAt: at("2026-01-01T00:00:01Z") };
    const b = { id: "b", createdAt: at("2026-01-01T00:00:02Z") };
    const c = { id: "c", createdAt: at("2026-01-01T00:00:03Z") };
    expect(mergeMessages([a, c], [b, c]).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("labels days, sizes and typing", () => {
    const now = new Date("2026-09-24T12:00:00");
    expect(dayLabel(new Date("2026-09-24T01:00:00"), now)).toBe("Today");
    expect(dayLabel(new Date("2025-01-02T01:00:00"), now)).toContain("2025");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(typingLabel(["Sarah"])).toBe("Sarah is typing");
    expect(typingLabel(["A", "B", "C"])).toBe("Several people are typing");
    expect(typingLabel([])).toBeNull();
  });
});

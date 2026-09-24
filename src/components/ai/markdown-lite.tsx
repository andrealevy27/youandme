import * as React from "react";
import { cn } from "../../lib/utils"; // relative so unit tests run without path aliases

/**
 * Tiny, safe renderer for assistant text: paragraphs, line breaks, "- " / "* " bullets,
 * "1. " numbered lists and **bold**. Everything becomes React text nodes — no HTML is
 * ever parsed or injected, so model output cannot smuggle markup or links.
 */

type Block = { type: "p"; lines: string[] } | { type: "ul" | "ol"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let current = null as Block | null;
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/^#{1,6}\s+/, ""); // headings degrade to plain lines
    if (!line.trim()) {
      if (current) blocks.push(current);
      current = null;
      continue;
    }
    const b = line.match(BULLET);
    const n = b ? null : line.match(NUMBERED);
    if (b || n) {
      const type = b ? "ul" : "ol";
      const item = (b ?? n)![1]!;
      if (current && current.type === type) {
        current.items.push(item);
      } else {
        if (current) blocks.push(current);
        current = { type, items: [item] };
      }
      continue;
    }
    // An indented line directly after a list item continues that item.
    if (current && current.type !== "p" && /^\s{2,}/.test(raw)) {
      current.items[current.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (!current || current.type !== "p") {
      if (current) blocks.push(current);
      current = { type: "p", lines: [] };
    }
    current.lines.push(line.trim());
  }
  if (current) blocks.push(current);
  return blocks;
}

/** **bold** → <strong>; stray asterisks are shown as-is. */
export function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*([^*]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={`b${i++}`} className="font-semibold text-foreground">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={cn("space-y-3 text-[15px] leading-relaxed", className)}>
      {blocks.map((b, i) => {
        if (b.type === "p") {
          return (
            <p key={i}>
              {b.lines.map((l, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <br />}
                  {renderInline(l)}
                </React.Fragment>
              ))}
            </p>
          );
        }
        const List = b.type === "ul" ? "ul" : "ol";
        return (
          <List key={i} className={cn("space-y-2 pl-5", b.type === "ul" ? "list-disc" : "list-decimal", "marker:text-subtle")}>
            {b.items.map((item, j) => (
              <li key={j} className="pl-1">
                {renderInline(item)}
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

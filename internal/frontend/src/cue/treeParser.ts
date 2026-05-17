// Cue Markdown parser — returns a CueChild[] tree.
//
// Recognizes:
//   - GitHub Alert callouts: > [!NOTE|TIP|IMPORTANT|WARNING|CAUTION] title + body
//   - Alert-extended void directives: > [!toc title="..." depth=3]
//   - Fenced block directives: ```name attrs ... ```
//   - Nested container directives: ````tabs ... \n ```tab ... ``` ... ````
//   - Inline directives: `text`{name attrs}

import { parseAttrs } from "./parser";

// ── AST types ────────────────────────────────────────────────────────────────

export type CueNode = {
  kind: "cue";
  name: string;
  attrs: Record<string, string>;
  children: CueChild[];
  inline: boolean;
  selfClosing: boolean;
};

export type TextNode = { kind: "text"; content: string };
/** A paragraph that contains a mix of text and inline CueNodes. */
export type InlineParagraph = { kind: "inline-para"; children: CueChild[] };
export type CueChild = CueNode | TextNode | InlineParagraph;

// ── Directive vocabulary ─────────────────────────────────────────────────────

const ALERT_TYPE_TO_DIRECTIVE: Record<string, string> = {
  NOTE: "info",
  TIP: "tip",
  IMPORTANT: "important",
  WARNING: "warning",
  CAUTION: "danger",
};

const BLOCK_DIRECTIVES = ["details", "card"];
const CONTAINER_DIRECTIVES = ["tabs", "steps", "grid"];
const CHILD_DIRECTIVES = ["tab", "step", "cell"];

// Heading promotion regex: matches a line that is a Markdown ATX heading whose
// only content is a single inline heading directive — `text`{heading attrs}.
// Captures: 1 = heading-marker length (1..6), 2 = inner text, 3 = attrs text.
const HEADING_PROMOTION_RE =
  /^(#{1,6})\s+`([^`\n]+)`\{heading(\s+[^}\n]*)?\}\s*$/i;
const VOID_DIRECTIVES = new Set(["toc"]);

const FENCED_BLOCK_NAMES = new Set<string>([
  ...BLOCK_DIRECTIVES,
  ...CONTAINER_DIRECTIVES,
  ...CHILD_DIRECTIVES,
]);

// ── Inline splitter ──────────────────────────────────────────────────────────
//
// Pattern: `text`{name attrs}
// The brace block must close on the same line. If it doesn't, the inline code
// span is left as plain text (no CueNode emitted).

const INLINE_RE = /`([^`\n]+)`\{([a-z][a-z0-9-]*)(\s+[^}\n]*)?\}/gi;

function splitInlineLine(line: string): Array<CueNode | TextNode> {
  const out: Array<CueNode | TextNode> = [];
  let lastIdx = 0;
  INLINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = INLINE_RE.exec(line)) !== null) {
    const matchStart = m.index;
    const text = m[1];
    const name = m[2].toLowerCase();
    const attrsStr = (m[3] ?? "").trim();

    if (matchStart > lastIdx) {
      out.push({ kind: "text", content: line.slice(lastIdx, matchStart) });
    }
    out.push({
      kind: "cue",
      name,
      attrs: parseAttrs(attrsStr),
      children: [{ kind: "text", content: text }],
      inline: true,
      selfClosing: false,
    });
    lastIdx = INLINE_RE.lastIndex;
  }

  if (lastIdx < line.length) {
    out.push({ kind: "text", content: line.slice(lastIdx) });
  }
  return out;
}

/**
 * Apply inline splitting to a text body. Returns a flat list of TextNodes and
 * inline CueNodes; the caller is responsible for promoting inline runs to
 * InlineParagraph nodes via {@link mergeInlineParas}.
 */
function applyInlineToText(text: string): Array<CueNode | TextNode> {
  if (!text) return [];
  if (text.indexOf("`") < 0) return [{ kind: "text", content: text }];

  const lines = text.split("\n");
  const out: Array<CueNode | TextNode> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    const segments = splitInlineLine(line);

    if (segments.length === 0) {
      if (!isLast) appendText(out, "\n");
      continue;
    }

    for (const seg of segments) out.push(seg);
    if (!isLast) appendText(out, "\n");
  }

  return mergeTextRuns(out);
}

function appendText(arr: Array<CueNode | TextNode>, content: string): void {
  const last = arr[arr.length - 1];
  if (last && last.kind === "text") {
    last.content += content;
  } else {
    arr.push({ kind: "text", content });
  }
}

function mergeTextRuns<T extends { kind: string }>(children: T[]): T[] {
  const out: T[] = [];
  for (const c of children) {
    if (c.kind === "text") {
      const last = out[out.length - 1];
      if (last && last.kind === "text") {
        (last as unknown as TextNode).content += (c as unknown as TextNode).content;
        continue;
      }
    }
    out.push(c);
  }
  return out;
}

// ── Alert detection ──────────────────────────────────────────────────────────

const BLOCKQUOTE_LINE_RE = /^[ \t]{0,3}>[ \t]?(.*)$/;
const ALERT_FIRST_LINE_RE = /^\[!([A-Za-z][A-Za-z0-9-]*)((?:\s+[^=\s]+(?:=(?:"[^"]*"|\S*))?)*)?\]\s*(.*)$/;

interface AlertCapture {
  consumed: number;
  rawType: string;
  attrsText: string;
  titleOrTail: string;
  bodyLines: string[];
}

function captureBlockquote(lines: string[], start: number): { lines: string[]; end: number } | null {
  if (start >= lines.length) return null;
  const m0 = BLOCKQUOTE_LINE_RE.exec(lines[start]);
  if (!m0) return null;

  const captured: string[] = [m0[1] ?? ""];
  let i = start + 1;
  while (i < lines.length) {
    const m = BLOCKQUOTE_LINE_RE.exec(lines[i]);
    if (!m) break;
    captured.push(m[1] ?? "");
    i++;
  }
  return { lines: captured, end: i };
}

function detectAlert(lines: string[], start: number): AlertCapture | null {
  const bq = captureBlockquote(lines, start);
  if (!bq) return null;

  let head = -1;
  for (let i = 0; i < bq.lines.length; i++) {
    if (bq.lines[i].trim() !== "") {
      head = i;
      break;
    }
  }
  if (head < 0) return null;

  const m = ALERT_FIRST_LINE_RE.exec(bq.lines[head]);
  if (!m) return null;

  return {
    consumed: bq.end - start,
    rawType: m[1],
    attrsText: (m[2] ?? "").trim(),
    titleOrTail: m[3].trim(),
    bodyLines: bq.lines.slice(head + 1),
  };
}

// ── Fenced block detection ───────────────────────────────────────────────────

const FENCE_OPEN_RE = /^([ \t]{0,3})(`{3,}|~{3,})\s*([a-z][a-z0-9-]*)(\s+[^\n]*)?$/i;

interface FenceCapture {
  consumed: number;
  name: string;
  attrsText: string;
  bodyLines: string[];
  unterminated: boolean;
}

function detectFence(lines: string[], start: number): FenceCapture | null {
  if (start >= lines.length) return null;
  const m = FENCE_OPEN_RE.exec(lines[start]);
  if (!m) return null;

  const indent = m[1];
  const marker = m[2];
  const name = m[3].toLowerCase();
  const attrsText = (m[4] ?? "").trim();

  const fenceChar = marker[0];
  const minLen = marker.length;
  const closeRe = new RegExp(`^[ \\t]{0,3}\\${fenceChar}{${minLen},}\\s*$`);

  const body: string[] = [];
  let i = start + 1;
  let unterminated = true;

  while (i < lines.length) {
    if (closeRe.test(lines[i])) {
      unterminated = false;
      i++;
      break;
    }
    body.push(lines[i]);
    i++;
  }

  const stripped = indent ? body.map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l)) : body;

  return {
    consumed: i - start,
    name,
    attrsText,
    bodyLines: stripped,
    unterminated,
  };
}

// ── Main parse entry points ──────────────────────────────────────────────────

/**
 * Parse a Cue Markdown source string into a tree of CueChild nodes.
 *
 * The result combines:
 *   - CueNode (block) for callouts, fenced directives, void directives
 *   - CueNode (inline) for inline directives — these may also appear inside
 *     an InlineParagraph wrapper after post-processing
 *   - TextNode for raw Markdown text segments between directives
 *   - InlineParagraph that groups consecutive inline CueNodes with their
 *     surrounding same-line text (so the React renderer can emit a single
 *     <p> instead of splitting the run across multiple Markdown chunks)
 */
export function parseCueMdTree(source: string): CueChild[] {
  const lines = source.split("\n");
  const tree = parseLines(lines);
  mergeInlineParas(tree);
  return tree;
}

function parseLines(lines: string[]): CueChild[] {
  const out: CueChild[] = [];
  let textBuf: string[] = [];
  let inFenceBuf = false;
  let fenceBufMarker = "";

  const flushText = (): void => {
    if (textBuf.length === 0) return;
    const raw = textBuf.join("\n");
    textBuf = [];
    if (!raw) return;
    for (const p of applyInlineToText(raw)) out.push(p);
  };

  const isPassThroughFenceOpen = (line: string): { marker: string } | null => {
    const m = /^[ \t]{0,3}(`{3,}|~{3,})\s*(\S+)?/.exec(line);
    if (!m) return null;
    const marker = m[1];
    const lang = m[2];
    if (lang && FENCED_BLOCK_NAMES.has(lang.toLowerCase())) return null;
    return { marker };
  };

  for (let i = 0; i < lines.length; ) {
    const line = lines[i];

    if (inFenceBuf) {
      textBuf.push(line);
      const t = line.trim();
      if (t.startsWith(fenceBufMarker[0]) && /^[`~]+$/.test(t) && t.length >= fenceBufMarker.length) {
        inFenceBuf = false;
        fenceBufMarker = "";
      }
      i++;
      continue;
    }

    if (line.trimStart().startsWith("`") || line.trimStart().startsWith("~")) {
      const fc = detectFence(lines, i);
      if (fc && FENCED_BLOCK_NAMES.has(fc.name)) {
        flushText();
        const innerChildren = parseLines(fc.bodyLines);
        mergeInlineParas(innerChildren);
        out.push({
          kind: "cue",
          name: fc.name,
          attrs: parseAttrs(fc.attrsText),
          children: innerChildren,
          inline: false,
          selfClosing: false,
        });
        i += fc.consumed;
        continue;
      }
    }

    {
      const fo = isPassThroughFenceOpen(line);
      if (fo) {
        textBuf.push(line);
        inFenceBuf = true;
        fenceBufMarker = fo.marker;
        i++;
        continue;
      }
    }

    // ── Heading promotion: ## `Title`{heading color=X} ─────────────────────
    {
      const hm = HEADING_PROMOTION_RE.exec(line);
      if (hm) {
        flushText();
        const level = hm[1].length;
        const text = hm[2];
        const attrsText = (hm[3] ?? "").trim();
        const attrs = parseAttrs(attrsText);
        attrs.level = String(level);
        out.push({
          kind: "cue",
          name: "heading",
          attrs,
          children: [{ kind: "text", content: text }],
          inline: false,
          selfClosing: false,
        });
        i++;
        continue;
      }
    }

    if (line.trimStart().startsWith(">")) {
      const ac = detectAlert(lines, i);
      if (ac) {
        const typeUpper = ac.rawType.toUpperCase();
        const typeLower = ac.rawType.toLowerCase();
        const directiveName = ALERT_TYPE_TO_DIRECTIVE[typeUpper];

        if (directiveName) {
          flushText();
          const attrs: Record<string, string> = ac.attrsText ? parseAttrs(ac.attrsText) : {};
          if (ac.titleOrTail) attrs.title = ac.titleOrTail;
          const innerChildren = parseLines(ac.bodyLines);
          mergeInlineParas(innerChildren);
          out.push({
            kind: "cue",
            name: directiveName,
            attrs,
            children: innerChildren,
            inline: false,
            selfClosing: false,
          });
          i += ac.consumed;
          continue;
        }

        if (VOID_DIRECTIVES.has(typeLower)) {
          flushText();
          const attrs: Record<string, string> = ac.attrsText ? parseAttrs(ac.attrsText) : {};
          if (ac.titleOrTail) attrs.title = ac.titleOrTail;
          out.push({
            kind: "cue",
            name: typeLower,
            attrs,
            children: [],
            inline: false,
            selfClosing: true,
          });
          i += ac.consumed;
          continue;
        }
      }
    }

    textBuf.push(line);
    i++;
  }

  flushText();
  return mergeTextRuns(out);
}

// ── mergeInlineParas ─────────────────────────────────────────────────────────
//
// Walks the tree and groups runs of inline CueNodes + same-line text fragments
// into a single InlineParagraph. This matches the previous parser's behavior
// so the React renderer can emit one <p> per inline run.

function mergeInlineParas(children: CueChild[]): void {
  // Recurse into block children
  for (const child of children) {
    if (child.kind === "cue" && !child.inline) {
      mergeInlineParas(child.children);
    }
  }

  let i = 0;
  while (i < children.length) {
    const node = children[i];
    if (node.kind !== "cue" || !(node as CueNode).inline) {
      i++;
      continue;
    }

    const run: CueChild[] = [];

    // Take the tail of the previous TextNode (after its last newline)
    if (i > 0 && children[i - 1].kind === "text") {
      const prev = children[i - 1] as TextNode;
      const nlIdx = prev.content.lastIndexOf("\n");
      const tail = nlIdx >= 0 ? prev.content.slice(nlIdx + 1) : prev.content;
      const head = nlIdx >= 0 ? prev.content.slice(0, nlIdx + 1) : "";
      if (tail) run.push({ kind: "text", content: tail });
      if (head) {
        (children[i - 1] as TextNode).content = head;
      } else {
        children.splice(i - 1, 1);
        i--;
      }
    }

    // Consume consecutive inline CueNodes and text-without-newline
    let j = i;
    while (j < children.length) {
      const c = children[j];
      if (c.kind === "cue" && (c as CueNode).inline) {
        run.push(c);
        j++;
        continue;
      }
      if (c.kind === "text") {
        const txt = (c as TextNode).content;
        const nlIdx = txt.indexOf("\n");
        if (nlIdx === -1) {
          run.push(c);
          j++;
          continue;
        }
        if (nlIdx > 0) run.push({ kind: "text", content: txt.slice(0, nlIdx) });
        (children[j] as TextNode).content = txt.slice(nlIdx);
        break;
      }
      break;
    }

    const para: InlineParagraph = { kind: "inline-para", children: run };
    children.splice(i, j - i, para);
    i++;
  }
}

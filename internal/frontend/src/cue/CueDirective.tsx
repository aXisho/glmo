import { useState, useEffect, Children, isValidElement, type ReactNode } from "react";
import { SAFE_URL_PATTERN, ALLOWED_COLORS } from "./parser";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function safeColor(color: string | undefined, fallback: string = "gray"): string {
  if (color && (ALLOWED_COLORS as readonly string[]).includes(color)) return color;
  return fallback;
}

function isSafeHref(href: string | undefined): boolean {
  if (!href) return false;
  return SAFE_URL_PATTERN.test(href);
}

function clampLevel(raw: string | undefined): number {
  const n = parseInt(raw ?? "2", 10);
  if (!Number.isFinite(n)) return 2;
  if (n < 1) return 1;
  if (n > 6) return 6;
  return n;
}

function childrenToText(children: ReactNode): string {
  let out = "";
  Children.forEach(children, (c) => {
    if (typeof c === "string" || typeof c === "number") {
      out += String(c);
      return;
    }
    if (isValidElement(c)) {
      const props = c.props as { children?: ReactNode };
      out += childrenToText(props.children);
    }
  });
  return out;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-");
}

// ────────────────────────────────────────────────────────────────────────────
// CueCallout
// ────────────────────────────────────────────────────────────────────────────

type CalloutType = "info" | "tip" | "important" | "warning" | "danger";

const CALLOUT_ICONS: Record<CalloutType, string> = {
  info: "ℹ️",
  tip: "💡",
  important: "❗",
  warning: "⚠️",
  danger: "🔥",
};

const CALLOUT_DEFAULT_TITLES: Record<CalloutType, string> = {
  info: "Info",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  danger: "Danger",
};

const CALLOUT_TYPES = new Set<string>(Object.keys(CALLOUT_ICONS));

function CueCallout({ type, title, children }: { type: CalloutType; title?: string; children?: ReactNode }) {
  const effectiveTitle = title ?? CALLOUT_DEFAULT_TITLES[type];
  return (
    <div className={`cue-callout cue-callout-${type}`}>
      {effectiveTitle && (
        <div className="cue-callout-title">
          <span>{CALLOUT_ICONS[type] ?? ""}</span>
          {effectiveTitle}
        </div>
      )}
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CueTab (thin wrapper — CueTabs inspects children for this type)
// ────────────────────────────────────────────────────────────────────────────

export function CueTab({ children }: { title?: string; color?: string; children?: ReactNode }) {
  return <>{children}</>;
}

// ────────────────────────────────────────────────────────────────────────────
// CueTabs / CueTabsRenderer
// ────────────────────────────────────────────────────────────────────────────

type TabItem = { title: string; color?: string; content: ReactNode };

function TabsUI({ tabs, color }: { tabs: TabItem[]; color?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (tabs.length === 0) return null;
  const safeIndex = Math.min(activeIndex, tabs.length - 1);
  const parentColor = safeColor(color, "blue");
  return (
    <div className={`cue-tabs cue-color-${parentColor}`}>
      <div className="cue-tabs-bar" role="tablist">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            role="tab"
            aria-selected={idx === safeIndex}
            className={`cue-tabs-btn cue-color-${safeColor(tab.color, parentColor)}${idx === safeIndex ? " active" : ""}`}
            onClick={() => setActiveIndex(idx)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div className="cue-tabs-panel" role="tabpanel">
        {tabs[safeIndex]?.content}
      </div>
    </div>
  );
}

export function CueTabsRenderer({ tabs, color }: { tabs: TabItem[]; color?: string }) {
  return <TabsUI tabs={tabs} color={color} />;
}

function CueTabs({ children, color }: { children?: ReactNode; color?: string }) {
  const tabs: TabItem[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === CueTab) {
      const props = child.props as { title?: string; color?: string; children?: ReactNode };
      tabs.push({ title: props.title ?? `Tab ${tabs.length + 1}`, color: props.color, content: props.children });
    }
  });
  if (tabs.length === 0) return <>{children}</>;
  return <TabsUI tabs={tabs} color={color} />;
}

// ────────────────────────────────────────────────────────────────────────────
// CueCard
// ────────────────────────────────────────────────────────────────────────────

function CueCard({ title, href, color, children }: { title?: string; href?: string; color?: string; children?: ReactNode }) {
  const colorClass = color ? ` cue-color-${safeColor(color)}` : "";
  const inner = (
    <div className={`cue-card${colorClass}`}>
      {title && <div className="cue-card-title">{title}</div>}
      {children}
    </div>
  );
  if (isSafeHref(href)) {
    return (
      <a href={href} className="cue-card-link" style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </a>
    );
  }
  return inner;
}

// ────────────────────────────────────────────────────────────────────────────
// CueToc
// ────────────────────────────────────────────────────────────────────────────

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function CueToc({ title, depth }: { title?: string; depth?: number }) {
  const maxDepth = depth ?? 3;
  const [entries, setEntries] = useState<TocEntry[]>([]);

  useEffect(() => {
    // Scope to the Cue document and skip the auto-generated GFM footnote
    // heading ("Footnotes" sr-only h2) so it doesn't pollute the TOC.
    const root = document.querySelector(".cue-document") ?? document;
    const result: TocEntry[] = [];
    for (const el of root.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
      if (!el.id) continue;
      if (el.closest("section.footnotes, section[data-footnotes]")) continue;
      const level = parseInt(el.tagName.slice(1), 10);
      if (level <= maxDepth) result.push({ id: el.id, text: el.textContent ?? "", level });
    }
    setEntries(result);
  }, [maxDepth]);

  return (
    <div className="cue-toc">
      {title && <div className="cue-toc-title">{title}</div>}
      {entries.length > 0 && (
        <ol>
          {entries.map((e) => (
            <li key={e.id} style={{ marginLeft: `${(e.level - 1) * 1}rem` }}>
              <a href={`#${e.id}`}>{e.text}</a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CueDirective — main dispatcher
// ────────────────────────────────────────────────────────────────────────────

interface CueDirectiveProps {
  name: string;
  attrs: Record<string, string>;
  children?: ReactNode;
  inline?: boolean;
  selfClosing?: boolean;
}

export function CueDirective({ name, attrs, children, inline = false }: CueDirectiveProps) {
  if (CALLOUT_TYPES.has(name)) {
    return <CueCallout type={name as CalloutType} title={attrs.title}>{children}</CueCallout>;
  }

  switch (name) {
    case "details": {
      const color = safeColor(attrs.color, "gray");
      return (
        <details className={`cue-details cue-color-${color}`} open={attrs.open === "true"}>
          <summary>{attrs.title ?? "Details"}</summary>
          {children}
        </details>
      );
    }
    case "tabs":
      return <CueTabs color={safeColor(attrs.color, "blue")}>{children}</CueTabs>;
    case "tab":
      return <CueTab title={attrs.title} color={attrs.color}>{children}</CueTab>;
    case "badge":
      return <span className={`cue-badge cue-color-${safeColor(attrs.color)}`}>{children}</span>;
    case "mark":
      return <mark className={`cue-mark cue-color-${safeColor(attrs.color)}`}>{children}</mark>;
    case "small":
      return <small className="cue-small">{children}</small>;
    case "big":
      // <big> is obsolete in HTML5; we emit a span with our styling hook.
      return <span className="cue-big">{children}</span>;
    case "kbd":
      return <kbd className="cue-kbd">{children}</kbd>;
    case "heading": {
      const color = safeColor(attrs.color);
      const level = clampLevel(attrs.level);
      const className = `cue-heading cue-heading-color-${color}`;
      const id = slugify(childrenToText(children));
      const H = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return <H id={id} className={className}>{children}</H>;
    }
    case "toc":
      return <CueToc title={attrs.title} depth={attrs.depth ? Number(attrs.depth) : undefined} />;
    // (`columns`/`column` removed — use `grid border=none` for the same effect.)
    case "card":
      return <CueCard title={attrs.title} href={attrs.href} color={attrs.color}>{children}</CueCard>;
    case "grid": {
      const color = safeColor(attrs.color, "gray");
      const borderClass = attrs.border === "none" ? " cue-border-none" : "";
      const cellCount = parseInt(attrs["_cell_count"] ?? "0", 10) || 0;
      const colsAttr = attrs.cols ? parseInt(attrs.cols, 10) : NaN;
      const rowsAttr = attrs.rows ? parseInt(attrs.rows, 10) : NaN;
      const hasCols = Number.isFinite(colsAttr) && colsAttr > 0;
      const hasRows = Number.isFinite(rowsAttr) && rowsAttr > 0;
      let cols: number;
      if (hasCols) cols = colsAttr;
      else if (hasRows && cellCount > 0) cols = Math.max(1, Math.ceil(cellCount / rowsAttr));
      else cols = Math.max(1, cellCount || 2);
      const style: React.CSSProperties = { gridTemplateColumns: `repeat(${cols}, 1fr)` };
      if (hasRows) style.gridTemplateRows = `repeat(${rowsAttr}, auto)`;
      return (
        <div className={`cue-grid cue-color-${color}${borderClass}`} style={style}>
          {children}
        </div>
      );
    }
    case "cell": {
      const colorClass = attrs.color ? ` cue-color-${safeColor(attrs.color, "gray")}` : "";
      const borderClass =
        attrs.border === "none" ? " cue-border-none" : attrs.border === "solid" ? " cue-border-solid" : "";
      return (
        <div className={`cue-cell${colorClass}${borderClass}`}>
          {attrs.title && <strong>{attrs.title}</strong>}
          {children}
        </div>
      );
    }
    case "steps":
      return <ol className={`cue-steps cue-color-${safeColor(attrs.color, "blue")}`}>{children}</ol>;
    case "step": {
      const colorClass = attrs.color ? ` cue-color-${safeColor(attrs.color, "blue")}` : "";
      return (
        <li className={`cue-step${colorClass}`}>
          {attrs.title && <strong>{attrs.title}</strong>}
          {children}
        </li>
      );
    }
    default:
      return inline ? <span>{children}</span> : <div>{children}</div>;
  }
}

import { useState, useEffect, Children, isValidElement, type ReactNode } from "react";
import katex from "katex";
import { SAFE_URL_PATTERN, ALLOWED_COLORS } from "./parser";
import { toEmbedSrc, parseGistUrl } from "../utils/embedUrl";
import { GistEmbed } from "../components/GistEmbed";

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
// GlossCallout
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

function GlossCallout({ type, title, children }: { type: CalloutType; title?: string; children?: ReactNode }) {
  const effectiveTitle = title ?? CALLOUT_DEFAULT_TITLES[type];
  return (
    <div className={`gloss-callout gloss-callout-${type}`}>
      {effectiveTitle && (
        <div className="gloss-callout-title">
          <span>{CALLOUT_ICONS[type] ?? ""}</span>
          {effectiveTitle}
        </div>
      )}
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// GlossTab (thin wrapper — GlossTabs inspects children for this type)
// ────────────────────────────────────────────────────────────────────────────

export function GlossTab({ children }: { title?: string; color?: string; children?: ReactNode }) {
  return <>{children}</>;
}

// ────────────────────────────────────────────────────────────────────────────
// GlossTabs / GlossTabsRenderer
// ────────────────────────────────────────────────────────────────────────────

type TabItem = { title: string; color?: string; content: ReactNode };

function TabsUI({ tabs, color }: { tabs: TabItem[]; color?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  if (tabs.length === 0) return null;
  const safeIndex = Math.min(activeIndex, tabs.length - 1);
  const parentColor = safeColor(color, "blue");
  return (
    <div className={`gloss-tabs gloss-color-${parentColor}`}>
      <div className="gloss-tabs-bar" role="tablist">
        {tabs.map((tab, idx) => (
          <button
            key={idx}
            role="tab"
            aria-selected={idx === safeIndex}
            className={`gloss-tabs-btn gloss-color-${safeColor(tab.color, parentColor)}${idx === safeIndex ? " active" : ""}`}
            onClick={() => setActiveIndex(idx)}
          >
            {tab.title}
          </button>
        ))}
      </div>
      <div className="gloss-tabs-panel" role="tabpanel">
        {tabs[safeIndex]?.content}
      </div>
    </div>
  );
}

export function GlossTabsRenderer({ tabs, color }: { tabs: TabItem[]; color?: string }) {
  return <TabsUI tabs={tabs} color={color} />;
}

function GlossTabs({ children, color }: { children?: ReactNode; color?: string }) {
  const tabs: TabItem[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === GlossTab) {
      const props = child.props as { title?: string; color?: string; children?: ReactNode };
      tabs.push({ title: props.title ?? `Tab ${tabs.length + 1}`, color: props.color, content: props.children });
    }
  });
  if (tabs.length === 0) return <>{children}</>;
  return <TabsUI tabs={tabs} color={color} />;
}

// ────────────────────────────────────────────────────────────────────────────
// GlossCard
// ────────────────────────────────────────────────────────────────────────────

function GlossCard({ title, href, color, children }: { title?: string; href?: string; color?: string; children?: ReactNode }) {
  const colorClass = color ? ` gloss-color-${safeColor(color)}` : "";
  const inner = (
    <div className={`gloss-card${colorClass}`}>
      {title && <div className="gloss-card-title">{title}</div>}
      {children}
    </div>
  );
  if (isSafeHref(href)) {
    return (
      <a href={href} className="gloss-card-link" style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </a>
    );
  }
  return inner;
}

// ────────────────────────────────────────────────────────────────────────────
// GlossToc
// ────────────────────────────────────────────────────────────────────────────

interface TocEntry {
  id: string;
  text: string;
  level: number;
}

function GlossToc({ title, depth }: { title?: string; depth?: number }) {
  const maxDepth = depth ?? 3;
  const [entries, setEntries] = useState<TocEntry[]>([]);

  useEffect(() => {
    const root = document.querySelector(".gloss-document") ?? document;
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
    <div className="gloss-toc">
      {title && <div className="gloss-toc-title">{title}</div>}
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
// GlossDirective — main dispatcher
// ────────────────────────────────────────────────────────────────────────────

interface GlossDirectiveProps {
  name: string;
  attrs: Record<string, string>;
  children?: ReactNode;
  inline?: boolean;
  selfClosing?: boolean;
}

export function GlossDirective({ name, attrs, children, inline = false }: GlossDirectiveProps) {
  if (CALLOUT_TYPES.has(name)) {
    return <GlossCallout type={name as CalloutType} title={attrs.title}>{children}</GlossCallout>;
  }

  switch (name) {
    case "details": {
      const colorClass = attrs.color ? ` gloss-color-${safeColor(attrs.color)}` : "";
      return (
        <details className={`gloss-details${colorClass}`} open={attrs.open === "true"}>
          <summary>{attrs.title ?? "Details"}</summary>
          {children}
        </details>
      );
    }
    case "tabs":
      return <GlossTabs color={safeColor(attrs.color, "blue")}>{children}</GlossTabs>;
    case "tab":
      return <GlossTab title={attrs.title} color={attrs.color}>{children}</GlossTab>;
    case "badge":
      return <span className={`gloss-badge gloss-color-${safeColor(attrs.color)}`}>{children}</span>;
    case "small":
      return <small className="gloss-small">{children}</small>;
    case "big":
      return <span className="gloss-big">{children}</span>;
    case "kbd":
      return <kbd className="gloss-kbd">{children}</kbd>;
    case "math": {
      const expr = childrenToText(children);
      let html = "";
      try {
        html = katex.renderToString(expr, { displayMode: false, throwOnError: false });
      } catch {
        // ignore
      }
      return html
        ? <span className="math math-inline" dangerouslySetInnerHTML={{ __html: html }} />
        : <code>{expr}</code>;
    }
    case "heading": {
      const color = safeColor(attrs.color);
      const rawIndent = parseInt(attrs.indent ?? "0", 10);
      const indent = Number.isFinite(rawIndent) && rawIndent > 0 ? rawIndent : 0;
      const level = clampLevel(attrs.level);
      const className = `gloss-heading gloss-heading-color-${color}`;
      const id = slugify(childrenToText(children));
      const H = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const style = indent > 0 ? { marginLeft: `${indent * 1.5}rem` } : undefined;
      return <H id={id} className={className} style={style}>{children}</H>;
    }
    case "embed": {
      const url = attrs.url?.trim();
      if (!url || !isSafeHref(url)) {
        return (
          <div className="gloss-embed gloss-embed-invalid">
            <span>embed: invalid URL</span>
          </div>
        );
      }
      const gist = parseGistUrl(url);
      if (gist) {
        return (
          <div className="gloss-embed">
            <GistEmbed gistId={gist.gistId} file={gist.file} />
          </div>
        );
      }
      return (
        <div className="gloss-embed">
          <iframe
            src={toEmbedSrc(url)}
            title="Embedded content"
            allowFullScreen
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
          />
        </div>
      );
    }
    case "toc":
      return <GlossToc title={attrs.title} depth={attrs.depth ? Number(attrs.depth) : undefined} />;
    case "card":
      return <GlossCard title={attrs.title} href={attrs.href} color={attrs.color}>{children}</GlossCard>;
    case "grid": {
      const colorClass = attrs.color ? ` gloss-color-${safeColor(attrs.color)}` : "";
      const borderClass = attrs.border === "none" ? " gloss-border-none" : "";
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
        <div className={`gloss-grid${colorClass}${borderClass}`} style={style}>
          {children}
        </div>
      );
    }
    case "cell": {
      const colorClass = attrs.color ? ` gloss-color-${safeColor(attrs.color, "gray")}` : "";
      const borderClass =
        attrs.border === "none" ? " gloss-border-none" : attrs.border === "solid" ? " gloss-border-solid" : "";
      return (
        <div className={`gloss-cell${colorClass}${borderClass}`}>
          {attrs.title && <strong>{attrs.title}</strong>}
          {children}
        </div>
      );
    }
    case "steps":
      return <ol className={`gloss-steps gloss-color-${safeColor(attrs.color, "blue")}`}>{children}</ol>;
    case "step": {
      const colorClass = attrs.color ? ` gloss-color-${safeColor(attrs.color, "blue")}` : "";
      return (
        <li className={`gloss-step${colorClass}`}>
          {attrs.title && <strong>{attrs.title}</strong>}
          {children}
        </li>
      );
    }
    default:
      return inline ? <span>{children}</span> : <div>{children}</div>;
  }
}

import type React from "react";
import { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeKatex from "rehype-katex";
import { rehypeGithubAlerts } from "rehype-github-alerts";
import { codeToHtml } from "shiki";
import { CueDirective, CueTab, CueTabsRenderer } from "./CueDirective";
import type { CueChild, CueNode, InlineParagraph } from "./treeParser";
import { parseCueMdTree } from "./treeParser";
import { detectLanguage } from "../utils/filetype";

/**
 * Resolve a code-fence info-string token to a Shiki language identifier.
 *
 * Accepts both language names (`typescript`, `python`, `bash`) and file
 * extensions (`ts`, `py`, `sh`). Extensions are resolved via the same
 * extension→language map that `detectLanguage` uses for files.
 */
function resolveLang(token: string): string {
  if (!token) return "text";
  const lower = token.toLowerCase().replace(/^\./, "");
  // Try detectLanguage by treating the token as a filename extension.
  const fromExt = detectLanguage(`file.${lower}`);
  if (fromExt !== "text") return fromExt;
  // Otherwise assume the token is already a Shiki language identifier.
  return lower;
}

const mdSchema = {
  ...defaultSchema,
  // remark-gfm already emits footnote ids/hrefs with the `user-content-`
  // prefix. Leaving rehype-sanitize's default clobberPrefix (also
  // `user-content-`) in place would double the prefix on id attributes
  // (e.g. id="user-content-user-content-fn-big-o") so the anchor links no
  // longer match. Disable the extra clobbering — the prefix from GFM is
  // already enough to scope footnote ids to the article.
  clobberPrefix: "",
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    // GFM footnote uses <section> for the footnote block at the end of the doc.
    "section",
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.["code"] || []), "className"],
    // GFM footnote markup ↓
    section: [
      ...((defaultSchema.attributes?.["section"] as unknown[]) ?? []),
      "className",
      ["dataFootnotes", "true"],
    ],
    li: [
      ...((defaultSchema.attributes?.["li"] as unknown[]) ?? []),
      "id",
    ],
    a: [
      ...((defaultSchema.attributes?.["a"] as unknown[]) ?? []),
      "id",
      "ariaLabel",
      "ariaDescribedBy",
      "dataFootnoteRef",
      "dataFootnoteBackref",
    ],
    sup: [
      ...((defaultSchema.attributes?.["sup"] as unknown[]) ?? []),
      "id",
    ],
    h2: [
      ...((defaultSchema.attributes?.["h2"] as unknown[]) ?? []),
      "id",
    ],
  },
};

function CueCodeBlock({ language, code }: { language: string; code: string }) {
  const [html, setHtml] = useState("");
  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, { lang: language, theme: "github-dark" })
      .catch(() => codeToHtml(code, { lang: "text", theme: "github-dark" }))
      .then((result) => { if (!cancelled) setHtml(result); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [code, language]);
  if (html) return <div dangerouslySetInnerHTML={{ __html: html }} />;
  return <pre><code>{code}</code></pre>;
}

const mdComponents = {
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const rawLang = /language-([\w.+-]+)/.exec(className ?? "")?.[1];
    const code = String(children).replace(/\n$/, "");
    const isBlock = String(children).endsWith("\n");
    if (rawLang) return <CueCodeBlock language={resolveLang(rawLang)} code={code} />;
    if (isBlock) return <CueCodeBlock language="text" code={code} />;
    return <code className={className}>{children}</code>;
  },
};

function MarkdownChunk({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[
        [rehypeSanitize, mdSchema],
        rehypeGithubAlerts,
        rehypeSlug,
        rehypeKatex,
      ]}
      components={mdComponents}
    >
      {content}
    </Markdown>
  );
}

// Render an inline CueNode — returns a span-level element
function renderInlineNode(node: CueNode, key: number): React.ReactNode {
  const children = node.children.map((c, i) => {
    if (c.kind === "text") return c.content;
    return renderInlineNode(c as CueNode, i);
  });
  return (
    <CueDirective key={key} name={node.name} attrs={node.attrs} inline={true} selfClosing={node.selfClosing}>
      {children}
    </CueDirective>
  );
}

// Render an inline-para: a paragraph with mixed text and inline directives
function renderInlinePara(para: InlineParagraph, key: number): React.ReactNode {
  const parts = para.children.flatMap((c, i) => {
    if (c.kind === "text") {
      // Split off leading/trailing whitespace as separate text nodes so that
      // <Markdown> trimming does not collapse the spaces between directives.
      const match = c.content.match(/^(\s*)([\s\S]*?)(\s*)$/);
      const [lead, mid, trail] = match ? [match[1], match[2], match[3]] : ["", c.content, ""];
      const nodes: React.ReactNode[] = [];
      if (lead) nodes.push(lead);
      if (mid) {
        nodes.push(
          <Markdown
            key={i}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[[rehypeSanitize, mdSchema]]}
            components={{ p: ({ children }) => <>{children}</> }}
          >
            {mid}
          </Markdown>
        );
      }
      if (trail) nodes.push(trail);
      return nodes;
    }
    if (c.kind === "cue") return [renderInlineNode(c, i)];
    return [];
  });
  return <p key={key}>{parts}</p>;
}

function renderChild(child: CueChild, key: number, parentInline = false): React.ReactNode {
  if (child.kind === "text") {
    if (!child.content.trim()) return null;
    if (parentInline) {
      // Inside an inline directive, render text as plain inline (no <p> wrapper)
      return (
        <Markdown
          key={key}
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeSanitize, mdSchema]]}
          components={{ p: ({ children }) => <>{children}</> }}
        >
          {child.content}
        </Markdown>
      );
    }
    return <MarkdownChunk key={key} content={child.content} />;
  }
  if (child.kind === "inline-para") {
    return renderInlinePara(child, key);
  }
  return <CueNodeRenderer key={key} node={child} parentInline={parentInline} />;
}

function CueNodeRenderer({ node, parentInline = false }: { node: CueNode; parentInline?: boolean }) {
  const isInline = node.inline || parentInline;

  // Special case: tabs renders its tab children as structured data to avoid
  // relying on React.Children type-checking (which is fragile across renders)
  if (node.name === "tabs") {
    const tabs = node.children
      .filter((c): c is CueNode => c.kind === "cue" && c.name === "tab")
      .map((tab) => ({
        title: tab.attrs.title ?? "",
        color: tab.attrs.color,
        content: tab.children.map((c, i) => renderChild(c, i)),
      }));
    return <CueTabsRenderer tabs={tabs} color={node.attrs.color} />;
  }

  // Special case: tab must render as CueTab so CueTabs can detect it via child.type
  if (node.name === "tab") {
    const children = node.children.map((c, i) => renderChild(c, i));
    return <CueTab title={node.attrs.title} color={node.attrs.color}>{children}</CueTab>;
  }

  // Special case: heading body is inline-only — render children with
  // parentInline=true so <Markdown> doesn't wrap them in a stray <p>.
  if (node.name === "heading") {
    const children = node.children.map((c, i) => renderChild(c, i, true));
    return (
      <CueDirective
        name="heading"
        attrs={node.attrs}
        inline={false}
        selfClosing={node.selfClosing}
      >
        {children}
      </CueDirective>
    );
  }

  // Special case: inject the actual cell-child count so the renderer can
  // resolve `cols` / `rows` even when both attributes are omitted.
  if (node.name === "grid") {
    const cellCount = node.children.filter(
      (c) => c.kind === "cue" && c.name === "cell",
    ).length;
    const children = node.children.map((c, i) => renderChild(c, i, isInline));
    return (
      <CueDirective
        name="grid"
        attrs={{ ...node.attrs, _cell_count: String(cellCount || 0) }}
        inline={isInline}
        selfClosing={node.selfClosing}
      >
        {children}
      </CueDirective>
    );
  }

  const children = node.children.map((c, i) => renderChild(c, i, isInline));
  return (
    <CueDirective
      name={node.name}
      attrs={node.attrs}
      inline={isInline}
      selfClosing={node.selfClosing}
    >
      {children}
    </CueDirective>
  );
}

interface CueDocumentRendererProps {
  source: string;
}

export function CueDocumentRenderer({ source }: CueDocumentRendererProps) {
  const tree = parseCueMdTree(source);
  const ref = useRef<HTMLDivElement | null>(null);

  // Post-process: when react-markdown processes each MarkdownChunk independently,
  // any chunk that contains a footnote reference also emits its own
  // <section class="footnotes"> at that chunk's end. We collect all those
  // sections, merge their <ol> contents into a single section, and move it to
  // the very end of the cue-document so footnotes appear in one place.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const sections = root.querySelectorAll<HTMLElement>("section.footnotes, section[data-footnotes]");
    if (sections.length === 0) return;
    const merged = document.createElement("section");
    merged.className = "footnotes";
    merged.setAttribute("data-footnotes", "");
    const heading = document.createElement("h2");
    heading.className = "sr-only";
    heading.id = "footnote-label";
    heading.textContent = "Footnotes";
    merged.appendChild(heading);
    const ol = document.createElement("ol");
    const seenIds = new Set<string>();
    sections.forEach((sec) => {
      sec.querySelectorAll<HTMLLIElement>("ol > li").forEach((li) => {
        const id = li.id || "";
        if (id && seenIds.has(id)) return;
        if (id) seenIds.add(id);
        ol.appendChild(li);
      });
      sec.remove();
    });
    merged.appendChild(ol);
    root.appendChild(merged);
  });

  return (
    <div ref={ref} className="cue-document">
      {tree.map((child, i) => renderChild(child, i))}
    </div>
  );
}

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
import { GlossDirective, GlossTab, GlossTabsRenderer } from "./GlossDirective";
import type { GlossChild, GlossNode, InlineParagraph } from "./treeParser";
import { parseGlossMdTree } from "./treeParser";
import { detectLanguage } from "../utils/filetype";

function resolveLang(token: string): string {
  if (!token) return "text";
  const lower = token.toLowerCase().replace(/^\./, "");
  const fromExt = detectLanguage(`file.${lower}`);
  if (fromExt !== "text") return fromExt;
  return lower;
}

const mdSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "section",
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.["code"] || []), "className"],
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

function GlossCodeBlock({ language, code }: { language: string; code: string }) {
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
    if (rawLang) return <GlossCodeBlock language={resolveLang(rawLang)} code={code} />;
    if (isBlock) return <GlossCodeBlock language="text" code={code} />;
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

function renderInlineNode(node: GlossNode, key: number): React.ReactNode {
  const children = node.children.map((c, i) => {
    if (c.kind === "text") return c.content;
    return renderInlineNode(c as GlossNode, i);
  });
  return (
    <GlossDirective key={key} name={node.name} attrs={node.attrs} inline={true} selfClosing={node.selfClosing}>
      {children}
    </GlossDirective>
  );
}

function renderInlinePara(para: InlineParagraph, key: number): React.ReactNode {
  const parts = para.children.flatMap((c, i) => {
    if (c.kind === "text") {
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

function renderChild(child: GlossChild, key: number, parentInline = false): React.ReactNode {
  if (child.kind === "text") {
    if (!child.content.trim()) return null;
    if (parentInline) {
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
  return <GlossNodeRenderer key={key} node={child} parentInline={parentInline} />;
}

function GlossNodeRenderer({ node, parentInline = false }: { node: GlossNode; parentInline?: boolean }) {
  const isInline = node.inline || parentInline;

  if (node.name === "tabs") {
    const tabs = node.children
      .filter((c): c is GlossNode => c.kind === "cue" && c.name === "tab")
      .map((tab) => ({
        title: tab.attrs.title ?? "",
        color: tab.attrs.color,
        content: tab.children.map((c, i) => renderChild(c, i)),
      }));
    return <GlossTabsRenderer tabs={tabs} color={node.attrs.color} />;
  }

  if (node.name === "tab") {
    const children = node.children.map((c, i) => renderChild(c, i));
    return <GlossTab title={node.attrs.title} color={node.attrs.color}>{children}</GlossTab>;
  }

  if (node.name === "heading") {
    const children = node.children.map((c, i) => renderChild(c, i, true));
    return (
      <GlossDirective
        name="heading"
        attrs={node.attrs}
        inline={false}
        selfClosing={node.selfClosing}
      >
        {children}
      </GlossDirective>
    );
  }

  if (node.name === "grid") {
    const cellCount = node.children.filter(
      (c) => c.kind === "cue" && c.name === "cell",
    ).length;
    const children = node.children.map((c, i) => renderChild(c, i, isInline));
    return (
      <GlossDirective
        name="grid"
        attrs={{ ...node.attrs, _cell_count: String(cellCount || 0) }}
        inline={isInline}
        selfClosing={node.selfClosing}
      >
        {children}
      </GlossDirective>
    );
  }

  const children = node.children.map((c, i) => renderChild(c, i, isInline));
  return (
    <GlossDirective
      name={node.name}
      attrs={node.attrs}
      inline={isInline}
      selfClosing={node.selfClosing}
    >
      {children}
    </GlossDirective>
  );
}

interface GlossDocumentRendererProps {
  source: string;
}

export function GlossDocumentRenderer({ source }: GlossDocumentRendererProps) {
  const tree = parseGlossMdTree(source);
  const ref = useRef<HTMLDivElement | null>(null);

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
    <div ref={ref} className="gloss-document">
      {tree.map((child, i) => renderChild(child, i))}
    </div>
  );
}

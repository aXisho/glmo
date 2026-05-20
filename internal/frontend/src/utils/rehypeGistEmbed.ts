// Matches https://gist.github.com/USER/GISTID with optional ?file=... query
const GIST_URL_RE = /^https:\/\/gist\.github\.com\/([^/]+\/[^/?#]+)(\?.*)?$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isGistAnchor(node: any): { gistId: string; file: string | null } | null {
  if (node.type !== "element" || node.tagName !== "a") return null;
  const href = String(node.properties?.href ?? "");
  const match = href.match(GIST_URL_RE);
  if (!match) return null;
  const query = match[2] ? new URLSearchParams(match[2].slice(1)) : null;
  return { gistId: match[1], file: query?.get("file") ?? null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function walk(node: any, parent: any, index: number) {
  // Detect <p><a href="https://gist.github.com/USER/GISTID">...</a></p>
  // (remark-gfm auto-links bare URLs, producing exactly this structure)
  if (
    node.type === "element" &&
    node.tagName === "p" &&
    node.children.length === 1
  ) {
    const gist = isGistAnchor(node.children[0]);
    if (gist) {
      const props: Record<string, string> = { "data-gist-id": gist.gistId };
      if (gist.file) props["data-gist-file"] = gist.file;

      parent.children[index] = {
        type: "element",
        tagName: "div",
        properties: props,
        children: [],
      };
      return;
    }
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      walk(node.children[i], node, i);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rehypeGistEmbed() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (tree: any) => {
    if (tree.children) {
      for (let i = 0; i < tree.children.length; i++) {
        walk(tree.children[i], tree, i);
      }
    }
  };
}

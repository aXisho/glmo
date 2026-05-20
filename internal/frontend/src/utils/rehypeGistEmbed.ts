// Matches: https://gist.github.com/USER/GISTID.js or ...GISTID.js?file=...
const GIST_SCRIPT_RE = /^https:\/\/gist\.github\.com\/([^/]+\/[a-f0-9]+)\.js(\?.*)?$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function walk(node: any, parent: any, index: number) {
  if (
    node.type === "element" &&
    node.tagName === "script" &&
    node.properties?.src
  ) {
    const src = String(node.properties.src);
    const match = src.match(GIST_SCRIPT_RE);
    if (match) {
      const gistId = match[1];
      const query = match[2] ? new URLSearchParams(match[2].slice(1)) : null;
      const file = query?.get("file") ?? null;

      const props: Record<string, string> = { "data-gist-id": gistId };
      if (file) props["data-gist-file"] = file;

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

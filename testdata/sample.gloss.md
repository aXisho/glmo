# Gloss Markdown Sample

A reference document showcasing every directive in the Gloss Markdown standard set. `.gloss.md` files render natively on GitHub as plain Markdown and with full directives in cuemo.

> [!toc title="Contents" depth=2]

---

## Callouts

The five callouts map onto GitHub Alert types so they render natively in plain Markdown viewers.

> [!NOTE] Info
> Use this directive to highlight informational content.

> [!TIP] Tip
> You can nest **Markdown** inside any block directive.

> [!IMPORTANT] Important
> Read this before running the migration — it cannot be undone.

> [!WARNING] Warning
> This option cannot be changed after initialization.

> [!CAUTION] Danger
> Deleting this file is irreversible.

---

## `Coloured headings`{heading color=blue}

When a Markdown heading's only child is a `heading` inline directive, the heading element itself is painted with the chosen background colour. The level, slug, and TOC integration are preserved.

### `Sub-section`{heading color=green}

Pick any allowed colour: `gray`, `blue`, `green`, `yellow`, `red`, `purple`.

---

## Inline directives

This API is `Stable`{badge color=green}. The old one is `Deprecated`{badge color=red}.

Press `Ctrl + S`{kbd} to save, or `Cmd + Z`{kbd} to undo.

`Fine print`{small} text — the headline number is `1,247 users`{big}.

---

## Footnotes

Footnotes follow the GitHub-flavoured Markdown spec: a `[^id]` reference anywhere in the document is resolved against a matching `[^id]:` definition.

The constant factor still matters[^big-o], even when an algorithm is asymptotically optimal.

[^big-o]: For practical inputs, cache-hierarchy effects often dominate the asymptotic bound.

---

## Syntax highlighting

Code fences accept either a **language name** or a **file extension**.

```ts
export function parseGlossMdTree(source: string): GlossChild[] {
  const lines = source.split("\n");
  return parseLines(lines);
}
```

```go
func ParseGlossMd(src string) []GlossChild {
    return parseLines(strings.Split(src, "\n"))
}
```

```sh
go install github.com/aXisho/cuemo@latest
cuemo README.gloss.md
```

---

## Tabs

````tabs
```tab title="TypeScript"
import { parseGlossMdTree } from "./gloss/treeParser";

const tree = parseGlossMdTree(source);
```

```tab title="Go"
tree := gloss.ParseGlossMdTree(source)
```

```tab title="Python"
tree = parse_gloss_md_tree(source)
```
````

For **syntax-highlighted code inside a tab**, use one more backtick at each enclosing level:

`````tabs
````tab title="TypeScript"
```ts
import { parseGlossMdTree } from "./gloss/treeParser";
const tree = parseGlossMdTree(source);
```
````

````tab title="Go"
```go
tree := gloss.ParseGlossMdTree(source)
```
````

````tab title="Python"
```py
tree = parse_gloss_md_tree(source)
```
````
`````

---

## Details

```details title="Implementation Notes"
The parser processes directives in document order. Block directives are fenced code blocks; their info string carries the directive name and attributes.

For nested containers like `tabs`, the outer fence uses four backticks so the inner three-backtick child fences are parsed correctly (CommonMark fence-length rule).
```

---

## Cards and grids

### Card

```card title="API Reference" color=blue
Comprehensive documentation for all public functions and types.

[Read more →](#)
```

### Grid

````grid cols=3
```cell color=blue
**Fast**

Parses 10,000 lines in under 10ms.
```

```cell color=green
**Safe**

No eval, no innerHTML for user content.
```

```cell color=purple
**Extensible**

Register custom directives with a one-line config.
```
````

### Grid without dividers

````grid cols=3 border=none
```cell
**Fast**

Parses 10,000 lines in under 10ms.
```

```cell
**Safe**

No eval, no innerHTML for user content.
```

```cell
**Extensible**

Register custom directives with a one-line config.
```
````

### Framed grid (wrap in a `card`)

`````card color=blue
````grid cols=3 border=none
```cell
**Fast**
```

```cell
**Safe**
```

```cell
**Extensible**
```
````
`````

---

## Auto-fit text grids

`````grid border=none
````cell
**Left column**

Any Markdown — including lists, code, and **nested directives** — can live inside a `cell`.

- One
- Two
- Three

```ts
const x: number = 42;
```
````

````cell
**Right column**

Heights align row-wise because the layout is a real CSS grid.

> [!TIP] Nesting works
> Callouts, code blocks, and even tabbed regions can be nested in a `cell`.
````
`````

### Explicit rows × cols

````grid cols=2 rows=2
```cell
**Top-left**

Cells are placed row-first into the `cols × rows` grid.
```

```cell
**Top-right**

Each track is `1fr` so the cells share the row width.
```

```cell
**Bottom-left**
```

```cell
**Bottom-right**
```
````

---

## Steps

````steps
```step title="Install"
go install github.com/aXisho/cuemo@latest
```

```step title="Open a file"
cuemo README.gloss.md
```

```step title="Edit and save"
The browser reloads automatically on every save.
```
````

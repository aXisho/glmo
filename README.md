# cuemo

`cuemo` is a **Gloss** Markdown viewer that opens `.md` and `.gloss.md` files in a browser.

A fork of [k1LoW/mo](https://github.com/k1LoW/mo) with [Gloss Markdown](https://github.com/aXisho/glossmd) support added.

## Features

- **Gloss Markdown support** — renders `.gloss.md` directives (callouts, tabs, badges, etc.)
- GitHub-flavored Markdown (tables, task lists, footnotes, etc.)
- Syntax highlighting ([Shiki](https://shiki.style/))
- [Mermaid](https://mermaid.js.org/) diagram rendering
- LaTeX math rendering ([KaTeX](https://katex.org/))
- [GitHub Alerts](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts) (admonitions)
- Fullscreen zoom modal for images and Mermaid diagrams
- <img src="images/icons/theme-light.svg" width="16" height="16" alt="dark theme"> Dark / <img src="images/icons/theme-dark.svg" width="16" height="16" alt="light theme"> light theme
- <img src="images/icons/group.svg" width="16" height="16" alt="group"> File grouping
- <img src="images/icons/toc.svg" width="16" height="16" alt="toc"> Table of contents panel
- <img src="images/icons/view-flat.svg" width="16" height="16" alt="flat view"> Flat / <img src="images/icons/view-tree.svg" width="16" height="16" alt="tree view"> tree sidebar view with drag-and-drop reorder
- <img src="images/icons/title-filename.svg" width="16" height="16" alt="file name"> File name / <img src="images/icons/title-heading.svg" width="16" height="16" alt="heading title"> heading title sidebar display toggle (per-group)
- <img src="images/icons/search.svg" width="16" height="16" alt="search"> Full-text search across file names and content
- YAML frontmatter display (collapsible metadata block)
- MDX file support (renders as Markdown, strips `import`/`export`, escapes JSX tags)
- <img src="images/icons/font-size.svg" width="16" height="16" alt="font size"> Content font size toggle (small / medium / large / extra large)
- <img src="images/icons/width-expand.svg" width="16" height="16" alt="wide view"> Wide / <img src="images/icons/width-compress.svg" width="16" height="16" alt="narrow view"> narrow content width toggle
- <img src="images/icons/raw.svg" width="16" height="16" alt="raw"> Raw markdown view
- <img src="images/icons/copy.svg" width="16" height="16" alt="copy"> Copy content (Markdown / Text / HTML)
- <img src="images/icons/restart.svg" width="16" height="16" alt="restart"> Server restart with session preservation
- Auto session backup and restore
- Drag-and-drop file addition from the OS file manager (content is loaded in-memory; live-reload is not supported for dropped files)
- Stdin pipe support (`cat file.gloss.md | cuemo`)
- Live-reload on save (for files opened via CLI)

## Install

**manually:**

Download binary from [releases page](https://github.com/aXisho/cuemo/releases) or build from source (see below).

## Usage

``` console
$ cuemo README.md                          # Open a single file
$ cuemo README.md CHANGELOG.md docs/*.md   # Open multiple files
$ cuemo docs/                              # Open all .md / .gloss.md files in a directory
$ cuemo spec.gloss.md --target design      # Open a Gloss Markdown file in a named group
$ cat notes.gloss.md | cuemo               # Read from stdin
```

`cuemo` opens Markdown and Gloss Markdown files in a browser with live-reload. When you save a file, the browser automatically reflects the changes. `.gloss.md` files are rendered with Gloss Markdown directives (callouts, tabs, badges, etc.).

### Gloss Markdown files

`.gloss.md` files are automatically detected and rendered with Gloss Markdown support:

``` console
$ cuemo spec.gloss.md          # Renders Gloss Markdown directives
$ cuemo -w '**/*.gloss.md'     # Watch all .gloss.md files
```

### Reading from stdin

When no positional arguments are given and stdin is redirected (not a terminal), `cuemo` reads Markdown content from stdin.

``` console
$ cat notes.md | cuemo
$ some-command | cuemo --target output
$ cuemo < notes.gloss.md
```

The content is loaded in-memory with a generated name (`stdin-<hash>.md`). Piping the same content again reuses the existing entry (deduplicated by content hash).

### Single server, multiple files

By default, `cuemo` runs a single server on port `6275`. If a server is already running on the same port, subsequent `cuemo` invocations add files to the existing session instead of starting a new one.

``` console
$ cuemo README.md          # Starts a cuemo server in the background
$ cuemo CHANGELOG.md       # Adds the file to the running cuemo server
```

To run a completely separate session, use a different port:

``` console
$ cuemo draft.md -p 6276
```

![Multiple files with sidebar](images/multiple-files.png)

### Groups

Files can be organized into named groups using the `--target` (`-t`) flag. Each group gets its own URL path and sidebar.

``` console
$ cuemo spec.md --target design      # Opens at http://localhost:6275/design
$ cuemo api.md --target design       # Adds to the "design" group
$ cuemo notes.md --target notes      # Opens at http://localhost:6275/notes
```

![Group view](images/groups.png)

### Watch mode and glob patterns

`--watch` (`-w`) turns on watch mode. Directory and glob positional arguments are registered as watch patterns, matching files are opened, and new matching files are picked up automatically.

``` console
$ cuemo -w '**/*.md'                              # Watch and open all .md files recursively
$ cuemo -w '**/*.gloss.md'                        # Watch all .gloss.md files
$ cuemo -w 'docs/**/*.md' --target docs           # Watch docs/ tree in "docs" group
$ cuemo -w '*.md' 'docs/**/*.md'                  # Multiple patterns (positional)
$ cuemo -w docs/                                  # Watch docs/*.md
```

Combine with `--recursive` (`-R`) to descend into subdirectories. Short flags can be combined:

``` console
$ cuemo -w -R docs/                               # Watch docs/**/*.md
$ cuemo -wR docs/                                 # Same, short-combined
```

Without `--watch`, globs are expanded once and directory arguments open matching files without live-watching new additions:

``` console
$ cuemo docs/                                     # Open every .md directly in docs/
$ cuemo -R docs/                                  # Open every .md under docs/ (recursive)
$ cuemo 'docs/*.md'                               # Expand and open matching .md files
```

#### Removing watch patterns

`--unwatch` removes previously registered patterns. Pass glob patterns or directories as positional arguments to specify which patterns to remove. Regular file paths are not accepted (use `--close` to remove individual files from the sidebar). Files already added by a pattern remain in the sidebar.

``` console
$ cuemo --unwatch '**/*.md'                              # Stop watching a pattern (default group)
$ cuemo --unwatch docs/                                  # Stop watching docs/*.md
$ cuemo --unwatch 'docs/**/*.md' --target docs            # Stop watching in a specific group
```

With `-R`, a directory argument removes **all** registered patterns under that directory at once. For example, if `docs/*.md`, `docs/sub/*.md`, and `docs/**/*.md` are all registered, a single command removes them all:

``` console
$ cuemo --unwatch -R docs/                               # Removes docs/*.md, docs/sub/*.md, docs/**/*.md, etc.
```

Patterns are resolved to absolute paths before matching, so you can specify either a relative glob or the full path shown by `--status`.

### Sidebar view modes

The sidebar supports flat and tree view modes. Flat view shows file names only, while tree view displays the directory hierarchy.

| <img src="images/icons/view-flat.svg" height="16"> Flat | <img src="images/icons/view-tree.svg" height="16"> Tree |
|------|------|
| ![Flat view](images/sidebar-flat.png) | ![Tree view](images/sidebar-tree.png) |

### Starting and stopping

`cuemo` runs in the background by default — the command returns immediately, leaving the shell free for other work. This makes it easy to incorporate into scripts, tool chains, or LLM-driven workflows.

``` console
$ cuemo README.md
cuemo: serving at http://localhost:6275 (pid 12345)
$ # shell is available immediately
```

Use `--status` to check all running cuemo servers, and `--shutdown` to stop one:

``` console
$ cuemo --status              # Show all running cuemo servers
http://localhost:6275 (pid 12345, v0.1.0)
  default: 5 file(s)
    watching: /Users/you/project/src/**/*.md, /Users/you/project/*.md
  docs: 2 file(s)
    watching: /Users/you/project/docs/**/*.md

$ cuemo --shutdown            # Shut down the cuemo server on the default port
$ cuemo --shutdown -p 6276    # Shut down the cuemo server on a specific port
$ cuemo --restart             # Restart the cuemo server on the default port
```

If you need the cuemo server to run in the foreground (e.g. for debugging), use `--foreground`:

``` console
$ cuemo --foreground README.md
```

### Server restart

Click the <img src="images/icons/restart.svg" width="16" height="16" alt="restart"> restart button (bottom-right corner) or run `cuemo --restart` to restart the `cuemo` server process. The current session — all open files and groups — is preserved across the restart.

### Session backup and restore

`cuemo` automatically saves session state (open files and watch patterns per group) when files are added or removed. When starting a new server, the previous session is automatically restored and merged with any files specified on the command line.

``` console
$ cuemo README.md CHANGELOG.md       # Start with two files
$ cuemo --shutdown                   # Shut down the server
$ cuemo                              # Restores README.md and CHANGELOG.md
$ cuemo TODO.md                      # Restores previous session + adds TODO.md
```

Use `--close` to remove specific files from the running server:

``` console
$ cuemo --close README.md            # Close a file from the default group
$ cuemo --close docs/*.md -t docs    # Close files from the "docs" group
```

Use `--clear` to remove a saved session. If a server is running, it is automatically restarted with an empty state:

``` console
$ cuemo --clear                      # Clear saved session for the default port
$ cuemo --clear -p 6276              # Clear saved session for a specific port
```

### JSON output

Use `--json` to get structured JSON output on stdout, useful for scripting and integration with other tools.

``` console
$ cuemo --json README.md
{
  "url": "http://localhost:6275",
  "files": [
    {
      "url": "http://localhost:6275/?file=a1b2c3d4",
      "name": "README.md",
      "path": "/Users/you/project/README.md"
    }
  ]
}
```

`--status` also supports `--json`:

``` console
$ cuemo --status --json
[
  {
    "url": "http://localhost:6275",
    "status": "running",
    "pid": 12345,
    "version": "0.1.0",
    "revision": "abc1234",
    "groups": [
      {
        "name": "default",
        "files": 3,
        "patterns": ["**/*.md"]
      }
    ]
  }
]
```

### Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--target` | `-t` | `default` | Group name |
| `--port` | `-p` | `6275` | Server port |
| `--bind` | `-b` | `localhost` | Bind address (e.g. `0.0.0.0`) |
| `--open` | | | Always open browser |
| `--no-open` | | | Never open browser |
| `--status` | | | Show all running cuemo servers |
| `--watch` | `-w` | `false` | Treat directory and glob arguments as watch patterns |
| `--unwatch` | | `false` | Remove watched patterns for the given directory or glob arguments |
| `--recursive` | `-R` | `false` | Recurse into subdirectories when a directory is given |
| `--close` | | | Close files instead of opening them |
| `--shutdown` | | | Shut down the running cuemo server |
| `--restart` | | | Restart the running cuemo server |
| `--clear` | | | Clear saved session (restarts server if running) |
| `--foreground` | | | Run cuemo server in foreground |
| `--json` | | | Output structured data as JSON to stdout |
| `--dangerously-allow-remote-access` | | | Allow remote access without authentication (trusted networks only) |

> [!WARNING]
> Binding to a non-localhost address exposes cuemo to the network **without any authentication**. Remote clients can read any file accessible by the user, browse the filesystem via glob patterns, and shut down the server. A confirmation prompt is shown when `--bind` is set to a non-loopback address.

## Build

Requires Go 1.26+ and [pnpm](https://pnpm.io/).

``` console
$ make build
```

The resulting binary is named `cuemo`. To rename the binary during build:

``` console
$ go build -o cuemo .
```

## References

- [k1LoW/mo](https://github.com/k1LoW/mo): the upstream Markdown viewer this project is forked from.
- [aXisho/glossmd](https://github.com/aXisho/glossmd): Gloss Markdown specification.
- [yusukebe/gh-markdown-preview](https://github.com/yusukebe/gh-markdown-preview): GitHub CLI extension to preview Markdown.

## License

- [MIT License](LICENSE)

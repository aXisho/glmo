import { useEffect, useRef, useState } from "react";

interface GistData {
  div: string;
  stylesheet: string;
}

const loadedStylesheets = new Set<string>();

function ensureStylesheet(href: string) {
  if (loadedStylesheets.has(href)) return;
  loadedStylesheets.add(href);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

export function GistEmbed({ gistId, file }: { gistId: string; file?: string }) {
  const [data, setData] = useState<GistData | null>(null);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = file
      ? `https://gist.github.com/${gistId}.json?file=${encodeURIComponent(file)}`
      : `https://gist.github.com/${gistId}.json`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch gist");
        return res.json() as Promise<GistData>;
      })
      .then((d) => setData(d))
      .catch(() => setError(true));
  }, [gistId, file]);

  useEffect(() => {
    if (data?.stylesheet) {
      ensureStylesheet(data.stylesheet);
    }
    if (data?.div && containerRef.current) {
      containerRef.current.innerHTML = data.div;
    }
  }, [data]);

  if (error) {
    return (
      <a
        href={`https://gist.github.com/${gistId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-gh-text-link"
      >
        Gist: {gistId}
      </a>
    );
  }

  if (!data) {
    return (
      <div className="text-gh-text-secondary text-sm py-2">Loading gist...</div>
    );
  }

  return <div ref={containerRef} className="gist-embed overflow-x-auto" />;
}

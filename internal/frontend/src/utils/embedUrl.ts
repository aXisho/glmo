export const GIST_URL_RE = /^https:\/\/gist\.github\.com\/([^/]+\/[^/?#\s]+)(\?[^\s]*)?$/;

export interface GistEmbed {
  gistId: string;
  file?: string;
}

export function parseGistUrl(url: string): GistEmbed | null {
  const m = GIST_URL_RE.exec(url);
  if (!m) return null;
  const query = m[2] ? new URLSearchParams(m[2].slice(1)) : null;
  return { gistId: m[1], file: query?.get("file") ?? undefined };
}

/** Returns the iframe-embeddable src for known services, or the URL as-is for unknown ones. */
export function toEmbedSrc(url: string): string {
  const ytWatch = /^https?:\/\/(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]+)/.exec(url);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}`;
  const ytShort = /^https?:\/\/youtu\.be\/([A-Za-z0-9_-]+)/.exec(url);
  if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;
  if (/^https?:\/\/www\.figma\.com\/(file|design|proto)\//.test(url)) {
    return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
  }
  const cpPen = /^https?:\/\/codepen\.io\/([^/]+)\/pen\/([A-Za-z0-9]+)/.exec(url);
  if (cpPen) return `https://codepen.io/${cpPen[1]}/embed/${cpPen[2]}?default-tab=result`;
  return url;
}

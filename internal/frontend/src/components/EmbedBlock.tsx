import { toEmbedSrc, parseGistUrl } from "../utils/embedUrl";
import { GistEmbed } from "./GistEmbed";

export function EmbedBlock({ content }: { content: string }) {
  const url = content.trim();
  if (!/^https?:\/\//.test(url)) {
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

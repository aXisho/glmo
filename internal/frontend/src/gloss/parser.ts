// Shared utilities used by treeParser and the directive components.

export const ALLOWED_COLORS = ["gray", "blue", "green", "yellow", "red", "purple"] as const;

export const SAFE_URL_PATTERN = /^(https?:\/\/|\.\.?\/|\/[^/]|#)/;

/**
 * Parse a `key=value key2="value with spaces" flag` attribute string.
 * Quoted values support `\"`, `\\`, and `\n` escape sequences.
 */
export function parseAttrs(attrsString: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!attrsString.trim()) return result;

  const re = /([a-z][a-z0-9_-]*)(?:=(?:"((?:[^"\\]|\\.)*)"|(\S*)))?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attrsString)) !== null) {
    const key = match[1].toLowerCase();
    let value: string;
    if (match[2] !== undefined) {
      value = match[2]
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/\\n/g, "\n");
    } else if (match[3] !== undefined) {
      value = match[3];
    } else {
      value = "true";
    }
    result[key] = value;
  }
  return result;
}

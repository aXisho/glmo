export const TRANSIENT_TARGET_CLASS = "mo-target";

export function getHashTarget(href: string | undefined): HTMLElement | null {
  if (!href?.startsWith("#")) {
    return null;
  }
  const rawId = href.slice(1);
  if (!rawId) {
    return null;
  }
  const ids = [rawId];
  try {
    const decoded = decodeURIComponent(rawId);
    if (decoded !== rawId) {
      ids.push(decoded);
    }
  } catch {
    // Keep the raw id when the fragment is not valid URI-encoded text.
  }
  for (const id of ids) {
    const target = document.getElementById(id);
    if (target) {
      return target;
    }
  }
  return null;
}

export function clearTransientTargets() {
  document
    .querySelectorAll(`.${TRANSIENT_TARGET_CLASS}`)
    .forEach((el) => el.classList.remove(TRANSIENT_TARGET_CLASS));

  // github-markdown-css highlights footnotes with `li:target`. If a previous
  // native hash navigation created that state, remove only footnote hashes when
  // the user clicks elsewhere.
  if (window.location.hash && document.querySelector(".markdown-body .footnotes li:target")) {
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }
}

export function scrollToAndHighlightHashTarget(href: string | undefined): boolean {
  const target = getHashTarget(href);
  if (!target) {
    return false;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({
    behavior: reduced ? "auto" : "smooth",
    block: "start",
  });
  clearTransientTargets();
  target.classList.add(TRANSIENT_TARGET_CLASS);
  return true;
}

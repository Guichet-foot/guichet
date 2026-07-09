/**
 * Prints a thermal ticket without opening a visible new tab.
 *
 * Opens a tiny named popup window off-screen (not a tab — no toolbar, no tab bar entry).
 * The popup loads the print URL, auto-prints, then closes itself via afterprint.
 * If the popup is blocked by the browser, falls back to a normal new tab.
 */
export function printViaFrame(url: string): void {
  // Fullscreen popup — not a tab (no address bar, no tab strip).
  // Must be called synchronously within the user gesture (click) so the browser allows it.
  const w = window.screen.availWidth;
  const h = window.screen.availHeight;

  const features = [
    `width=${w}`,
    `height=${h}`,
    "left=0",
    "top=0",
    "toolbar=no",
    "location=no",
    "menubar=no",
    "scrollbars=yes",
    "status=no",
    "resizable=yes",
  ].join(",");

  const popup = window.open(url, "gf-print-popup", features);

  if (!popup) {
    // Browser blocked the popup (strict settings) — fall back to new tab
    window.open(url, "_blank");
  }
}

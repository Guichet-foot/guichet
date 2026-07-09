/**
 * Prints a thermal ticket without opening a visible new tab.
 *
 * Opens a tiny named popup window off-screen (not a tab — no toolbar, no tab bar entry).
 * The popup loads the print URL, auto-prints, then closes itself via afterprint.
 * If the popup is blocked by the browser, falls back to a normal new tab.
 */
export function printViaFrame(url: string): void {
  // Centered popup — not a tab (no address bar, no tab strip).
  // Must be called synchronously within the user gesture (click) so the browser allows it.
  const w = 480;
  const h = 750;
  const left = Math.round((window.screen.width - w) / 2);
  const top = Math.round((window.screen.height - h) / 2);

  const features = [
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    "toolbar=no",
    "location=no",
    "menubar=no",
    "scrollbars=no",
    "status=no",
    "resizable=yes",
  ].join(",");

  const popup = window.open(url, "gf-print-popup", features);

  if (!popup) {
    // Browser blocked the popup (strict settings) — fall back to new tab
    window.open(url, "_blank");
  }
}

/**
 * Prints a thermal ticket without opening a visible new tab.
 *
 * Opens a tiny named popup window off-screen (not a tab — no toolbar, no tab bar entry).
 * The popup loads the print URL, auto-prints, then closes itself via afterprint.
 * If the popup is blocked by the browser, falls back to a normal new tab.
 */
export function printViaFrame(url: string): void {
  // Tiny off-screen popup — not a tab, no toolbar, invisible to the user.
  // Must be called synchronously within the user gesture (click) so the browser allows it.
  const features = [
    "width=300",
    "height=600",
    "left=-2000",
    "top=-2000",
    "toolbar=no",
    "location=no",
    "menubar=no",
    "scrollbars=no",
    "status=no",
    "resizable=no",
  ].join(",");

  const popup = window.open(url, "gf-print-popup", features);

  if (!popup) {
    // Browser blocked the popup (strict settings) — fall back to new tab
    window.open(url, "_blank");
  }
}

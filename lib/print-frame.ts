/**
 * Prints a thermal ticket URL without opening a new browser tab.
 *
 * Creates a hidden off-screen iframe sized to the ticket's actual width so that
 * getBoundingClientRect() inside the iframe returns the correct content height.
 * The iframe's own window.onload script measures height, injects @page, then
 * calls window.print() — Chrome prints the iframe content (same-origin) and
 * shows the system print dialog in the current tab.
 */
export function printViaFrame(url: string): void {
  // Remove any leftover frame from a previous print
  document.getElementById("gf-print-frame")?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "gf-print-frame";

  // Off-screen but fully rendered so the ticket layout and getBoundingClientRect work.
  // Width must match the ticket's CSS width (72mm≈273px, 58mm≈220px at 96dpi).
  const is58 = url.includes("fmt=58");
  const widthPx = is58 ? 220 : 273;

  iframe.style.cssText = [
    "position:fixed",
    "left:-9999px",
    "top:0",
    `width:${widthPx}px`,
    "height:900px",
    "border:none",
    "background:white",
    "visibility:visible",
  ].join(";");

  document.body.appendChild(iframe);
  iframe.src = url;

  // Clean up after the print dialog closes
  iframe.addEventListener(
    "load",
    function () {
      try {
        iframe.contentWindow?.addEventListener(
          "afterprint",
          function () {
            setTimeout(() => document.getElementById("gf-print-frame")?.remove(), 500);
          },
          { once: true }
        );
      } catch {
        // Ignore in case of unexpected cross-origin scenario
      }
    },
    { once: true }
  );

  // Safety fallback: remove after 2 minutes if afterprint never fires
  setTimeout(() => document.getElementById("gf-print-frame")?.remove(), 120_000);
}

/**
 * Prints a thermal ticket URL without opening a new browser tab.
 *
 * Flow:
 * 1. Creates a hidden off-screen iframe sized to the ticket's actual CSS width
 *    so getBoundingClientRect() inside the iframe returns the correct height.
 * 2. The iframe's window.onload injects the exact @page size then sends
 *    postMessage({ type: 'gf-print-ready' }) instead of calling window.print().
 * 3. The parent receives the message and calls iframe.contentWindow.print(),
 *    which opens the system print dialog in the current tab (not a new tab).
 */
export function printViaFrame(url: string): void {
  // Remove any leftover frame from a previous print
  document.getElementById("gf-print-frame")?.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "gf-print-frame";

  // Off-screen but fully rendered so ticket layout and getBoundingClientRect work.
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
  ].join(";");

  document.body.appendChild(iframe);

  function cleanup() {
    document.getElementById("gf-print-frame")?.remove();
  }

  // Listen for the ready signal from the iframe's window.onload script
  function onMessage(e: MessageEvent) {
    if (e.data?.type !== "gf-print-ready") return;
    window.removeEventListener("message", onMessage);

    const win = iframe.contentWindow;
    if (!win) { cleanup(); return; }

    // Listen for afterprint on the iframe window before triggering print
    win.addEventListener("afterprint", function () {
      setTimeout(cleanup, 500);
    }, { once: true });

    // Parent calls print on the iframe — opens the dialog in the current tab
    win.print();
  }

  window.addEventListener("message", onMessage);

  iframe.src = url;

  // Safety fallback: remove after 2 minutes if something hangs
  setTimeout(cleanup, 120_000);
}

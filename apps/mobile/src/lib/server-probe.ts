/**
 * The fetch the server address screen checks a server with. React Native's fetch turns every failed request into
 * "Network request failed", so the reason (no such host, refused, timed out, a certificate the phone doesn't trust)
 * never reaches the screen, and `checkServer` can't tell a certificate from the rest. On a failure this asks once
 * more through XMLHttpRequest, whose response text is the platform's own error message, and fails with that text.
 */

/** Why the last check failed, in the platform's words (with the address and how long it took), or null. */
let lastDetail: string | null = null;
export const lastProbeDetail = () => lastDetail;

/** How long the second ask waits before it reports a time-out of its own. */
const REASON_TIMEOUT_MS = 15_000;

function platformReason(url: string): Promise<string> {
  return new Promise((resolve) => {
    const started = Date.now();
    const took = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.setRequestHeader("accept", "application/json");
    xhr.timeout = REASON_TIMEOUT_MS;
    // It answered this time: the first ask failed on the way (or too slowly), not for good.
    xhr.onload = () => resolve(`answered HTTP ${xhr.status} on a second try, after ${took()}`);
    xhr.ontimeout = () => resolve(`no answer within ${REASON_TIMEOUT_MS / 1000} s`);
    xhr.onerror = () => {
      let text = "";
      try {
        text = String(xhr.responseText ?? "");
      } catch {
        // No text to read: the generic line below.
      }
      resolve(`${text.trim() || "network error"} (${took()})`);
    };
    xhr.send();
  });
}

export async function probeFetch(input: string, init: RequestInit): Promise<Response> {
  const started = Date.now();
  try {
    const res = await fetch(input, init);
    lastDetail = res.ok ? null : `${input}: HTTP ${res.status}`;
    return res;
  } catch (error) {
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const reason = init.signal?.aborted
      ? `no answer within ${seconds} s`
      : await platformReason(input).catch(() => (error instanceof Error ? error.message : String(error)));
    lastDetail = `${input}: ${reason}`;
    throw new Error(reason);
  }
}

export const resetProbeDetail = () => {
  lastDetail = null;
};

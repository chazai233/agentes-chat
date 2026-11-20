/**
 * The API client's fetch. The app's global fetch is Expo's (expo/fetch, installed by `expo`'s runtime), whose
 * FormData refuses React Native's `{ uri, name, type }` file part ("Unsupported FormDataPart implementation") and
 * percent-encodes a part's file name. Every upload with such a part (a photo or file in a conversation, the Drive's
 * "Enviar arquivo") goes through React Native's own XMLHttpRequest instead, which streams the file from its uri and
 * sends its name as it is; everything else stays on fetch.
 */
export const uploadAwareFetch: typeof fetch = (input, init) => {
  const body = init?.body;
  if (body instanceof FormData && hasUriPart(body)) return xhrFetch(String(input), init ?? {});
  return fetch(input, init);
};

interface RnFormData {
  getParts?: () => { uri?: unknown }[];
}

/** React Native's FormData keeps its parts readable; one with a `uri` is a file to stream. */
export function hasUriPart(form: FormData): boolean {
  const parts = (form as unknown as RnFormData).getParts?.() ?? [];
  return parts.some((p) => typeof p?.uri === "string");
}

function xhrFetch(url: string, init: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(init.method ?? "POST", url);
    new Headers(init.headers).forEach((value, name) => {
      // The multipart boundary is React Native's to set.
      if (name.toLowerCase() !== "content-type") xhr.setRequestHeader(name, value);
    });
    xhr.withCredentials = false;
    const signal = init.signal;
    const abort = () => xhr.abort();
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", abort, { once: true });
    }
    const done = () => signal?.removeEventListener("abort", abort);
    xhr.onload = () => {
      done();
      const headers = new Headers();
      for (const line of xhr
        .getAllResponseHeaders()
        .trim()
        .split(/[\r\n]+/)) {
        const at = line.indexOf(":");
        if (at > 0) headers.append(line.slice(0, at).trim(), line.slice(at + 1).trim());
      }
      // 204 and 304 may carry no body.
      const text = xhr.status === 204 || xhr.status === 304 ? null : xhr.responseText;
      resolve(new Response(text, { status: xhr.status, statusText: xhr.statusText, headers }));
    };
    xhr.onerror = () => {
      done();
      reject(new TypeError("Network request failed"));
    };
    xhr.ontimeout = xhr.onerror;
    xhr.onabort = () => {
      done();
      reject(new DOMException("Aborted", "AbortError"));
    };
    xhr.send(init.body as FormData);
  });
}

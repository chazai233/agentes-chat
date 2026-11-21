/** A file on the phone (a picked photo, video or document, one shared from another app) on its way up. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * A local file as a form part: React Native's `{ uri, name, type }`. The app's global `fetch` is Expo's, whose
 * FormData refuses that part ("Unsupported FormDataPart implementation") and would percent-encode a name like
 * 施工日志.pdf; the API client's `uploadAwareFetch` (`lib/upload-fetch.ts`) sends any form with such a part through React
 * Native's own XMLHttpRequest instead, which streams the file from its uri and keeps its name as it is.
 */
export function uploadPart(file: LocalFile): globalThis.File {
  return { uri: file.uri, name: file.name, type: file.type } as unknown as globalThis.File;
}

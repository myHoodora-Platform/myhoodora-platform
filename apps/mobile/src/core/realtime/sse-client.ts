import { createSseParser, type SseEvent } from "./sse-parser";

/**
 * A text/event-stream read with XMLHttpRequest, whose progress events hand over the response as it
 * arrives (React Native's fetch can't stream, and EventSource can't send the Authorization header the
 * API needs: contract §19). Returns a function that closes it.
 */
/** XHR keeps the whole response: past this, close and reconnect so a long session doesn't grow without end. */
const MAX_BUFFER_CHARS = 512 * 1024;

export function openEventStream(url: string, token: string, handlers: { onEvent: (e: SseEvent) => void; onOpen: () => void; onClose: (failed: boolean) => void }): () => void {
  const xhr = new XMLHttpRequest();
  const parse = createSseParser(handlers.onEvent);
  let seen = 0;
  let opened = false;
  let closed = false;
  const finish = (failed: boolean) => {
    if (closed) return;
    closed = true;
    handlers.onClose(failed);
  };
  xhr.onprogress = () => {
    const text = xhr.responseText;
    if (text.length > seen) {
      parse(text.slice(seen));
      seen = text.length;
    }
    if (seen > MAX_BUFFER_CHARS) {
      xhr.abort();
      finish(false);
    }
  };
  xhr.onreadystatechange = () => {
    if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED && xhr.status === 200 && !opened) {
      opened = true;
      handlers.onOpen();
    }
    if (xhr.readyState === XMLHttpRequest.DONE) finish(xhr.status !== 200 || !opened);
  };
  xhr.onerror = () => finish(true);
  xhr.open("GET", url);
  xhr.setRequestHeader("Authorization", `Bearer ${token}`);
  xhr.setRequestHeader("Accept", "text/event-stream");
  xhr.setRequestHeader("Cache-Control", "no-cache");
  xhr.send();
  return () => {
    closed = true;
    xhr.abort();
  };
}

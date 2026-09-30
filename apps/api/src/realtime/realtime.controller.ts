import { Controller, Header, type MessageEvent, Sse } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { interval, map, merge, of, type Observable } from "rxjs";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { RealtimeService } from "./realtime.service";

/** Keeps proxies (and Render) from closing a quiet connection. */
const HEARTBEAT_MS = 25_000;

@ApiTags("realtime")
@ApiBearerAuth("firebase-jwt")
@Controller("realtime")
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * One long-lived Server-Sent Events stream per tab. Events are id-only
   * hints; the client refetches through the normal endpoints.
   */
  @Sse("stream")
  @SkipThrottle()
  @Header("Cache-Control", "no-cache, no-transform")
  @Header("X-Accel-Buffering", "no")
  @ApiOperation({ summary: "Live updates for the signed-in person (text/event-stream)" })
  stream(@CurrentViewer() viewer: Viewer): Observable<MessageEvent> {
    return merge(
      of({ type: "ready", data: { at: new Date().toISOString() } }),
      this.realtime.streamFor(viewer).pipe(map((e) => ({ type: e.type, data: e }))),
      interval(HEARTBEAT_MS).pipe(map(() => ({ type: "ping", data: {} }))),
    );
  }
}

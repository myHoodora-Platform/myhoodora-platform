import { Controller, Header, type MessageEvent, Sse } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from "@nestjs/swagger";
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
  @ApiOperation({
    summary: "Live updates for the signed-in person (text/event-stream)",
    description:
      "Stays open. Sends `ready` on connect, `ping` every 25 s, then one event per change, named by `type`. " +
      "Events carry ids only: refetch through the normal endpoints. Swagger UI can't display a stream; use `curl -N` or the web app.",
  })
  @ApiProduces("text/event-stream")
  @ApiOkResponse({
    description: "An endless event stream",
    content: {
      "text/event-stream": {
        schema: { type: "string" },
        example: 'event: ready\ndata: {"at":"2026-09-30T10:00:00.000Z"}\n\nevent: post.created\ndata: {"type":"post.created","id":"6700000000000000000000dd","at":"2026-09-30T10:00:05.000Z"}\n\n',
      },
    },
  })
  stream(@CurrentViewer() viewer: Viewer): Observable<MessageEvent> {
    return merge(
      of({ type: "ready", data: { at: new Date().toISOString() } }),
      this.realtime.streamFor(viewer).pipe(map((e) => ({ type: e.type, data: e }))),
      interval(HEARTBEAT_MS).pipe(map(() => ({ type: "ping", data: {} }))),
    );
  }
}

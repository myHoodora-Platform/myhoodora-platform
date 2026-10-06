import { BadRequestException, Body, Controller, Delete, ForbiddenException, HttpCode, HttpStatus, Param, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsIn, IsInt, IsString, IsUrl, MaxLength, Min } from "class-validator";
import { CurrentViewer, type Viewer } from "../shared/auth/viewer";
import { ApiNotFound, ApiStandardErrors, ErrorResponse } from "../shared/http/api-docs";
import { ParseObjectIdPipe } from "../shared/http/pagination";
import { MEDIA_PURPOSES, type MediaPurpose } from "./schemas/media-asset.schema";
import { MAX_UPLOAD_BYTES, StorageService, type UploadedFileInput } from "./storage.service";
import { removeTemp, UPLOAD_TMP_DIR } from "./temp-files";

/**
 * Who may store a file depends on what it is for, and that arrives in the body, so it is checked
 * here and not with @Can(). Media for content (a post, a listing, a group) is for people who may
 * post: verified, active neighbours. A profile photo is for anyone with an account, because
 * onboarding asks for one before the address is verified.
 */
function assertMayUpload(viewer: Viewer, purpose: MediaPurpose): void {
  if (viewer.capabilities.includes(purpose === "avatar" ? "profile.manage" : "content.create")) return;
  // The same words CapabilityGuard uses for content.create, so the app's "verify first" prompt works here too.
  throw new ForbiddenException(viewer.accountStatus !== "active" ? "Your account is restricted from posting right now." : "Verify your address to join your neighbourhood first.");
}

export class DirectUploadDto {
  @IsIn(MEDIA_PURPOSES) purpose!: MediaPurpose;
  /** The file's type, e.g. video/mp4. @example "video/mp4" */
  @IsString() @MaxLength(100) mimetype!: string;
  /** Size in bytes (checked again against what the provider stored). @example 48213344 */
  @IsInt() @Min(1) size!: number;
}

export class ImportMediaDto {
  /** A direct https link to a photo or video file (redirects are followed). @example "https://videos.pexels.com/video-files/18156302/18156302-hd_1080_1920_25fps.mp4" */
  @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(2000) url!: string;
  @IsIn(MEDIA_PURPOSES) purpose!: MediaPurpose;
}

export class UploadMediaDto {
  /** Where the file will be used; decides the folder and whether video is allowed. */
  @IsIn(MEDIA_PURPOSES) purpose!: MediaPurpose;
}

@ApiTags("media")
@ApiBearerAuth("firebase-jwt")
@ApiStandardErrors()
@Controller("media")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post()
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  // Streams to a temp file on disk (never the whole file in memory); removed after it's stored.
  @UseInterceptors(FileInterceptor("file", { dest: UPLOAD_TMP_DIR, limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } }))
  @ApiOperation({
    summary: "Upload a photo or video",
    description:
      "Multipart form: `file` plus `purpose` (post | listing | group | avatar). Photos (JPG, PNG, WebP, GIF, HEIC) up to 10 MB; videos (MP4, MOV, WebM) up to 100 MB and 60 s, posts only. The type is read from the file's bytes, not its name. The file streams to disk and then to storage (videos in chunks), so it's never held in memory. Returns the HTTPS `url` to put in `mediaUrls`, `photos` or `photoURL`, and an `id` for `DELETE /media/:id`. 503 if the server is busy with other uploads; retry shortly.",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "purpose"],
      properties: { file: { type: "string", format: "binary" }, purpose: { type: "string", enum: [...MEDIA_PURPOSES] } },
    },
  })
  @ApiCreatedResponse({
    description: "Stored",
    schema: {
      example: {
        id: "66f1a2b3c4d5e6f7a8b9c0d2",
        url: "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/myhoodora/production/post/abc123",
        resourceType: "image",
        format: "jpg",
        bytes: 482113,
        width: 1920,
        height: 1440,
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: "Uploads are switched off or the storage provider is down", type: ErrorResponse })
  async upload(@CurrentViewer() viewer: Viewer, @UploadedFile() file: UploadedFileInput | undefined, @Body() body: UploadMediaDto) {
    if (!file) throw new BadRequestException("Choose a file to upload.");
    try {
      assertMayUpload(viewer, body.purpose);
      return await this.storage.upload(viewer.uid, file, body.purpose);
    } finally {
      await removeTemp(file.path);
    }
  }

  @Post("direct")
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Start a direct upload (large videos go straight to storage)",
    description:
      "Step 1 of 2. For videos (posts only, up to 100 MB and 60 s) returns `{ id, upload: { url, fields, fileField, expiresAt } }`: POST a multipart form to `upload.url` with every field in `fields` plus the file under `fileField`, then call `POST /media/:id/complete`. The ticket is signed for one file and expires in an hour. Returns `{ id: null, upload: null }` for photos, or when the storage provider doesn't support direct uploads; use `POST /media` then.",
  })
  @ApiCreatedResponse({
    description: "Ticket (or nulls: use POST /media)",
    schema: {
      example: {
        id: "66f1a2b3c4d5e6f7a8b9c0d3",
        upload: {
          url: "https://api.cloudinary.com/v1_1/demo/video/upload",
          fields: { timestamp: "1790805433", public_id: "myhoodora/production/post/Qm9vbXNoYWthbGFrYQ", eager: "c_limit,q_auto,w_1280/mp4", eager_async: "true", api_key: "123456789012345", signature: "…" },
          fileField: "file",
          expiresAt: "2026-09-30T22:37:13.000Z",
        },
      },
    },
  })
  direct(@CurrentViewer() viewer: Viewer, @Body() body: DirectUploadDto) {
    assertMayUpload(viewer, body.purpose);
    return this.storage.createDirectUpload(viewer.uid, body);
  }

  @Post(":id/complete")
  @HttpCode(HttpStatus.OK)
  @Throttle({ medium: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Finish a direct upload",
    description:
      "Step 2 of 2. The API reads back what storage actually received and enforces the limits (≤ 100 MB, ≤ 60 s; otherwise the file is deleted and 400/413). Returns the same shape as `POST /media`. Safe to call twice.",
  })
  @ApiOkResponse({ description: "Stored (same shape as POST /media)" })
  @ApiNotFound("Upload")
  complete(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    return this.storage.completeDirectUpload(viewer.uid, id);
  }

  @Post("import")
  @Throttle({ medium: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: "Add a photo or video from a link",
    description:
      "The API downloads the file (https only, redirects followed and re-checked, private networks refused, 50 MB / 30 s cap) and stores it exactly like `POST /media`, with the same type, size and 60-second video rules. Returns the same shape.",
  })
  @ApiCreatedResponse({ description: "Stored (same shape as POST /media)" })
  import(@CurrentViewer() viewer: Viewer, @Body() body: ImportMediaDto) {
    assertMayUpload(viewer, body.purpose);
    return this.storage.importFromUrl(viewer.uid, body.url, body.purpose);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a file you uploaded" })
  @ApiNoContentResponse({ description: "Deleted" })
  @ApiNotFound("File")
  async remove(@CurrentViewer() viewer: Viewer, @Param("id", ParseObjectIdPipe) id: string) {
    await this.storage.delete(viewer.uid, id);
  }
}

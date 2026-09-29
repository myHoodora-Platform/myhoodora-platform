import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { Error as MongooseError } from "mongoose";

/**
 * One error shape for the whole API (contract §0): `{ message }` + correct
 * status. Validation messages are human and shown verbatim; everything else
 * gets a generic message. Internals are logged server-side, never returned.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Http");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const { status, message } = this.map(exception);

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.route?.path ?? req.path} → ${status}`, exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(status).json({ statusCode: status, message });
  }

  private map(e: unknown): { status: number; message: string | string[] } {
    if (e instanceof HttpException) {
      const body = e.getResponse();
      const message = typeof body === "string" ? body : ((body as { message?: string | string[] }).message ?? e.message);
      return { status: e.getStatus(), message };
    }
    if (e instanceof MongooseError.CastError) return { status: HttpStatus.BAD_REQUEST, message: `Invalid ${e.path}.` };
    if (e instanceof MongooseError.ValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: Object.values(e.errors).map((x) => x.message) };
    }
    if (typeof e === "object" && e !== null && (e as { code?: number }).code === 11000) {
      return { status: HttpStatus.CONFLICT, message: "That already exists." };
    }
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: "Something went wrong on our side." };
  }
}

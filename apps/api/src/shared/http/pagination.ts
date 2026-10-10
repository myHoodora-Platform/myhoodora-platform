import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import { IsDateString, IsInt, IsMongoId, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { isValidObjectId } from "mongoose";

/** Feed-style cursor paging (contract §1: `?before=<createdAt>`), with legacy `skip`. */
/** Most items a thread returns at once, and how many it returns when the client doesn't say. */
export const THREAD_PAGE_MAX = 500;

/**
 * Paging back through a thread (messages, comments). No parameters: the newest page. `before`: the
 * page that ends just before that item, for "load earlier". Pages are oldest-first, like the thread.
 */
export class ThreadPageQuery {
  /** The id of the oldest item you already have. */
  @IsOptional()
  @IsMongoId()
  before?: string;

  /** 1 to 500. Default 500. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(THREAD_PAGE_MAX)
  limit?: number;
}

export class CursorQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @IsOptional()
  @IsDateString()
  before?: string;

  /** Legacy offset paging; kept for the live web client. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  skip?: number;
}

/** Admin list paging (contract §13.0). */
export class PageQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  /** "field:asc" | "field:desc" — each endpoint whitelists its fields. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sort?: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Escape user input before using it in a case-insensitive regex search. */
export function searchRegex(q?: string): RegExp | undefined {
  if (!q) return undefined;
  return new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

/** Parse `field:dir` against an allow-list into a Mongo sort. */
export function parseSort(sort: string | undefined, allowed: Record<string, string>, fallback: Record<string, 1 | -1>): Record<string, 1 | -1> {
  if (!sort) return fallback;
  const [field, dir] = sort.split(":");
  const path = field ? allowed[field] : undefined;
  if (!path) return fallback;
  return { [path]: dir === "asc" ? 1 : -1 };
}

/** 400 for malformed ids instead of a Mongo CastError. */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!isValidObjectId(value)) throw new BadRequestException("That id isn't valid.");
    return value;
  }
}

import { randomUUID } from "node:crypto";

export const DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE = 100;

export interface ExistingBookHashAlias {
  source_hash: string;
  book_id: string;
}

export interface ImportLogContext {
  requestId: string;
  stage?: string | null;
  userId?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  bucket?: string | null;
  filePath?: string | null;
}

interface AliasLookupResult {
  data: ExistingBookHashAlias[] | null;
  error: unknown;
}

interface AliasLookupServiceClient {
  from: (table: string) => unknown;
}

interface ImportFailurePayloadOptions {
  requestId: string;
  stage: string;
  publicMessage: string;
  details?: Record<string, unknown>;
}

const RESPONSE_DETAIL_BLOCKLIST = new Set([
  "cause",
  "error",
  "exception",
  "internalError",
  "normalizedError",
  "rawError",
  "stack",
]);

export function createImportRequestId(): string {
  return randomUUID();
}

export function logImportEvent(
  level: "info" | "warn" | "error",
  event: string,
  context: ImportLogContext,
  details?: Record<string, unknown>,
) {
  const payload = {
    ...context,
    ...(details ?? {}),
  };

  const message = `[import-sqlite] ${event} ${stringifyLogValue(payload)}`;

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.info(message);
}

export function normalizeImportError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const normalized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };

    const errorRecord = error as unknown as Record<string, unknown>;

    for (const key of Object.keys(errorRecord)) {
      normalized[key] = serializeLogValue(errorRecord[key]);
    }

    if ("cause" in error) {
      normalized.cause = serializeLogValue(
        (error as Error & { cause?: unknown }).cause,
      );
    }

    return normalized;
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
      stack: null,
    };
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const record = error as Record<string, unknown>;
    return {
      ...serializeRecord(record),
      name:
        typeof record.name === "string" && record.name.length > 0
          ? record.name
          : "Error",
      message: record.message,
      stack: typeof record.stack === "string" ? record.stack : null,
    };
  }

  return {
    name: "Error",
    message: String(error),
    stack: null,
    value: serializeLogValue(error),
  };
}

export function buildImportFailurePayload({
  requestId,
  stage,
  publicMessage,
  details,
}: ImportFailurePayloadOptions): {
  error: string;
  details: Record<string, unknown>;
} {
  return {
    error: `${publicMessage} Reference request ${requestId}.`,
    details: {
      requestId,
      stage,
      ...sanitizeResponseDetails(details),
    },
  };
}

export async function getExistingAliasesBatched(
  serviceClient: AliasLookupServiceClient,
  userId: string,
  sourceHashes: string[],
  chunkSize = DEFAULT_SOURCE_HASH_LOOKUP_CHUNK_SIZE,
): Promise<{
  data: ExistingBookHashAlias[];
  error: unknown;
  chunkCount: number;
  chunkSizes: number[];
}> {
  if (sourceHashes.length === 0) {
    return {
      data: [],
      error: null,
      chunkCount: 0,
      chunkSizes: [],
    };
  }

  const chunkedHashes = chunkArray(sourceHashes, chunkSize);
  const chunkSizes = chunkedHashes.map((chunk) => chunk.length);
  const aliases: ExistingBookHashAlias[] = [];

  for (const chunk of chunkedHashes) {
    const query = serviceClient.from("book_source_hashes") as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          in: (
            lookupColumn: string,
            values: string[],
          ) => PromiseLike<AliasLookupResult> | AliasLookupResult;
        };
      };
    };
    const { data, error } = (await query
      .select("source_hash, book_id")
      .eq("user_id", userId)
      .in("source_hash", chunk)) as AliasLookupResult;

    if (error) {
      return {
        data: aliases,
        error,
        chunkCount: chunkedHashes.length,
        chunkSizes,
      };
    }

    aliases.push(...((data ?? []) as ExistingBookHashAlias[]));
  }

  return {
    data: aliases,
    error: null,
    chunkCount: chunkedHashes.length,
    chunkSizes,
  };
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const normalizedChunkSize = Math.max(1, Math.floor(chunkSize));
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }

  return chunks;
}

function sanitizeResponseDetails(
  details: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!details) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    if (RESPONSE_DETAIL_BLOCKLIST.has(key)) {
      continue;
    }

    sanitized[key] = serializeLogValue(value);
  }

  return sanitized;
}

function serializeRecord(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    serialized[key] = serializeLogValue(value);
  }

  return serialized;
}

function stringifyLogValue(value: unknown): string {
  return JSON.stringify(serializeLogValue(value));
}

function serializeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
): unknown {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "undefined") {
    return null;
  }

  if (value instanceof Error) {
    return normalizeImportError(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeLogValue(entry, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const serialized: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value)) {
      serialized[key] = serializeLogValue(entry, seen);
    }

    return serialized;
  }

  return String(value);
}

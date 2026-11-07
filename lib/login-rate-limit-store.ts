export type RateLimitBucketResult = { count: number; retryAfterSeconds: number }
type RawDatabase = { $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> }

/** Atomic PostgreSQL fixed-window increment, usable across application replicas. */
export async function incrementRateLimitBucket(
  database: RawDatabase,
  key: string,
  windowSeconds: number,
): Promise<RateLimitBucketResult> {
  const rows = await database.$queryRaw<Array<RateLimitBucketResult>>`
    INSERT INTO "LoginRateLimit" ("key", "windowStartedAt", "count", "updatedAt")
    VALUES (${key}, clock_timestamp()::timestamp, 1, clock_timestamp()::timestamp)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "LoginRateLimit"."windowStartedAt" <= clock_timestamp()::timestamp - (${windowSeconds}::double precision * INTERVAL '1 second') THEN 1
        ELSE "LoginRateLimit"."count" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "LoginRateLimit"."windowStartedAt" <= clock_timestamp()::timestamp - (${windowSeconds}::double precision * INTERVAL '1 second') THEN clock_timestamp()::timestamp
        ELSE "LoginRateLimit"."windowStartedAt"
      END,
      "updatedAt" = clock_timestamp()::timestamp
    RETURNING
      "count",
      LEAST(${windowSeconds}, GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("windowStartedAt" + (${windowSeconds}::double precision * INTERVAL '1 second') - clock_timestamp()::timestamp)))))::int AS "retryAfterSeconds"
  `
  if (!rows[0]) throw new Error('Rate-limit bucket update returned no result.')
  return { count: Number(rows[0].count), retryAfterSeconds: Math.max(1, Number(rows[0].retryAfterSeconds)) }
}

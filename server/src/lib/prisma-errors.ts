import { Prisma } from '@prisma/client';

/**
 * When `err` is a unique-constraint violation (Prisma P2002), the names it reports for the
 * violated constraint: column names and/or the index name, unquoted. Null for any other error.
 *
 * Prisma reports them differently depending on the driver adapter (`meta.target`, or
 * `meta.driverAdapterError.cause.constraint.fields` / `.index`), so every form is collected.
 */
export function uniqueViolationTargets(err: unknown): string[] | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return null;

  const meta = (err.meta ?? {}) as {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { fields?: unknown; index?: unknown } } };
  };
  const constraint = meta.driverAdapterError?.cause?.constraint;
  const names = [meta.target, constraint?.fields, constraint?.index].flat();
  return names.filter((name): name is string => typeof name === 'string').map((name) => name.replace(/"/g, ''));
}

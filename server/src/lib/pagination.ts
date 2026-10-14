export interface PaginationParams {
  limit: number;
  before?: string;
  after?: string;
}

export function parsePaginationParams(query: Record<string, any>): PaginationParams {
  const limitParam = parseInt(query.limit as string, 10);
  const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 100);
  const before = typeof query.before === 'string' && query.before ? query.before : undefined;
  const after = typeof query.after === 'string' && query.after ? query.after : undefined;

  return { limit, before, after };
}

export interface FetchPaginatedMessagesOptions<T> {
  chatIdKey: 'directChatId' | 'roomId';
  chatId: string;
  limit: number;
  before?: string;
  after?: string;
  findUniqueMessage: (id: string) => Promise<{ id: string; createdAt: Date; [key: string]: any } | null>;
  findManyMessages: (args: {
    where: any;
    orderBy: { createdAt: 'asc' | 'desc' };
    take: number;
  }) => Promise<T[]>;
}

export interface PaginatedResult<T> {
  messages: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function fetchPaginatedMessages<T extends { id: string; createdAt: Date }>(
  options: FetchPaginatedMessagesOptions<T>
): Promise<PaginatedResult<T>> {
  const { chatIdKey, chatId, limit, before, after, findUniqueMessage, findManyMessages } = options;

  // Catch-up sync: fetch messages newer than `after` message in chronological order (createdAt ASC)
  if (after) {
    const afterMsg = await findUniqueMessage(after);
    if (!afterMsg || afterMsg[chatIdKey] !== chatId) {
      return { messages: [], nextCursor: null, hasMore: false };
    }

    const whereClause: any = {
      [chatIdKey]: chatId,
      createdAt: { gt: afterMsg.createdAt },
    };

    if (before) {
      const cursorMsg = await findUniqueMessage(before);
      if (cursorMsg) {
        whereClause.createdAt.lt = cursorMsg.createdAt;
      }
    }

    const rawMessages = await findManyMessages({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
    });

    const hasMore = rawMessages.length > limit;
    const messagesBatch = hasMore ? rawMessages.slice(0, limit) : rawMessages;
    const nextCursor = hasMore ? messagesBatch[messagesBatch.length - 1].id : null;

    return {
      messages: messagesBatch,
      nextCursor,
      hasMore,
    };
  }

  // Cursor-based backward pagination: fetch older messages (createdAt DESC)
  const whereClause: any = { [chatIdKey]: chatId };
  if (before) {
    const cursorMsg = await findUniqueMessage(before);
    if (cursorMsg) {
      whereClause.createdAt = { lt: cursorMsg.createdAt };
    }
  }

  const rawMessages = await findManyMessages({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = rawMessages.length > limit;
  const messagesBatch = hasMore ? rawMessages.slice(0, limit) : rawMessages;
  const nextCursor = hasMore ? messagesBatch[messagesBatch.length - 1].id : null;

  // Reverse so they are in chronological order (createdAt ASC)
  const chronologicalMessages = [...messagesBatch].reverse();

  return {
    messages: chronologicalMessages,
    nextCursor,
    hasMore,
  };
}

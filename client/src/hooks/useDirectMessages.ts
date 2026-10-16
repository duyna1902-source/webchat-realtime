import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DirectReceiveMessagePayload,
  PaginatedMessagesDto,
  SOCKET_EVENTS,
  MessageType,
  MessageStatus,
  DirectSendMessagePayload,
  DirectReadPayload,
  DirectDeliveredPayload,
} from '@webchat/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export interface SendDirectMessageOptions {
  type?: MessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentSize?: number | null;
}

export function useDirectMessages(activeChatId: string | null) {
  const { token, currentUser } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<DirectReceiveMessagePayload[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const lastReadEmittedIdRef = useRef<string | null>(null);
  const messagesRef = useRef<DirectReceiveMessagePayload[]>([]);
  messagesRef.current = messages;

  // Fetch initial message history
  useEffect(() => {
    lastReadEmittedIdRef.current = null;
    if (!token || !activeChatId) {
      setMessages([]);
      setHasMore(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/direct-chats/${activeChatId}/messages?limit=50`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Failed to load message history');
        }
        return res.json();
      })
      .then((data: PaginatedMessagesDto<DirectReceiveMessagePayload>) => {
        if (isMounted) {
          setMessages(Array.isArray(data?.messages) ? data.messages : []);
          setHasMore(Boolean(data?.hasMore));
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Error loading messages');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, activeChatId]);

  // Load older messages for cursor pagination (?before=<oldestId>)
  const loadOlderMessages = useCallback(async () => {
    if (!token || !activeChatId || isLoadingOlder || !hasMore || messages.length === 0) {
      return;
    }

    const oldestId = messages[0].id;
    setIsLoadingOlder(true);

    try {
      const res = await fetch(`/api/direct-chats/${activeChatId}/messages?limit=50&before=${oldestId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data: PaginatedMessagesDto<DirectReceiveMessagePayload> = await res.json();
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newOlder = data.messages.filter((m) => !existingIds.has(m.id));
            return [...newOlder, ...prev];
          });
        }
        setHasMore(Boolean(data?.hasMore));
      }
    } catch (err: any) {
      console.error('Error loading older messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [token, activeChatId, isLoadingOlder, hasMore, messages]);

  // Catch-up Sync: fetches messages strictly newer than the latest local message
  const syncCatchup = useCallback(async () => {
    if (!token || !activeChatId) return;
    const currentMsgs = messagesRef.current;
    if (currentMsgs.length === 0) return;
    const latestMessage = currentMsgs[currentMsgs.length - 1];

    try {
      const res = await fetch(`/api/direct-chats/${activeChatId}/messages?after=${latestMessage.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data: PaginatedMessagesDto<DirectReceiveMessagePayload> = await res.json();
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = data.messages.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newItems];
          });
        }
      }
    } catch (err) {
      console.error('Failed to catch-up sync direct messages:', err);
    }
  }, [token, activeChatId]);

  // Auto read receipt: when active chat has unread messages from partner, emit direct:read
  useEffect(() => {
    if (!socket || !activeChatId || messages.length === 0) return;

    // Find the latest message sent by partner
    const latestFromPartner = [...messages].reverse().find((m) => m.senderId !== currentUser?.id);
    if (latestFromPartner && latestFromPartner.id !== lastReadEmittedIdRef.current) {
      lastReadEmittedIdRef.current = latestFromPartner.id;
      socket.emit(SOCKET_EVENTS.DIRECT_READ, {
        directChatId: activeChatId,
        messageId: latestFromPartner.id,
      });
    }
  }, [socket, activeChatId, messages, currentUser?.id]);

  // Real-time listener for incoming messages, read receipts, and reconnection catch-up sync
  useEffect(() => {
    if (!socket || !activeChatId) return;

    const handleReceive = (msg: DirectReceiveMessagePayload) => {
      if (msg.directChatId === activeChatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) {
            return prev;
          }
          return [...prev, msg];
        });
      }
    };

    const handleReadReceipt = (payload: DirectReadPayload) => {
      if (payload.directChatId === activeChatId) {
        setMessages((prev) => {
          const targetMsg = prev.find((m) => m.id === payload.messageId);
          const targetTime = targetMsg ? new Date(targetMsg.createdAt).getTime() : Infinity;

          return prev.map((m) => {
            if (m.senderId === currentUser?.id) {
              if (new Date(m.createdAt).getTime() <= targetTime) {
                return { ...m, status: MessageStatus.READ };
              }
            }
            return m;
          });
        });
      }
    };

    const handleDelivered = (payload: DirectDeliveredPayload) => {
      if (payload.directChatId === activeChatId) {
        setMessages((prev) => {
          return prev.map((m) => {
            if (m.senderId === currentUser?.id && m.status === MessageStatus.SENT) {
              return { ...m, status: MessageStatus.DELIVERED };
            }
            return m;
          });
        });
      }
    };

    const handleConnect = () => {
      // If socket.recovered is false, connection state was unrecovered; catch up missed messages
      if (!socket.recovered) {
        syncCatchup();
      }
    };

    socket.on(SOCKET_EVENTS.DIRECT_RECEIVE, handleReceive);
    socket.on(SOCKET_EVENTS.DIRECT_READ, handleReadReceipt);
    socket.on(SOCKET_EVENTS.DIRECT_DELIVERED, handleDelivered);
    socket.on('connect', handleConnect);

    return () => {
      socket.off(SOCKET_EVENTS.DIRECT_RECEIVE, handleReceive);
      socket.off(SOCKET_EVENTS.DIRECT_READ, handleReadReceipt);
      socket.off(SOCKET_EVENTS.DIRECT_DELIVERED, handleDelivered);
      socket.off('connect', handleConnect);
    };
  }, [socket, activeChatId, currentUser?.id, syncCatchup]);

  const sendMessage = useCallback(
    (content: string, optionsOrType?: MessageType | SendDirectMessageOptions) => {
      if (!socket || !activeChatId) return;

      let msgType = MessageType.TEXT;
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentSize: number | null = null;

      if (typeof optionsOrType === 'string') {
        msgType = optionsOrType;
      } else if (optionsOrType) {
        msgType = optionsOrType.type ?? MessageType.TEXT;
        attachmentUrl = optionsOrType.attachmentUrl ?? null;
        attachmentName = optionsOrType.attachmentName ?? null;
        attachmentSize = optionsOrType.attachmentSize ?? null;
      }

      if (!content.trim() && !attachmentUrl) return;

      const payload: DirectSendMessagePayload = {
        directChatId: activeChatId,
        content: content.trim(),
        type: msgType,
        attachmentUrl,
        attachmentName,
        attachmentSize,
      };

      socket.emit(SOCKET_EVENTS.DIRECT_SEND, payload);
    },
    [socket, activeChatId]
  );

  return {
    messages,
    isLoading,
    isLoadingOlder,
    hasMore,
    loadOlderMessages,
    error,
    sendMessage,
    syncCatchup,
  };
}

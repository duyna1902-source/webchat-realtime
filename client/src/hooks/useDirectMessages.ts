import { useState, useEffect, useCallback } from 'react';
import {
  DirectReceiveMessagePayload,
  PaginatedMessagesDto,
  SOCKET_EVENTS,
  MessageType,
  DirectSendMessagePayload,
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
  const { token } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState<DirectReceiveMessagePayload[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial message history
  useEffect(() => {
    if (!token || !activeChatId) {
      setMessages([]);
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

  // Real-time listener for incoming messages
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

    socket.on(SOCKET_EVENTS.DIRECT_RECEIVE, handleReceive);

    return () => {
      socket.off(SOCKET_EVENTS.DIRECT_RECEIVE, handleReceive);
    };
  }, [socket, activeChatId]);

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
    error,
    sendMessage,
  };
}

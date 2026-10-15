export interface MockMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  type?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'EMOJI_GIF';
  attachmentUrl?: string;
}

export interface MockChat {
  id: string;
  partner: {
    id: string;
    username: string;
    isOnline: boolean;
    lastSeenAt?: string;
  };
  lastMessage: {
    content: string;
    createdAt: string;
  };
  unreadCount?: number;
  messages: MockMessage[];
}

export interface MockRoom {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  lastMessage: {
    senderName: string;
    content: string;
    createdAt: string;
  };
  messages: MockMessage[];
}

export const INITIAL_MOCK_CHATS: MockChat[] = [
  {
    id: 'chat-1',
    partner: {
      id: 'user-2',
      username: 'Sarah Connor',
      isOnline: true,
    },
    lastMessage: {
      content: 'Chào bạn, dự án responsive mobile đã sẵn sàng chưa?',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    },
    unreadCount: 2,
    messages: [
      {
        id: 'msg-1',
        senderId: 'user-2',
        senderName: 'Sarah Connor',
        content: 'Hi! Mình vừa test thử ứng dụng chat trên iPhone.',
        createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-2',
        senderId: 'user-me',
        senderName: 'You',
        content: 'Tuyệt quá, bạn thấy giao diện hiển thị thế nào?',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'msg-3',
        senderId: 'user-2',
        senderName: 'Sarah Connor',
        content: 'Chào bạn, dự án responsive mobile đã sẵn sàng chưa?',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'chat-2',
    partner: {
      id: 'user-3',
      username: 'Alex River',
      isOnline: false,
      lastSeenAt: '10:30 AM',
    },
    lastMessage: {
      content: 'Đã gửi file tài liệu thiết kế mới nhất 📎',
      createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    },
    messages: [
      {
        id: 'msg-4',
        senderId: 'user-3',
        senderName: 'Alex River',
        content: 'Đã gửi file tài liệu thiết kế mới nhất 📎',
        createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'chat-3',
    partner: {
      id: 'user-4',
      username: 'David Nguyen',
      isOnline: true,
    },
    lastMessage: {
      content: 'OK hẹn gặp trong phòng họp lúc 2h chiều nhé!',
      createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    },
    messages: [
      {
        id: 'msg-5',
        senderId: 'user-4',
        senderName: 'David Nguyen',
        content: 'OK hẹn gặp trong phòng họp lúc 2h chiều nhé!',
        createdAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      },
    ],
  },
];

export const INITIAL_MOCK_ROOMS: MockRoom[] = [
  {
    id: 'room-1',
    name: 'Frontend Team',
    description: 'Thảo luận kiến trúc UI & Responsive Mobile',
    memberCount: 8,
    lastMessage: {
      senderName: 'David Nguyen',
      content: 'Bản thử nghiệm Master-Detail chạy rất mượt!',
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    messages: [
      {
        id: 'rmsg-1',
        senderId: 'user-4',
        senderName: 'David Nguyen',
        content: 'Chào mọi người trong kênh Frontend!',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: 'rmsg-2',
        senderId: 'user-2',
        senderName: 'Sarah Connor',
        content: 'Chúng ta đang đánh giá 3 mẫu thiết kế giao diện di động.',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
      {
        id: 'rmsg-3',
        senderId: 'user-4',
        senderName: 'David Nguyen',
        content: 'Bản thử nghiệm Master-Detail chạy rất mượt!',
        createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'room-2',
    name: 'Release Announcements',
    description: 'Thông báo triển khai tính năng và phát hành',
    memberCount: 24,
    lastMessage: {
      senderName: 'Alex River',
      content: 'Đã hoàn thành kiểm thử trên iOS Safari & Chrome.',
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    messages: [
      {
        id: 'rmsg-4',
        senderId: 'user-3',
        senderName: 'Alex River',
        content: 'Đã hoàn thành kiểm thử trên iOS Safari & Chrome.',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

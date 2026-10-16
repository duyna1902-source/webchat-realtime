# 02: Persistent Background Room Subscriptions, Real-Time Unread Count Badges & Friendly Media Snippets

**What to build:** End-to-end persistent background `Room Chat` socket subscriptions, real-time `room:member_change` lifecycle synchronization (`JOIN`, `LEAVE`, `KICK`, `ROLE_CHANGE`, `DELETE`), real-time `Unread Count Badge` pills on the conversation sidebar, and friendly media preview snippets for captionless attachments and GIFs.

When an authenticated user connects to the socket server, their socket is automatically joined to all `Room Chat` channels (`room:${roomId}`) where they are a `Room Member`, and switching active conversations or tabs in the UI never unsubscribes them from their joined rooms. When a user is added to a room (`JOIN`), kicked (`KICK`), or when an `OWNER` deletes a room (`DELETE`), the server broadcasts `room:member_change` to both `room:${id}` and `user:${targetUserId}` (and updates socket room membership). The client immediately adds newly joined rooms to the sidebar or removes kicked/deleted rooms from the sidebar and transitions the detail pane cleanly back to the idle placeholder if that room was currently open.

In the conversation sidebar (for both `Direct Chat` and `Room Chat`), any conversation with `unreadCount > 0` displays a Google Blue `Unread Count Badge` pill (`99+` when exceeding 99) and bold preview typography. Incoming messages from other users in any conversation not currently open increment that conversation's `unreadCount` in real time, while selecting the conversation or emitting `direct:read` / `room:read` resets `unreadCount` to `0`. When a conversation's latest message is an image, document, or GIF without a text caption, the sidebar preview formats it as `📷 Sent an image`, `📎 <filename>`, or `✨ Sent a GIF` instead of rendering a blank line or raw URL.

Decision-rich preview and badge helpers validated in the prototype:
```ts
function formatSidebarPreview(lastMsg: { senderId: string; type: string; content: string; attachmentName?: string | null } | null, currentUserId: string) {
  if (!lastMsg) return 'No messages yet';
  const prefix = lastMsg.senderId === currentUserId ? 'You: ' : '';
  if (lastMsg.type === 'EMOJI_GIF') return prefix + '✨ Sent a GIF';
  if (lastMsg.content && lastMsg.content.trim()) return prefix + lastMsg.content;
  if (lastMsg.type === 'IMAGE') return prefix + '📷 Sent an image';
  if (lastMsg.type === 'DOCUMENT') return prefix + '📎 ' + (lastMsg.attachmentName || 'Document');
  return prefix + lastMsg.content;
}

function formatUnreadBadgeCount(count?: number) {
  if (!count || count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}
```

**Blocked by:** 01: Checkmark-Free Delivery Status, Auto-Upgrade to Delivered & Single-Watermark Read Receipts

**Status:** claimed

- [ ] Shared `RoomMemberChangePayload['action']` union includes `'DELETE'` alongside `'JOIN' | 'LEAVE' | 'KICK' | 'ROLE_CHANGE'`.
- [ ] Upon socket connection, the server automatically joins the user's socket to all `room:${roomId}` channels they are a member of, and switching active conversations in the client does not emit `room:leave`.
- [ ] Adding a member (`JOIN`), removing a member (`KICK`), or deleting a room (`DELETE`) emits `room:member_change` so affected users see the room added or removed in their sidebar in real time, and if the user was viewing a kicked or deleted room, the detail view returns to the idle placeholder.
- [ ] Sidebar rows for `Direct Chat` and `Room Chat` render a Google Blue `Unread Count Badge` (`99+` cap) and bold preview text whenever `unreadCount > 0`.
- [ ] Incoming messages from other users for any conversation not currently active increment `unreadCount` by 1 in real time, and opening a conversation or marking it read resets its `unreadCount` to `0`.
- [ ] Captionless media messages in the sidebar preview display `📷 Sent an image` (`IMAGE`), `📎 <filename>` (`DOCUMENT`), and `✨ Sent a GIF` (`EMOJI_GIF`).
- [ ] Server and client integration tests verify background room message reception, real-time `JOIN` / `KICK` / `DELETE` sidebar & detail transitions, `Unread Count Badge` increments/resets, and media snippet formatting.

# 01: Checkmark-Free Delivery Status, Auto-Upgrade to Delivered & Single-Watermark Read Receipts

**What to build:** End-to-end `Delivery Status` (`Sent` -> `Delivered` -> `Seen`) and `Read Receipt` presentation without checkmarks (Variant B), automatic real-time upgrade of pending `SENT` direct messages to `DELIVERED` when an offline recipient connects, a single read watermark so `Seen` disappears from older messages when a newer message is seen, and hiding the sender's own avatar on outgoing `Room Chat` messages.

When a user sends a `Direct Message` to an offline partner, a minimalist `Sent` label appears below the latest outgoing message bubble. As soon as the partner connects to the platform, all pending `SENT` messages addressed to them automatically upgrade to `DELIVERED` and notify the sender in real time via `direct:delivered`, updating the label below the latest outgoing message to `Delivered`. When the partner views the conversation (`direct:read`), the indicator transitions to `Seen` paired with the partner's 16px circular Mini-Avatar (`Read Receipt`). Crucially, `Seen [Mini-Avatar]` acts as a single read watermark: it renders **only** below the latest outgoing message with status `READ`, so when the sender sends a new message and the partner reads it, the `Seen` indicator below any older message automatically disappears and moves down to the newest seen message.

In `Room Chat`, the sender's own 32px avatar circle is hidden on outgoing messages (`isMe`), aligning outgoing bubbles cleanly to the right edge. Below the latest outgoing room message, `Sent` is displayed while zero members have read it; once members read the message (`room:read`), `Seen by N` alongside up to 3 stacked 16px Mini-Avatars of those readers is displayed below the message matching their `lastReadMessageId` (automatically disappearing from older messages as members read newer messages). In the conversation sidebar, outgoing last messages are prefixed with `You: ` and paired with a compact checkmark-free indicator (`Sent`, `Delivered`, or the partner's 16px Mini-Avatar when `Seen`).

Decision-rich watermark logic validated in the prototype:
```ts
function getDirectStatusWatermark(messages: Array<{ id: string; senderId: string; status: string }>, currentUserId: string) {
  let lastReadOutgoingId: string | null = null;
  let lastOutgoingId: string | null = null;
  for (const m of messages) {
    if (m.senderId === currentUserId) {
      lastOutgoingId = m.id;
      if (m.status === 'READ') {
        lastReadOutgoingId = m.id;
      }
    }
  }
  return { lastReadOutgoingId, lastOutgoingId };
}
```

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Shared socket contract defines `DIRECT_DELIVERED: 'direct:delivered'` and `DirectDeliveredPayload` (`{ directChatId: string; deliveredToUserId: string }`).
- [x] When a user connects to the socket server, any `DirectMessage` records addressed to them with status `SENT` are updated to `DELIVERED` in the database and `direct:delivered` is emitted in real time to each corresponding sender.
- [x] Outgoing `Direct Message` bubbles render no checkmark icons; instead, Variant B minimalist English status labels render below the bubble on the light canvas: `Sent` (`data-testid="status-sent"`, `title="Sent"`), `Delivered` (`data-testid="status-delivered"`, `title="Delivered"`), and `Seen` + 16px circular partner Mini-Avatar (`data-testid="status-read"`, `title="Đã xem"`).
- [x] Single-watermark rule in `Direct Chat`: `Seen` + Mini-Avatar renders only on the latest outgoing message with status `READ` (`lastReadOutgoingId`), and `Sent` / `Delivered` renders only on the latest outgoing message (`lastOutgoingId`); when a newer outgoing message becomes `READ`, the `Seen` indicator under older messages disappears.
- [x] Outgoing `Room Message` rows hide the sender's own 32px avatar circle, render `Sent` below the latest outgoing message when `readers.length === 0`, and render `Seen by N` with up to 3 stacked 16px reader Mini-Avatars (`data-testid="room-message-read-indicator"`, tooltip listing reader usernames) on messages with readers.
- [x] Conversation sidebar prefixes outgoing last messages with `You: ` and displays a compact `Sent`, `Delivered`, or partner Mini-Avatar (`Seen`) indicator without checkmarks.
- [x] Server and client integration tests verify automatic `SENT` -> `DELIVERED` transition on recipient connect, checkmark-free `Sent` / `Delivered` / `Seen` rendering, single-watermark movement when a newer message is seen, and hidden own avatar in `Room Chat`.

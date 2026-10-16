# 04: Context-Aware Notifications & Full Reconnection Catch-Up Sync

**What to build:** Context-aware real-time notifications (distinguishing hidden browser tabs from visible foreground tabs when messages arrive in inactive conversations) and complete reconnection synchronization for both the conversation sidebar and active conversations that had zero messages prior to disconnection.

When a user has notifications enabled and a new `Direct Message` or `Room Message` arrives from another user:
- If the browser tab is hidden (`document.hidden === true`), the client plays the gentle audio notification ping and triggers an HTML5 Browser Notification (`new Notification(...)`).
- If the browser tab is visible (`document.hidden === false`) and the incoming message belongs to a `Direct Chat` or `Room Chat` that is **not** currently open in the active detail pane, the client plays the discreet audio notification ping (accompanied by the real-time `Unread Count Badge` increment) without spawning a redundant OS popup notification.
- If the browser tab is visible and the message belongs to the currently open conversation, neither an audio ping nor a browser notification is triggered.

When the socket connection drops and reconnects after a network interruption:
- Both `Direct Chat` and `Room Chat` sidebar lists automatically re-fetch on socket `connect` so `Presence` indicators, latest message previews, and `Unread Count Badge` counts are immediately synchronized.
- Active conversation `Catch-up Sync` (`syncCatchup`) runs even when the open conversation had `0` messages in memory prior to the disconnection (fetching the initial message batch instead of returning early when `messagesRef.current.length === 0`).

**Blocked by:** 02: Persistent Background Room Subscriptions, Real-Time Unread Count Badges & Friendly Media Snippets

**Status:** ready-for-agent

- [ ] When notifications are enabled and a message from another user arrives while `document.hidden === true`, both the audio ping and HTML5 Browser Notification fire.
- [ ] When notifications are enabled and a message from another user arrives while `document.hidden === false` for a conversation other than the currently open conversation (`chatId !== activeChatId` or `roomId !== activeRoomId`), the discreet audio ping fires without triggering an HTML5 Browser Notification.
- [ ] No notification or audio ping fires for outgoing messages sent by the current user or for incoming messages in the currently open foreground conversation.
- [ ] On socket reconnection (`connect` event), both `Direct Chat` and `Room Chat` sidebar lists refresh automatically to sync `Presence` and `Unread Count Badge` state.
- [ ] On unrecovered socket reconnection, `Catch-up Sync` in the active `Direct Chat` or `Room Chat` fetches missed messages even when the conversation had `0` messages prior to disconnection.
- [ ] Client integration tests verify foreground-inactive vs. background-tab notification behavior and reconnection catch-up sync from an empty initial message list.

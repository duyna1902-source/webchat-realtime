import {
  ROOM_RULES,
  isValidUsername,
  normalizeUsername,
  stripControlCharacters,
  truncateCharacters,
} from '@webchat/shared';
import type { UpgradeStep, UpgradeStepContext } from './runner.js';

// ==========================================
// ACCOUNT AND ROOM RULES (ticket 07, SEC-08)
// ==========================================
// Brings rows created before the validation rules existed into line with them, so the contract
// migration (ticket 20) can add its unique and length constraints. Accounts are processed oldest
// first: on a clash the account created first keeps its value.

type Db = UpgradeStepContext['db'];

interface Change {
  id: string;
  from: string;
  to: string;
}

const PREVIEW_LENGTH = 60;

/** A report-safe rendering: escaped, and shortened when very long. */
function show(value: string | null): string {
  if (value === null) return 'null';
  if (value.length <= PREVIEW_LENGTH) return JSON.stringify(value);
  return `${JSON.stringify(value.slice(0, PREVIEW_LENGTH))}… (${value.length} chars)`;
}

function describe(model: string, field: string, changes: Change[]): string[] {
  return changes.map((c) => `${model} ${c.id}: ${field} ${show(c.from)} -> ${show(c.to)}`);
}

function usersOldestFirst(db: Db) {
  return db.user.findMany({
    select: { id: true, username: true, usernameNormalized: true, email: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

/**
 * Applies changes to a unique column without transient clashes (one row may take the value
 * another row is giving up): every changed row first gets a placeholder, then its final value.
 */
async function applyUnique(db: Db, field: 'username' | 'email', changes: Change[]): Promise<void> {
  for (const change of changes) {
    await db.user.update({ where: { id: change.id }, data: { [field]: `__upgrade_${change.id}` } });
  }
  for (const change of changes) {
    await db.user.update({ where: { id: change.id }, data: { [field]: change.to } });
  }
}

function idPart(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, '');
}

/** `user_<first 6 characters of the id>`, using more of the id if that name is taken. */
function replacementUsername(id: string, taken: Set<string>): string {
  const part = idPart(id) || 'x';
  for (let length = 6; length <= Math.min(part.length, 27); length++) {
    const candidate = `user_${part.slice(0, length)}`;
    if (!taken.has(normalizeUsername(candidate))) return candidate;
  }
  for (let n = 1; ; n++) {
    const candidate = `user_${part.slice(0, 20)}_${n}`;
    if (!taken.has(normalizeUsername(candidate))) return candidate;
  }
}

export const normalizeUsernamesStep: UpgradeStep = {
  name: 'normalize-usernames',
  async run({ db }) {
    const users = await usersOldestFirst(db);
    // Every valid name is reserved up front so a replacement never takes a later account's name.
    const taken = new Set(users.filter((u) => isValidUsername(u.username)).map((u) => normalizeUsername(u.username)));
    const kept = new Set<string>();
    const toRename: typeof users = [];
    for (const user of users) {
      const key = normalizeUsername(user.username);
      if (isValidUsername(user.username) && !kept.has(key)) {
        kept.add(key);
      } else {
        toRename.push(user);
      }
    }

    const changes: Change[] = [];
    for (const user of toRename) {
      const to = replacementUsername(user.id, taken);
      taken.add(normalizeUsername(to));
      changes.push({ id: user.id, from: user.username, to });
    }
    await applyUnique(db, 'username', changes);
    return { changed: changes.length, details: describe('User', 'username', changes) };
  },
};

function duplicateEmail(email: string, n: number): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? `${email}+dup${n}` : `${email.slice(0, at)}+dup${n}${email.slice(at)}`;
}

export const lowercaseEmailsStep: UpgradeStep = {
  name: 'lowercase-emails',
  async run({ db }) {
    const users = await usersOldestFirst(db);
    const reserved = new Set(users.map((u) => u.email.toLowerCase()));
    const taken = new Set<string>();

    const changes: Change[] = [];
    for (const user of users) {
      let to = user.email.toLowerCase();
      if (taken.has(to)) {
        const base = to;
        let n = 1;
        do {
          to = duplicateEmail(base, n++);
        } while (taken.has(to) || reserved.has(to));
      }
      taken.add(to);
      if (to !== user.email) changes.push({ id: user.id, from: user.email, to });
    }
    await applyUnique(db, 'email', changes);
    return { changed: changes.length, details: describe('User', 'email', changes) };
  },
};

export const fillUsernameNormalizedStep: UpgradeStep = {
  name: 'fill-username-normalized',
  async run({ db }) {
    const users = await usersOldestFirst(db);
    let changed = 0;
    for (const user of users) {
      const key = normalizeUsername(user.username);
      if (user.usernameNormalized !== key) {
        await db.user.update({ where: { id: user.id }, data: { usernameNormalized: key } });
        changed++;
      }
    }
    return { changed };
  },
};

export const clearAvatarUrlsStep: UpgradeStep = {
  name: 'clear-avatar-urls',
  async run({ db }) {
    const { count } = await db.user.updateMany({ where: { avatarUrl: { not: null } }, data: { avatarUrl: null } });
    return { changed: count };
  },
};

function cleanText(value: string, max: number): string {
  return truncateCharacters(stripControlCharacters(value).trim(), max).trim();
}

export const sanitizeRoomsStep: UpgradeStep = {
  name: 'sanitize-rooms',
  async run({ db }) {
    const rooms = await db.room.findMany({ select: { id: true, name: true, description: true }, orderBy: { id: 'asc' } });
    const details: string[] = [];
    let changed = 0;
    for (const room of rooms) {
      const name = cleanText(room.name, ROOM_RULES.NAME_MAX_LENGTH) || `Room ${idPart(room.id).slice(0, 6)}`;
      const description =
        room.description === null ? null : cleanText(room.description, ROOM_RULES.DESCRIPTION_MAX_LENGTH) || null;
      if (name === room.name && description === room.description) continue;

      await db.room.update({ where: { id: room.id }, data: { name, description } });
      changed++;
      if (name !== room.name) details.push(...describe('Room', 'name', [{ id: room.id, from: room.name, to: name }]));
      if (description !== room.description) {
        details.push(`Room ${room.id}: description ${show(room.description)} -> ${show(description)}`);
      }
    }
    return { changed, details };
  },
};

/** In run order: usernames are final before their normalized key is filled. */
export const ACCOUNT_AND_ROOM_STEPS: readonly UpgradeStep[] = [
  normalizeUsernamesStep,
  fillUsernameNormalizedStep,
  lowercaseEmailsStep,
  clearAvatarUrlsStep,
  sanitizeRoomsStep,
];

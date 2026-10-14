import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  username: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'webchat-realtime-default-secret-key-32-chars';
const JWT_EXPIRES_IN = '7d';

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

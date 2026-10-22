import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  username: string;
}

const JWT_EXPIRES_IN = '7d';

// The secret always comes from the validated config (`AppConfig.jwtSecret`); there is no default.
export function signToken(payload: JwtPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

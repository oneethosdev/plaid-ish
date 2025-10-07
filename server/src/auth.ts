import { auth as auth0Jwt, requiredScopes } from 'express-oauth2-jwt-bearer';
import type { Request, Response, NextFunction } from 'express';
import { env } from './env';
import { findOrCreateUserBySub } from './db/csvDb';

export const checkJwt = auth0Jwt({
  audience: env.auth0.audience,
  issuerBaseURL: `https://${env.auth0.domain}/`,
  tokenSigningAlg: 'RS256',
});

export const requireApiScope = (scope: string) => requiredScopes(scope);

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const sub = (req as any).auth?.payload?.sub as string | undefined;
    if (!sub) return next();
    const user = await findOrCreateUserBySub(sub);
    (req as any).userRecord = user;
    next();
  } catch (err) {
    next(err);
  }
}


import { SignJWT, jwtVerify } from "jose";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AccessTokenSettings {
  secret: string;
  issuer: string;
  audience: string;
}

export interface AccessTokenService {
  sign(userId: string): Promise<{ token: string; expiresIn: number }>;
  verify(token: string): Promise<{ userId: string }>;
}

export function createAccessTokenService(settings: AccessTokenSettings): AccessTokenService {
  const key = new TextEncoder().encode(settings.secret);

  return {
    async sign(userId) {
      const token = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuer(settings.issuer)
        .setAudience(settings.audience)
        .setIssuedAt()
        .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
        .sign(key);
      return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
    },

    async verify(token) {
      // Pinning the algorithm is what stops "alg: none" and HS/RS confusion attacks.
      const { payload } = await jwtVerify(token, key, {
        algorithms: ["HS256"],
        issuer: settings.issuer,
        audience: settings.audience,
      });
      if (typeof payload.sub !== "string") throw new Error("token has no subject");
      return { userId: payload.sub };
    },
  };
}

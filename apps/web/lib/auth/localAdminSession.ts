import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "horizon_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface SessionPayload {
  email: string;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "horizon-local-admin-dev-secret"
  );
}

function configuredPassword(): string {
  return process.env.ADMIN_PASSWORD || "horizon2026";
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", sessionSecret()).update(encodedPayload).digest("base64url");
}

function verifySignature(encodedPayload: string, signature: string): boolean {
  const expected = signPayload(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function isLocalAdminPasswordValid(password: string): boolean {
  const expectedBuffer = Buffer.from(configuredPassword());
  const actualBuffer = Buffer.from(password);

  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function createLocalAdminSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  const payload: SessionPayload = {
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const token = `${encodedPayload}.${signPayload(encodedPayload)}`;

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearLocalAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getLocalAdminSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !verifySignature(encodedPayload, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as Partial<SessionPayload>;
    if (!payload.email || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { email: payload.email };
  } catch {
    return null;
  }
}

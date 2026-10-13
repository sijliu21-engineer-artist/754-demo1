import type { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

type Account = {
  username: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  createdAt?: string;
};

export type AuthSession = {
  username: string;
  displayName: string;
  expiresAt: number;
};

const demoAccounts: Account[] = [
  { username: "casemate01", displayName: "Demo User 1", salt: "2uNdDzleSNW4G87rJCtrrQ==", passwordHash: "DA2O0ki/chzQZ3cEQNfJllhTFx08nBDQcZduS51QYWw=" },
  { username: "casemate02", displayName: "Demo User 2", salt: "wj6D3tb2BL61EKCBH2qhEg==", passwordHash: "8kFu6M5A0yuj/9DYylXPD2tUldmBmFVZOGlU3wFK0vw=" },
  { username: "casemate03", displayName: "Demo User 3", salt: "vnU5ONzt2v2yUuqj8eFF4w==", passwordHash: "FJ2TAhFIvlyZmeWUdw556YXc69eninjU5M52XPMV+BQ=" },
  { username: "casemate04", displayName: "Demo User 4", salt: "D0ham9gigf+jQYYZU5qLNA==", passwordHash: "9r/cpRyzHocnpiHp9jNwbqY+KZfKr8svWCK7yvDBdkQ=" },
  { username: "casemate05", displayName: "Demo User 5", salt: "KluSEV4xkwfOjeZwahZJvA==", passwordHash: "rSURnm3/tKLy/7gSaVWsV/p4qUcukYXAc4YL6IaDd9U=" },
];

const decodeBase64 = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

const encodeBase64 = (value: ArrayBuffer | Uint8Array) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return btoa(String.fromCharCode(...bytes));
};

const hashPassword = async (password: string, salt: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: decodeBase64(salt),
      iterations: 120000,
    },
    key,
    256,
  );
  return encodeBase64(derived);
};

const constantTimeEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
};

const seedDemoAccounts = async () => {
  const seedVersion = await kv.get("auth:demo-seed-version");
  if (seedVersion === 1) return;
  await kv.mset(
    demoAccounts.map((account) => `auth:user:${account.username}`),
    demoAccounts,
  );
  await kv.set("auth:demo-seed-version", 1);
};

const createSession = async (account: Account) => {
  const token = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  await kv.set(`auth:session:${token}`, {
    username: account.username,
    displayName: account.displayName,
    expiresAt,
  });
  return {
    token,
    expiresAt,
    user: {
      username: account.username,
      displayName: account.displayName,
    },
  };
};

export const resolveSession = async (
  token: string | undefined,
): Promise<AuthSession | null> => {
  if (!token) return null;
  const session = (await kv.get(`auth:session:${token}`)) as
    | AuthSession
    | undefined;
  if (!session || session.expiresAt <= Date.now()) {
    if (session) await kv.del(`auth:session:${token}`);
    return null;
  }
  return session;
};

export const registerAuthRoutes = (app: Hono) => {
  app.get("/make-server-ba71e98d/auth/status", async (c) => {
    try {
      await seedDemoAccounts();
      const storedAccounts = await kv.mget(
        demoAccounts.map((account) => `auth:user:${account.username}`),
      );
      return c.json({
        status: "ok",
        version: "casemate-auth-v2",
        seededAccountCount: storedAccounts.length,
      });
    } catch (error) {
      console.error("Account seed failed", error);
      return c.json({ error: "Unable to initialize accounts." }, 500);
    }
  });

  app.post("/make-server-ba71e98d/auth/register", async (c) => {
    let payload: {
      username?: string;
      password?: string;
      displayName?: string;
    };
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request." }, 400);
    }

    const username = payload.username?.trim().toLowerCase() ?? "";
    const password = payload.password ?? "";
    const displayName = payload.displayName?.trim() || username;
    if (!/^[a-z0-9_]{4,32}$/.test(username)) {
      return c.json({
        error: "Account must be 4–32 lowercase letters, numbers, or underscores.",
      }, 400);
    }
    if (
      password.length < 8 ||
      password.length > 128 ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password)
    ) {
      return c.json({
        error: "Password must be 8–128 characters and include a letter and number.",
      }, 400);
    }
    if (displayName.length > 50) {
      return c.json({ error: "Display name is too long." }, 400);
    }

    try {
      await seedDemoAccounts();
      if (await kv.get(`auth:user:${username}`)) {
        return c.json({ error: "This account already exists." }, 409);
      }
      const salt = encodeBase64(crypto.getRandomValues(new Uint8Array(16)));
      const account: Account = {
        username,
        displayName,
        salt,
        passwordHash: await hashPassword(password, salt),
        createdAt: new Date().toISOString(),
      };
      await kv.set(`auth:user:${username}`, account);
      return c.json(await createSession(account), 201);
    } catch (error) {
      console.error("Registration failed", error);
      return c.json({ error: "Account creation is temporarily unavailable." }, 500);
    }
  });

  app.post("/make-server-ba71e98d/auth/login", async (c) => {
    let payload: { username?: string; password?: string };
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request." }, 400);
    }

    const username = payload.username?.trim().toLowerCase() ?? "";
    const password = payload.password ?? "";
    if (!/^[a-z0-9_]{4,32}$/.test(username) || password.length > 128) {
      return c.json({ error: "Incorrect account or password." }, 401);
    }

    try {
      await seedDemoAccounts();
      const account = (await kv.get(`auth:user:${username}`)) as
        | Account
        | undefined;
      const candidateHash = account
        ? await hashPassword(password, account.salt)
        : await hashPassword(password, "AAAAAAAAAAAAAAAAAAAAAA==");
      if (
        !account ||
        !constantTimeEqual(candidateHash, account.passwordHash)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        return c.json({ error: "Incorrect account or password." }, 401);
      }
      return c.json(await createSession(account));
    } catch (error) {
      console.error("Login failed", error);
      return c.json({ error: "Login is temporarily unavailable." }, 500);
    }
  });
};

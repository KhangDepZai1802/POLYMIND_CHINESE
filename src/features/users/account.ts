export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

const INTERNAL_LOGIN_DOMAIN = "login.polymind.local";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function usernameToLoginEmail(value: string) {
  return `${normalizeUsername(value)}@${INTERNAL_LOGIN_DOMAIN}`;
}

export function loginIdentifierToEmail(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.includes("@")
    ? normalized
    : usernameToLoginEmail(normalized);
}

const SESSION_KEY = 'quickvote_admin_auth';

export function isPasswordRequired(): boolean {
  const password = import.meta.env.VITE_ADMIN_PASSWORD;
  return typeof password === 'string' && password.length > 0;
}

export function isAuthenticated(): boolean {
  if (!isPasswordRequired()) return true;
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

export function authenticate(password: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_PASSWORD;
  if (password === expected) {
    sessionStorage.setItem(SESSION_KEY, 'true');
    return true;
  }
  return false;
}

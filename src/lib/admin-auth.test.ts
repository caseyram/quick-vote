import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isPasswordRequired, isAuthenticated, authenticate } from './admin-auth';

describe('admin-auth', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('isPasswordRequired', () => {
    it('returns false when env var is empty', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = '';
      expect(isPasswordRequired()).toBe(false);
    });

    it('returns false when env var is undefined', () => {
      delete (import.meta.env as Record<string, unknown>).VITE_ADMIN_PASSWORD;
      expect(isPasswordRequired()).toBe(false);
    });

    it('returns true when env var has a value', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = 'secret123';
      expect(isPasswordRequired()).toBe(true);
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when no password is required', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = '';
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false when password required and not authenticated', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = 'secret';
      expect(isAuthenticated()).toBe(false);
    });

    it('returns true when password required and session flag is set', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = 'secret';
      sessionStorage.setItem('quickvote_admin_auth', 'true');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false when session flag is wrong value', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = 'secret';
      sessionStorage.setItem('quickvote_admin_auth', 'false');
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('authenticate', () => {
    it('returns true and sets session flag on correct password', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = 'mypassword';
      expect(authenticate('mypassword')).toBe(true);
      expect(sessionStorage.getItem('quickvote_admin_auth')).toBe('true');
    });

    it('returns false on wrong password', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = 'mypassword';
      expect(authenticate('wrongpassword')).toBe(false);
      expect(sessionStorage.getItem('quickvote_admin_auth')).toBeNull();
    });

    it('returns false on empty password when one is required', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = 'mypassword';
      expect(authenticate('')).toBe(false);
    });

    it('returns true when password matches empty string', () => {
      import.meta.env.VITE_ADMIN_PASSWORD = '';
      expect(authenticate('')).toBe(true);
    });
  });
});

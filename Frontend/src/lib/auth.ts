export type UserRole = 'petugas' | 'supervisor';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  role_label: string;
  wilayah: string | null;
  nip: string | null;
  initials: string;
}

const TOKEN_KEY = 'jalankita_token';
const USER_KEY  = 'jalankita_user';

let _currentUser: User | null = null;
let _token: string | null = null;

function init() {
  if (typeof window === 'undefined') return;
  try {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser  = localStorage.getItem(USER_KEY);
    if (storedToken && storedUser) {
      _token       = storedToken;
      _currentUser = JSON.parse(storedUser) as User;
    }
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

init();

export function saveAuth(user: User, token: string): void {
  _currentUser = user;
  _token       = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuth(): void {
  _currentUser = null;
  _token       = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}

export function getCurrentUser(): User | null {
  return _currentUser;
}

export function getToken(): string | null {
  if (_token) return _token;
  if (typeof window === 'undefined') return null;
  const t = localStorage.getItem(TOKEN_KEY)
         ?? localStorage.getItem('auth_token')
         ?? sessionStorage.getItem('auth_token');
  if (t) _token = t;
  return t;
}

export function isLoggedIn(): boolean {
  return getToken() !== null && getCurrentUser() !== null;
}

/** @deprecated Gunakan saveAuth() */
export function setCurrentUser(role: UserRole): void {
}

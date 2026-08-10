export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  mustChangePassword: boolean;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: SessionUser;
}

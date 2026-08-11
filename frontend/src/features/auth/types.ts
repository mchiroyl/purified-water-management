export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  deviceId: string;
  roles: string[];
  mustChangePassword: boolean;
}

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: SessionUser;
}

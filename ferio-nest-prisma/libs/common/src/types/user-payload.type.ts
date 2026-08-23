export interface UserPayload {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
  sessionVersion?: number;
  iat?: number;
  exp?: number;
}

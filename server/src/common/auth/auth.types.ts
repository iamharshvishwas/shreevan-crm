import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

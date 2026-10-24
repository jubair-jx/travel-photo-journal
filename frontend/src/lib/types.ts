export interface User {
  id: string;
  email: string;
}

export interface AuthPayload {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface Photo {
  id: string;
  name: string;
  location: string;
  description: string;
  summary: string | null;
  imageUrl: string;
  imageMime: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoPage {
  items: Photo[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  startedAt: string;
  lastActiveAt: string;
  current: boolean;
}

export interface TwoFactorSetup {
  qrCodeDataUrl: string;
  manualKey: string;
}

export interface FieldIssue {
  path: string;
  message: string;
}

// Every failure the UI deals with, whether the server answered or the request never arrived.
export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: FieldIssue[];
}

export const NETWORK_ERROR = "NETWORK_ERROR";

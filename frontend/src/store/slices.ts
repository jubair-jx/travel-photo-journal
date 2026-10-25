import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthPayload, User } from "../lib/types";

// Memory only. This slice is deliberately never persisted: the access token must not reach
// localStorage, where any injected script could read it (ADR-0004).
export interface AuthState {
  // "unknown" until the first silent refresh settles after a page load. "unavailable" means the
  // server could not be asked (offline, down, overloaded): the user may well still have a session,
  // so they are offered a retry instead of being sent to sign in again.
  status: "unknown" | "authenticated" | "anonymous" | "unavailable";
  accessToken: string | null;
  user: User | null;
}

const authSlice = createSlice({
  name: "auth",
  initialState: { status: "unknown", accessToken: null, user: null } as AuthState,
  reducers: {
    credentialsReceived(state, action: PayloadAction<AuthPayload>) {
      state.status = "authenticated";
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
    },
    sessionUnavailable(state) {
      state.status = "unavailable";
      state.accessToken = null;
    },
    signedOut(state) {
      state.status = "anonymous";
      state.accessToken = null;
      state.user = null;
    },
  },
});

export const { credentialsReceived, sessionUnavailable, signedOut } = authSlice.actions;
export const authReducer = authSlice.reducer;

// Non-sensitive preferences. This is the only slice that is persisted.
export interface UiState {
  lastEmail: string | null;
}

const uiSlice = createSlice({
  name: "ui",
  initialState: { lastEmail: null } as UiState,
  reducers: {
    emailRemembered(state, action: PayloadAction<string>) {
      state.lastEmail = action.payload;
    },
    emailForgotten(state) {
      state.lastEmail = null;
    },
  },
});

export const { emailRemembered, emailForgotten } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;

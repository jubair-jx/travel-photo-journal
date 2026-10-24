import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuthPayload, User } from "../lib/types";

// Memory only. This slice is deliberately never persisted: the access token must not reach
// localStorage, where any injected script could read it (ADR-0004).
export interface AuthState {
  // "unknown" until the first silent refresh settles after a page load.
  status: "unknown" | "authenticated" | "anonymous";
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
    signedOut(state) {
      state.status = "anonymous";
      state.accessToken = null;
      state.user = null;
    },
  },
});

export const { credentialsReceived, signedOut } = authSlice.actions;
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

import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "../lib/config";
import {
  NETWORK_ERROR,
  type ApiError,
  type AuthPayload,
  type FieldIssue,
  type Photo,
  type PhotoPage,
  type TwoFactorSetup,
} from "../lib/types";
import { restoreSession } from "./session";
import { credentialsReceived, signedOut, type AuthState } from "./slices";

const tokenOf = (state: unknown): string | null => (state as { auth: AuthState }).auth.accessToken;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "same-origin",
  prepareHeaders: (headers, { getState }) => {
    const token = tokenOf(getState());
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
  },
});

// A 401 from these means "wrong credentials / bad link", not "your access token expired".
const NO_REFRESH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/logout",
]);

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: FieldIssue[] };
}

const isErrorEnvelope = (body: unknown): body is ErrorEnvelope =>
  typeof body === "object" &&
  body !== null &&
  "error" in body &&
  typeof body.error === "object" &&
  body.error !== null &&
  "code" in body.error &&
  "message" in body.error;

export function toApiError(error: FetchBaseQueryError): ApiError {
  if (error.status === "FETCH_ERROR" || error.status === "TIMEOUT_ERROR") {
    return {
      status: 0,
      code: NETWORK_ERROR,
      message: "Could not reach the server. Check your connection and try again.",
    };
  }
  if (typeof error.status === "number" && isErrorEnvelope(error.data)) {
    const { code, message, details } = error.data.error;
    return { status: error.status, code, message, ...(details && { details }) };
  }
  return {
    status: typeof error.status === "number" ? error.status : 0,
    code: "UNKNOWN_ERROR",
    message: "Something went wrong. Please try again.",
  };
}

const baseQuery: BaseQueryFn<string | FetchArgs, unknown, ApiError> = async (args, api, extra) => {
  const url = typeof args === "string" ? args : args.url;
  const sentWith = tokenOf(api.getState());

  let result = await rawBaseQuery(args, api, extra);

  if (result.error?.status === 401 && sentWith && !NO_REFRESH_PATHS.has(url)) {
    // If another request has already swapped the token, just retry; otherwise join the shared refresh.
    const renewed = tokenOf(api.getState()) !== sentWith || (await restoreSession(api.dispatch));
    if (renewed) result = await rawBaseQuery(args, api, extra);
  }

  if (result.error) return { error: toApiError(result.error) };
  // Every success is wrapped as { success, data }; callers only ever see the data.
  const envelope = result.data as { data: unknown };
  return { data: envelope.data, meta: result.meta };
};

export interface Credentials {
  email: string;
  password: string;
  totpCode?: string;
}

export const api = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: ["Photo"],
  endpoints: (build) => ({
    register: build.mutation<{ email: string }, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
    }),
    verifyEmail: build.mutation<{ verified: true }, { token: string }>({
      query: (body) => ({ url: "/auth/verify-email", method: "POST", body }),
    }),
    resendVerification: build.mutation<{ message: string }, { email: string }>({
      query: (body) => ({ url: "/auth/resend-verification", method: "POST", body }),
    }),
    login: build.mutation<AuthPayload, Credentials>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(credentialsReceived(data));
        } catch {
          // The caller sees the error; nothing to store.
        }
      },
    }),
    logout: build.mutation<null, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          // Even if the server could not be told, this browser stops acting as signed in.
        } finally {
          dispatch(signedOut());
          dispatch(api.util.resetApiState());
        }
      },
    }),
    setupTwoFactor: build.mutation<TwoFactorSetup, void>({
      query: () => ({ url: "/auth/2fa/setup", method: "POST" }),
    }),
    verifyTwoFactor: build.mutation<{ enabled: true }, { code: string }>({
      query: (body) => ({ url: "/auth/2fa/verify", method: "POST", body }),
    }),
    listPhotos: build.query<PhotoPage, { page: number; limit?: number }>({
      query: ({ page, limit = 12 }) => ({ url: "/photos", params: { page, limit } }),
      providesTags: ["Photo"],
    }),
    createPhoto: build.mutation<Photo, FormData>({
      query: (body) => ({ url: "/photos", method: "POST", body }),
      invalidatesTags: ["Photo"],
    }),
    updatePhoto: build.mutation<Photo, { id: string; body: FormData }>({
      query: ({ id, body }) => ({ url: `/photos/${id}`, method: "PUT", body }),
      invalidatesTags: ["Photo"],
    }),
    deletePhoto: build.mutation<null, string>({
      query: (id) => ({ url: `/photos/${id}`, method: "DELETE" }),
      invalidatesTags: ["Photo"],
    }),
  }),
});

export const {
  useRegisterMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useLoginMutation,
  useLogoutMutation,
  useSetupTwoFactorMutation,
  useVerifyTwoFactorMutation,
  useListPhotosQuery,
  useCreatePhotoMutation,
  useUpdatePhotoMutation,
  useDeletePhotoMutation,
} = api;

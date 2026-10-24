import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
  FLUSH,
  PAUSE,
  PERSIST,
  persistReducer,
  persistStore,
  PURGE,
  REGISTER,
  REHYDRATE,
  type WebStorage,
} from "redux-persist";
import { api } from "./api";
import { authReducer, uiReducer } from "./slices";

export { restoreSession } from "./session";

const noopStorage: WebStorage = {
  getItem: () => Promise.resolve(null),
  setItem: () => Promise.resolve(),
  removeItem: () => Promise.resolve(),
};

// localStorage where there is one. On the server there is nothing to persist to, and in private
// windows access can throw, so every failure degrades to "nothing saved".
export function defaultStorage(): WebStorage {
  if (typeof window === "undefined") return noopStorage;
  return {
    getItem: (key) => Promise.resolve(safely(() => window.localStorage.getItem(key), null)),
    setItem: (key, value) => {
      safely(() => window.localStorage.setItem(key, value), undefined);
      return Promise.resolve();
    },
    removeItem: (key) => {
      safely(() => window.localStorage.removeItem(key), undefined);
      return Promise.resolve();
    },
  };
}

function safely<T>(action: () => T, fallback: T): T {
  try {
    return action();
  } catch {
    return fallback;
  }
}

export function makeStore(storage: WebStorage = defaultStorage()) {
  const rootReducer = combineReducers({
    [api.reducerPath]: api.reducer,
    // Not persisted: the access token and the cached API data stay in memory.
    auth: authReducer,
    // The only persisted slice, and only its whitelisted field.
    ui: persistReducer({ key: "tpj-ui", version: 1, storage, whitelist: ["lastEmail"] }, uiReducer),
  });

  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) =>
      getDefault({
        serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
      }).concat(api.middleware),
  });

  return { store, persistor: persistStore(store) };
}

export type AppStore = ReturnType<typeof makeStore>["store"];
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

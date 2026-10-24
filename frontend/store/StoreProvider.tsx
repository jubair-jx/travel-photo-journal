"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { Toaster } from "sonner";
import { useAppDispatch, useAppSelector } from "./hooks";
import { makeStore, restoreSession } from "./store";

// After a page load the in-memory access token is gone; the httpOnly refresh cookie brings the
// session back with one silent refresh. Until it settles, `auth.status` stays "unknown".
function SessionBootstrap({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);

  useEffect(() => {
    if (status === "unknown") void restoreSession(dispatch);
  }, [dispatch, status]);

  return children;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Created once per browser tab; the lazy initializer keeps it out of every re-render.
  const [{ store, persistor }] = useState(() => makeStore());

  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <MotionConfig reducedMotion="user">
          <SessionBootstrap>{children}</SessionBootstrap>
          <Toaster position="top-right" richColors closeButton />
        </MotionConfig>
      </PersistGate>
    </Provider>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { describeDevice } from "@/lib/device";
import { errorMessage } from "@/lib/errors";
import type { SessionInfo } from "@/lib/types";
import {
  api,
  useListSessionsQuery,
  useRevokeAllSessionsMutation,
  useRevokeSessionMutation,
} from "@/store/api";
import { useAppDispatch } from "@/store/hooks";
import { signedOut } from "@/store/slices";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function SessionRow({
  session,
  onRevoke,
  busy,
}: {
  session: SessionInfo;
  onRevoke: (session: SessionInfo) => void;
  busy: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-medium text-white">
          {describeDevice(session.userAgent)}
          {session.current && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-400/30">
              This device
            </span>
          )}
        </p>
        <p className="text-xs text-slate-400">
          Signed in {when(session.startedAt)} · Last active {when(session.lastActiveAt)}
        </p>
      </div>
      <Button
        variant="ghost"
        className="text-red-400"
        disabled={busy}
        onClick={() => onRevoke(session)}
      >
        {session.current ? "Sign out" : "Revoke"}
      </Button>
    </li>
  );
}

export function SessionsPanel() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { data, error, isLoading, refetch } = useListSessionsQuery();
  const [revoke, { isLoading: revoking }] = useRevokeSessionMutation();
  const [revokeAll, { isLoading: revokingAll }] = useRevokeAllSessionsMutation();

  const revokeOne = async (session: SessionInfo) => {
    const result = await revoke(session.id);
    if ("error" in result) {
      toast.error(errorMessage(result.error));
      return;
    }
    if (session.current) {
      dispatch(signedOut());
      dispatch(api.util.resetApiState());
      router.replace("/login");
      return;
    }
    toast.success("Device signed out");
  };

  const signOutEverywhere = async () => {
    const result = await revokeAll();
    if ("error" in result) {
      toast.error(errorMessage(result.error));
      return;
    }
    toast.success("Signed out of every device");
    router.replace("/login");
  };

  return (
    <Card className="mt-6 max-w-xl space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-white">Signed-in devices</h2>
        <p className="mt-1 text-sm text-slate-300">
          Anywhere you are signed in is listed here. Sign out a device you do not recognise.
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center py-4 text-orange-400">
          <Spinner label="Loading devices" />
        </div>
      )}

      {error && !data && (
        <div className="space-y-3">
          <Alert>{errorMessage(error)}</Alert>
          <Button variant="secondary" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && (
        <>
          <ul aria-label="Signed-in devices" className="space-y-3">
            {data.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onRevoke={(target) => void revokeOne(target)}
                busy={revoking || revokingAll}
              />
            ))}
          </ul>
          <Button variant="danger" loading={revokingAll} onClick={() => void signOutEverywhere()}>
            Sign out everywhere
          </Button>
          <p className="text-xs text-slate-400">
            A signed-out device can stay active for up to 15 minutes, until its short-lived access
            token expires.
          </p>
        </>
      )}
    </Card>
  );
}

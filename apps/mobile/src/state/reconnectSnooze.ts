import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";

import { appAtomRegistry } from "./atom-registry";
import { mobilePreferencesAtom, updateMobilePreferencesAtom } from "./preferences";

const NONE: ReadonlySet<EnvironmentId> = new Set();

/** Environments whose threads this device hides until they connect again. */
export const reconnectSnoozedAtom = Atom.make((get): ReadonlySet<EnvironmentId> => {
  const preferences = get(mobilePreferencesAtom);
  const ids = AsyncResult.isSuccess(preferences)
    ? preferences.value.reconnectSnoozedEnvironmentIds
    : undefined;
  return ids === undefined || ids.length === 0 ? NONE : new Set(ids);
}).pipe(
  Atom.withEquality(
    (a: ReadonlySet<EnvironmentId>, b: ReadonlySet<EnvironmentId>) =>
      a.size === b.size && [...a].every((id) => b.has(id)),
  ),
  Atom.withLabel("mobile:reconnect-snoozed-environments"),
);

/** Hides an environment's threads until it next connects. */
export function snoozeUntilReconnect(environmentId: EnvironmentId): void {
  appAtomRegistry.set(updateMobilePreferencesAtom, {
    transform: (current) => {
      const ids = current.reconnectSnoozedEnvironmentIds ?? [];
      return ids.includes(environmentId)
        ? {}
        : { reconnectSnoozedEnvironmentIds: [...ids, environmentId] };
    },
  });
}

/** Shows an environment's threads again. */
export function showReconnectSnoozed(environmentId: EnvironmentId): void {
  if (!appAtomRegistry.get(reconnectSnoozedAtom).has(environmentId)) return;
  appAtomRegistry.set(updateMobilePreferencesAtom, {
    transform: (current) => ({
      reconnectSnoozedEnvironmentIds: (current.reconnectSnoozedEnvironmentIds ?? []).filter(
        (id) => id !== environmentId,
      ),
    }),
  });
}

export function useReconnectSnoozed(): ReadonlySet<EnvironmentId> {
  return useAtomValue(reconnectSnoozedAtom);
}

import { useAtomValue } from "@effect/atom-react";
import { EnvironmentId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Atom } from "effect/reactivity";

import { readLocalStorageValue, writeLocalStorageValue } from "../hooks/useLocalStorage";
import { appAtomRegistry } from "../rpc/atomRegistry";

const STORAGE_KEY = "t3code:reconnect-snoozed-environments";
const StoredIds = Schema.Array(EnvironmentId);

/** Environments whose threads this device hides until they connect again. */
export const reconnectSnoozedAtom = Atom.make<ReadonlySet<EnvironmentId>>(
  new Set(readLocalStorageValue(STORAGE_KEY, [], StoredIds)),
).pipe(Atom.keepAlive, Atom.withLabel("reconnect-snoozed-environments"));

function writeReconnectSnoozed(next: ReadonlySet<EnvironmentId>): void {
  appAtomRegistry.set(reconnectSnoozedAtom, next);
  writeLocalStorageValue(STORAGE_KEY, [...next], [], StoredIds);
}

/** Hides an environment's threads until it next connects. */
export function snoozeUntilReconnect(environmentId: EnvironmentId): void {
  const current = appAtomRegistry.get(reconnectSnoozedAtom);
  if (current.has(environmentId)) return;
  writeReconnectSnoozed(new Set([...current, environmentId]));
}

/** Shows an environment's threads again. */
export function showReconnectSnoozed(environmentId: EnvironmentId): void {
  const current = appAtomRegistry.get(reconnectSnoozedAtom);
  if (!current.has(environmentId)) return;
  const next = new Set(current);
  next.delete(environmentId);
  writeReconnectSnoozed(next);
}

export function useReconnectSnoozed(): ReadonlySet<EnvironmentId> {
  return useAtomValue(reconnectSnoozedAtom);
}

import { reconnectSnoozesToClear } from "@t3tools/client-runtime/state/connections";
import { Atom } from "effect/reactivity";

import { appAtomRegistry } from "./atom-registry";
import { connectedEnvironmentIdsAtom } from "./presentation";
import { reconnectSnoozedAtom, showReconnectSnoozed } from "./reconnectSnooze";

const reconnectSnoozesToClearAtom = Atom.make((get) =>
  reconnectSnoozesToClear(get(reconnectSnoozedAtom), get(connectedEnvironmentIdsAtom)),
).pipe(Atom.withLabel("mobile:reconnect-snoozes-to-clear"));

/** Ends each snooze once its environment has connected, whatever screen is open. */
export function installReconnectSnoozeClearing(): () => void {
  return appAtomRegistry.subscribe(
    reconnectSnoozesToClearAtom,
    (environmentIds) => {
      for (const environmentId of environmentIds) showReconnectSnoozed(environmentId);
    },
    { immediate: true },
  );
}

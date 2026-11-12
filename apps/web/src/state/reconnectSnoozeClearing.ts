import { reconnectSnoozesToClear } from "@t3tools/client-runtime/state/connections";
import { Atom } from "effect/reactivity";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { environmentSummaries } from "./presentation";
import { reconnectSnoozedAtom, showReconnectSnoozed } from "./reconnectSnooze";

const reconnectSnoozesToClearAtom = Atom.make((get) =>
  reconnectSnoozesToClear(
    get(reconnectSnoozedAtom),
    get(environmentSummaries.connectedEnvironmentIdsAtom),
  ),
).pipe(Atom.withLabel("reconnect-snoozes-to-clear"));

/** Ends each snooze once its environment has connected, wherever the app is showing. */
export function startReconnectSnoozeClearing(): () => void {
  return appAtomRegistry.subscribe(
    reconnectSnoozesToClearAtom,
    (environmentIds) => {
      for (const environmentId of environmentIds) showReconnectSnoozed(environmentId);
    },
    { immediate: true },
  );
}

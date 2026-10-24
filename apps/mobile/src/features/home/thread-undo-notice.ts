import * as ThreadUndo from "@t3tools/client-runtime/state/thread-undo";
import { useSyncExternalStore } from "react";
import { AsyncResult } from "effect/reactivity";
import { appAtomRegistry } from "../../state/atom-registry";
import { mobilePreferencesAtom } from "../../state/preferences";

type UndoNotice = {
  readonly action: "Settled" | "Snoozed" | "Unpinned";
  readonly claim: ReturnType<typeof ThreadUndo.begin>;
  readonly undo: () => Promise<void>;
};

let notice: UndoNotice | null = null;
let expiry: ReturnType<typeof setTimeout> | undefined;
let unsubscribePreferences: (() => void) | undefined;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function readThreadUndoNotice() {
  return notice;
}

export function dismissThreadUndoNotice() {
  const previous = notice;
  notice = null;
  clearTimeout(expiry);
  unsubscribePreferences?.();
  unsubscribePreferences = undefined;
  previous?.claim.finish();
  notify();
}

ThreadUndo.subscribe(() => {
  if (notice !== null && !notice.claim.isCurrent()) dismissThreadUndoNotice();
});

function threadUndoNoticesEnabled() {
  const preferences = appAtomRegistry.get(mobilePreferencesAtom);
  return !AsyncResult.isSuccess(preferences) || preferences.value.showThreadUndoNotices !== false;
}

export function showThreadUndoNotice(options: UndoNotice) {
  if (!options.claim.isCurrent()) return;
  dismissThreadUndoNotice();
  if (!threadUndoNoticesEnabled()) {
    options.claim.finish();
    return;
  }
  notice = {
    ...options,
    undo: async () => {
      if (notice?.claim !== options.claim || !options.claim.isCurrent()) return;
      dismissThreadUndoNotice();
      await options.undo();
    },
  };
  unsubscribePreferences = appAtomRegistry.subscribe(mobilePreferencesAtom, () => {
    if (!threadUndoNoticesEnabled()) dismissThreadUndoNotice();
  });
  notify();
  expiry = setTimeout(dismissThreadUndoNotice, 5_000);
}

export function useThreadUndoNotice() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, readThreadUndoNotice);
}

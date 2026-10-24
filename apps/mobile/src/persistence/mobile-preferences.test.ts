import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { vi } from "vite-plus/test";

vi.mock("expo-secure-store", () => ({}));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

import * as MobileDatabase from "./mobile-database";
import * as MobilePreferences from "./mobile-preferences";
import * as MobileSecureStorage from "./mobile-secure-storage";

function preferencesStore(initialPayload = "{}") {
  let stored = { payload: initialPayload, updatedAt: 0 };
  const database = MobileDatabase.MobileDatabase.of({
    loadCache: () => Effect.succeed(Option.none()),
    listCache: () => Effect.succeed([]),
    saveCache: () => Effect.void,
    removeCache: () => Effect.void,
    clearCacheKind: () => Effect.void,
    clearEnvironmentCache: () => Effect.void,
    clearAllCaches: Effect.void,
    inspectCaches: Effect.succeed([]),
    loadPreferencesJson: Effect.sync(() => Option.some(stored)),
    savePreferencesJson: (payload, updatedAt) =>
      Effect.sync(() => {
        stored = { payload, updatedAt };
      }),
  });
  return MobilePreferences.make().pipe(
    Effect.provideService(MobileDatabase.MobileDatabase, database),
    Effect.provideService(MobileSecureStorage.MobileSecureStorage, {
      getItem: () => Effect.succeed(null),
      setItem: () => Effect.void,
      removeItem: () => Effect.void,
    }),
  );
}

describe("thread undo notice preference", () => {
  it.effect("keeps the opt-out across reloads and unrelated preference updates", () =>
    Effect.gen(function* () {
      const makeStore = preferencesStore();
      const store = yield* makeStore;
      yield* store.savePatch({ showThreadUndoNotices: false });
      const reopened = yield* makeStore;
      expect(yield* reopened.load).toEqual({ showThreadUndoNotices: false });
      yield* reopened.savePatch({ baseFontSize: 18 });
      expect(yield* store.load).toEqual({ showThreadUndoNotices: false, baseFontSize: 18 });
      yield* reopened.savePatch({ showThreadUndoNotices: true });
      expect(yield* store.load).toEqual({ showThreadUndoNotices: true, baseFontSize: 18 });
    }),
  );

  it.effect("ignores malformed values so existing installs retain the enabled default", () =>
    Effect.gen(function* () {
      for (const payload of ["{}", '{"showThreadUndoNotices":"false"}']) {
        const store = yield* preferencesStore(payload);
        expect(yield* store.load).toEqual({});
      }
    }),
  );
});

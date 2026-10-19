import { Keyboard, TextInput } from "react-native";

// Dismisses the soft keyboard when one is really open; returns whether it did.
export function dismissOpenKeyboard(): boolean {
  // Keyboard.isVisible() is cached from show/hide events, and Android can drop the hide event when
  // the app is backgrounded mid-hide, leaving it true for good. A focused input confirms it.
  if (!Keyboard.isVisible() || TextInput.State.currentlyFocusedInput() == null) return false;
  Keyboard.dismiss();
  return true;
}

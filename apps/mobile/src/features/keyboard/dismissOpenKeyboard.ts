import { KeyboardController } from "react-native-keyboard-controller";

// Dismisses the soft keyboard when one is really open; returns whether it did.
export function dismissOpenKeyboard(): boolean {
  // RN's Keyboard and TextInputState miss the chat composer, a custom native EditText. The
  // keyboard controller tracks the IME natively and resyncs on resume, so it sees the composer.
  if (!KeyboardController.isVisible()) return false;
  void KeyboardController.dismiss();
  return true;
}

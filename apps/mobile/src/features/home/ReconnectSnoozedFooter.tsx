import type { EnvironmentId } from "@t3tools/contracts";
import { Pressable, View } from "react-native";

import { AppText as Text } from "../../components/ui/AppText";
import { showReconnectSnoozed, useReconnectSnoozed } from "../../state/reconnectSnooze";

/** Names each device hidden until it reconnects, with a way to show it now. */
export function ReconnectSnoozedFooter(props: {
  readonly environments: ReadonlyArray<{
    readonly environmentId: EnvironmentId;
    readonly label: string;
  }>;
}) {
  const snoozed = useReconnectSnoozed();
  const hidden = props.environments.filter((environment) => snoozed.has(environment.environmentId));
  if (hidden.length === 0) return null;
  return (
    <View className="gap-1 px-4 py-3">
      {hidden.map((environment) => (
        <View key={environment.environmentId} className="flex-row items-center gap-2">
          <Text className="min-w-0 flex-shrink text-xs text-foreground-muted" numberOfLines={1}>
            {`${environment.label} hidden until it reconnects`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Show ${environment.label} threads`}
            hitSlop={8}
            className="active:opacity-70"
            onPress={() => showReconnectSnoozed(environment.environmentId)}
          >
            <Text className="text-xs font-t3-bold text-foreground">Show</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

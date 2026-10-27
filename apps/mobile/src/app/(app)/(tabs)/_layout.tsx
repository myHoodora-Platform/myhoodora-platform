import { Tabs } from "expo-router";
import { useRouter } from "@/core/navigation/use-router";
import { Home, Search, ShoppingBag, SquarePen } from "lucide-react-native";
import type { ComponentProps } from "react";
import { useTheme } from "@/shared/theme/theme";
import { FloatingTabBar } from "@/shared/ui/floating-tab-bar";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS = { "news-feed": Home, search: Search, "for-sale": ShoppingBag } as const;

/**
 * Nextdoor's bar: Home · Search · For Sale, with "Post" beside it. Notifications, Messages and your
 * profile sit at the top of the feed, as on Nextdoor (and the web's header).
 */
export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  const tabBar = ({ state, descriptors, navigation }: TabBarProps) => (
    <FloatingTabBar
      action={{ label: "Post", Icon: SquarePen, onPress: () => router.push("/compose") }}
      items={state.routes.map((route, index) => {
        const focused = state.index === index;
        return {
          key: route.key,
          label: descriptors[route.key]?.options.title ?? route.name,
          Icon: ICONS[route.name as keyof typeof ICONS] ?? Home,
          focused,
          // React Navigation's own tab press: lets a screen react (e.g. scroll to top) and skips re-navigating.
          onPress: () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          },
          onLongPress: () => navigation.emit({ type: "tabLongPress", target: route.key }),
        };
      })}
    />
  );
  return (
    <Tabs tabBar={tabBar} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.colors.canvas } }}>
      <Tabs.Screen name="news-feed" options={{ title: "Home" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="for-sale" options={{ title: "For Sale" }} />
    </Tabs>
  );
}

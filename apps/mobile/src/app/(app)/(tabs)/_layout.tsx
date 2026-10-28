import { Tabs } from "expo-router";
import { useRouter } from "@/core/navigation/use-router";
import { Home, Menu, ShoppingBag, SquarePen } from "lucide-react-native";
import type { ComponentProps } from "react";
import { useTheme } from "@/shared/theme/theme";
import { FloatingTabBar } from "@/shared/ui/floating-tab-bar";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const ICONS = { "news-feed": Home, "for-sale": ShoppingBag, menu: Menu } as const;

/**
 * Home · For Sale · Menu, with "Post" beside them. Search, Notifications and Messages sit in the top
 * bar of every tab (features/navigation/top-actions), so each is one tap from anywhere.
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
      <Tabs.Screen name="for-sale" options={{ title: "For Sale" }} />
      <Tabs.Screen name="menu" options={{ title: "Menu" }} />
    </Tabs>
  );
}

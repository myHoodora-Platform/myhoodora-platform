import type { AlertCategory } from "@myhoodora/api-contract/types";
import type { LucideIcon } from "lucide-react-native";
import { BadgeAlert, Car, Droplets, Flame, Megaphone, ShieldAlert, Waves, Zap } from "lucide-react-native";
import { ALERT_KINDS } from "@/features/compose/compose-rules";

/** The web's alert kinds (features/feed/categories.ts) with an icon each, in the composer's order. */
const ICONS: Record<AlertCategory, LucideIcon> = {
  security: ShieldAlert,
  power: Zap,
  water: Droplets,
  flooding: Waves,
  traffic: Car,
  fire: Flame,
  scam: BadgeAlert,
  other: Megaphone,
};

export const ALERT_TYPES = ALERT_KINDS.map((k) => ({ ...k, Icon: ICONS[k.id] }));

export function alertKind(id: AlertCategory | undefined) {
  return ALERT_TYPES.find((k) => k.id === (id ?? "other")) ?? ALERT_TYPES[ALERT_TYPES.length - 1]!;
}

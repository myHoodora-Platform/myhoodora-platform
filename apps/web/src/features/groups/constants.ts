import { Briefcase, Building2, Globe, Heart, Home, Lock, MapPinned, Shield, Sparkles, Users, type LucideIcon } from "lucide-react";
import type { GroupBoundary, GroupCategory, GroupPrivacy } from "@/lib/api/types";

export const GROUP_CATEGORY: Record<GroupCategory, { label: string; icon: LucideIcon; tone: string }> = {
  safety: { label: "Safety", icon: Shield, tone: "bg-danger-soft text-destructive" },
  estate: { label: "Estate & street", icon: Building2, tone: "bg-primary/10 text-primary" },
  parents: { label: "Parents", icon: Heart, tone: "bg-warning-soft text-warning" },
  hobbies: { label: "Hobbies", icon: Sparkles, tone: "bg-info-soft text-info" },
  business: { label: "Local business", icon: Briefcase, tone: "bg-secondary text-foreground" },
  other: { label: "Community", icon: Users, tone: "bg-secondary text-foreground" },
};

export const PRIVACY_OPTIONS: { id: GroupPrivacy; label: string; icon: LucideIcon; points: string[] }[] = [
  {
    id: "open",
    label: "Open",
    icon: Globe,
    points: ["Anyone who can find it joins instantly", "Posts and members are visible to non-members"],
  },
  {
    id: "private",
    label: "Private",
    icon: Lock,
    points: ["Neighbours ask to join and an admin approves them", "Only members see posts and the member list"],
  },
];

export const BOUNDARY_OPTIONS: { id: GroupBoundary; label: string; description: string; icon: LucideIcon }[] = [
  { id: "neighbourhood", label: "My neighbourhood", description: "Only neighbours in your neighbourhood can find it", icon: Home },
  { id: "nearby", label: "Nearby neighbourhoods", description: "Also neighbourhoods around yours", icon: MapPinned },
  { id: "city", label: "Whole city", description: "Anyone on myHoodora in your city", icon: Building2 },
];

export function boundaryLabel(b: GroupBoundary): string {
  return BOUNDARY_OPTIONS.find((o) => o.id === b)?.label ?? b;
}

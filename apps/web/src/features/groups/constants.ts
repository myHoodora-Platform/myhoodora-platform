import { Briefcase, Building2, Heart, Shield, Sparkles, Users, type LucideIcon } from "lucide-react";
import type { Group } from "@/lib/api/types";

export const GROUP_CATEGORY: Record<Group["category"], { label: string; icon: LucideIcon; tone: string }> = {
  safety: { label: "Safety", icon: Shield, tone: "bg-danger-soft text-destructive" },
  estate: { label: "Estate & street", icon: Building2, tone: "bg-primary/10 text-primary" },
  parents: { label: "Parents", icon: Heart, tone: "bg-warning-soft text-warning" },
  hobbies: { label: "Hobbies", icon: Sparkles, tone: "bg-info-soft text-info" },
  business: { label: "Local business", icon: Briefcase, tone: "bg-secondary text-foreground" },
  other: { label: "Community", icon: Users, tone: "bg-secondary text-foreground" },
};

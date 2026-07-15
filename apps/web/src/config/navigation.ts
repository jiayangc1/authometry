import {
  Activity,
  AppWindow,
  BookOpen,
  Boxes,
  CircleGauge,
  FileClock,
  Github,
  KeyRound,
  ListTree,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
}

export const navigation: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "General",
    items: [
      { label: "Overview", href: "/overview", icon: CircleGauge },
      { label: "Applications", href: "/applications", icon: AppWindow },
      { label: "Users", href: "/users", icon: Users },
      { label: "Sessions", href: "/sessions", icon: FileClock },
    ],
  },
  {
    label: "Authorization",
    items: [
      { label: "Traces", href: "/traces", icon: ListTree },
      { label: "Scopes", href: "/scopes", icon: KeyRound },
      { label: "Policies", href: "/policies", icon: ShieldCheck },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Events", href: "/events", icon: Activity },
      { label: "Deployments", href: "/deployments", icon: Boxes },
      { label: "Settings", href: "/settings/general", icon: Settings },
    ],
  },
];

export const utilityNavigation: NavigationItem[] = [
  { label: "Documentation", href: "/docs", icon: BookOpen },
  { label: "API reference", href: "/developer/playground", icon: ScrollText },
  {
    label: "GitHub",
    href: "https://github.com/jiayangc1/authometry",
    icon: Github,
    external: true,
  },
];

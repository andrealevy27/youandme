import {
  Bell,
  Bookmark,
  Briefcase,
  Compass,
  Home,
  MessageCircle,
  Rocket,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: "messages" | "notifications" };

/** Desktop sidebar: every primary destination. */
export const SIDEBAR_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/matches", label: "Matches", icon: Users },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/consultants", label: "Consultants", icon: Briefcase },
  { href: "/ai", label: "You&Me AI", icon: Sparkles },
  { href: "/messages", label: "Messages", icon: MessageCircle, badge: "messages" },
  { href: "/startup", label: "Startup", icon: Rocket },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
];

/** Mobile bottom bar: five thumb-reachable destinations; AI sits in the centre. */
export const MOBILE_NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/ai", label: "AI", icon: Sparkles },
  { href: "/messages", label: "Messages", icon: MessageCircle, badge: "messages" },
];

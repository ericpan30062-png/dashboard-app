import {
  LayoutDashboard,
  Calendar,
  GraduationCap,
  NotebookText,
  Sparkles,
  Settings,
  FileUp,
  Flame,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/priorities", label: "Priorities", icon: Flame },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/courses", label: "Courses", icon: GraduationCap },
  { href: "/dashboard/syllabus", label: "Syllabus", icon: FileUp },
  { href: "/dashboard/notes", label: "Notes", icon: NotebookText },
  { href: "/dashboard/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

import type { Role } from '@/types';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Contact,
  CalendarClock,
  BellRing,
  PhoneCall,
  ClipboardList,
  MessageCircle,
  BarChart3,
  History,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles: Role[];
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, roles: ['admin', 'team_lead', 'staff'] },
  { label: 'Leads', to: '/leads', icon: Contact, roles: ['admin', 'team_lead', 'staff'] },
  { label: 'Meetings', to: '/meetings', icon: CalendarClock, roles: ['admin', 'team_lead', 'staff'] },
  { label: 'Follow-ups', to: '/follow-ups', icon: BellRing, roles: ['admin', 'team_lead', 'staff'] },
  { label: 'Call Logs', to: '/call-logs', icon: PhoneCall, roles: ['admin', 'team_lead', 'staff'] },
  { label: 'Tasks', to: '/tasks', icon: ClipboardList, roles: ['admin', 'team_lead', 'staff'] },
  { label: 'WhatsApp', to: '/whatsapp', icon: MessageCircle, roles: ['admin', 'team_lead', 'staff'] },
  { label: 'Reports', to: '/reports', icon: BarChart3, roles: ['admin', 'team_lead'] },
  { label: 'Users', to: '/users', icon: Users, roles: ['admin'] },
  { label: 'Team Leads', to: '/team-leads', icon: UserCog, roles: ['admin'] },
  { label: 'Staff', to: '/staff', icon: UserCog, roles: ['admin', 'team_lead'] },
  { label: 'Activity Logs', to: '/activity-logs', icon: History, roles: ['admin', 'team_lead'] },
  { label: 'Settings', to: '/settings', icon: Settings, roles: ['admin'] },
];

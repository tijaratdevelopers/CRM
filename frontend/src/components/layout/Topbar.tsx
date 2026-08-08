import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Menu, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';
import { useProject } from '@/features/projects/ProjectContext';
import { supabase } from '@/lib/supabaseClient';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PasswordField } from '@/components/PasswordField';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { GlobalSearch } from './GlobalSearch';

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setError(undefined);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      toast.error(updateError.message);
      return;
    }

    toast.success('Password updated');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Set a new password for your account.</DialogDescription>
        </DialogHeader>
        <PasswordField id="new-password" value={password} onChange={setPassword} placeholder="New password" />
        <PasswordField
          id="confirm-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={error}
          placeholder="Confirm new password"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Saving…' : 'Update password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ALL_PROJECTS = '__all__';

function ProjectSwitcher() {
  const { profile } = useAuth();
  const { projects, selectedProjectId, setSelectedProjectId } = useProject();

  if (!profile || profile.role === 'staff' || projects.length === 0) return null;

  return (
    <Select
      value={selectedProjectId ?? ALL_PROJECTS}
      onValueChange={(value) => setSelectedProjectId(value === ALL_PROJECTS ? null : value)}
    >
      <SelectTrigger className="hidden h-9 w-[180px] sm:flex">
        <SelectValue placeholder="All projects" />
      </SelectTrigger>
      <SelectContent>
        {profile.role === 'admin' && <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>}
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  staff: 'Staff',
};

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  const initials = profile?.full_name
    ?.split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-card/80 px-4 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2">
        <ProjectSwitcher />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent">
            <Avatar className="h-7 w-7 ring-2 ring-emerald-500/30 transition-transform hover:scale-105">
              <AvatarFallback className="bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-800 text-amber-200">
                {initials || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <span className="hidden flex-col items-start text-left sm:flex">
              <span className="font-medium leading-tight">{profile?.full_name}</span>
              <Badge variant="secondary" className="px-1 py-0 text-[10px] leading-tight">
                {profile ? ROLE_LABEL[profile.role] : ''}
              </Badge>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Change password
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </header>
  );
}

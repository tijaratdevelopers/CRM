import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import type { Project } from '@/types';

const STORAGE_KEY = 'selected-project-id';

interface ProjectContextValue {
  projects: Project[];
  isLoading: boolean;
  /** null means "all projects" — only meaningful for admins viewing org-wide data. */
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
}

const ProjectContext = React.createContext<ProjectContextValue | undefined>(undefined);

async function fetchProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>('/projects');
  return data;
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [selectedProjectId, setSelectedProjectIdState] = React.useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY),
  );

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    enabled: !!profile,
  });

  const projects = projectsQuery.data ?? [];

  // Keep the selection valid: if the stored id no longer exists, fall back to
  // the first available project (or "all" for admins) instead of a dead filter.
  React.useEffect(() => {
    if (projects.length === 0) return;
    const stillExists = projects.some((p) => p.id === selectedProjectId);
    if (!stillExists) {
      const fallback = profile?.role === 'admin' ? null : (projects[0]?.id ?? null);
      setSelectedProjectIdState(fallback);
      if (fallback) localStorage.setItem(STORAGE_KEY, fallback);
      else localStorage.removeItem(STORAGE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const setSelectedProjectId = React.useCallback((id: string | null) => {
    setSelectedProjectIdState(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = React.useMemo(
    () => ({
      projects,
      isLoading: projectsQuery.isLoading,
      selectedProjectId,
      setSelectedProjectId,
    }),
    [projects, projectsQuery.isLoading, selectedProjectId, setSelectedProjectId],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const ctx = React.useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within a ProjectProvider');
  return ctx;
}

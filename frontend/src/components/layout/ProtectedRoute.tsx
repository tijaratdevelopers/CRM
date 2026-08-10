import * as React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { FullScreenLoader } from '@/components/FullScreenLoader';
import { AppLayout } from './AppLayout';

export function ProtectedRoute() {
  const { session, loading } = useAuth();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

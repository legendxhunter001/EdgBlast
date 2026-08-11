import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { BrandLoading } from './BrandLoading';

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <BrandLoading />;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

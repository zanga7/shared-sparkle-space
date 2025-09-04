import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import ColumnBasedDashboard from '@/components/ColumnBasedDashboard';
import { AdminProvider } from '@/contexts/AdminContext';
import { RecurrenceDataTest } from '@/components/RecurrenceDataTest';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background w-full">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-semibold">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <AdminProvider>
      <div className="min-h-screen bg-background w-full">
        <RecurrenceDataTest />
        <ColumnBasedDashboard />
      </div>
    </AdminProvider>
  );
};

export default Index;

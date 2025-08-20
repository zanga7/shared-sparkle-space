import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChildLogin } from '@/components/ChildLogin';
import { ChildAuthProvider, useChildAuth } from '@/hooks/useChildAuth';
import { useAuth } from '@/hooks/useAuth';

const ChildAuthContent = () => {
  const { isChildAuthenticated } = useChildAuth();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If parent is logged in, redirect to main app
    if (user) {
      navigate('/');
      return;
    }
    
    // If child is authenticated, redirect to main app
    if (isChildAuthenticated) {
      navigate('/');
    }
  }, [user, isChildAuthenticated, navigate]);

  return <ChildLogin />;
};

const ChildAuth = () => {
  return (
    <ChildAuthProvider>
      <ChildAuthContent />
    </ChildAuthProvider>
  );
};

export default ChildAuth;
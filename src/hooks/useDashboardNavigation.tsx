import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export function useDashboardNavigation() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'everyone' | 'member'>('everyone');
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string | null>(null);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSelectedMemberFilter(null);
    setViewMode('everyone');
  }, []);

  const handleMemberSelect = useCallback((memberId: string | null) => {
    setSelectedMemberFilter(memberId);
    if (memberId === null) {
      setViewMode('everyone');
      setActiveTab('columns');
    } else {
      setViewMode('member');
      setActiveTab('');
    }
  }, []);

  const handleSettingsClick = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  return {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    selectedMemberFilter,
    setSelectedMemberFilter,
    handleTabChange,
    handleMemberSelect,
    handleSettingsClick,
  };
}

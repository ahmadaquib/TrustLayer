import React from 'react';
import { AnalyticsDashboardView } from '../../components/dashboard/AnalyticsDashboardView';
import type { UserProfile } from '../../types';

interface DashboardPageProps {
  currentUser: UserProfile;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ currentUser }) => {
  return <AnalyticsDashboardView currentUser={currentUser} />;
};

export default DashboardPage;

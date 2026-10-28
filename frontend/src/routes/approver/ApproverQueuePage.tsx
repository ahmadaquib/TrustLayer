import React from 'react';
import { ApproverQueueView } from '../../components/approval/ApproverQueueView';
import type { UserProfile } from '../../types';

interface ApproverQueuePageProps {
  currentUser: UserProfile;
}

export const ApproverQueuePage: React.FC<ApproverQueuePageProps> = ({ currentUser }) => {
  return <ApproverQueueView currentUser={currentUser} />;
};

export default ApproverQueuePage;

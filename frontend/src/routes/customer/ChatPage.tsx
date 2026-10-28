import React from 'react';
import { ChatView } from '../../components/chat/ChatView';
import type { UserProfile } from '../../types';

interface ChatPageProps {
  currentUser: UserProfile;
}

export const ChatPage: React.FC<ChatPageProps> = ({ currentUser }) => {
  return <ChatView currentUser={currentUser} />;
};

export default ChatPage;

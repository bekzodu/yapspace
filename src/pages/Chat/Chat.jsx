import React from 'react';
import { usePageTitle } from '../../hooks/usePageTitle';
import LocalVideo from '../../components/LocalVideo/LocalVideo';
import RemoteVideo from '../../components/RemoteVideo/RemoteVideo';
import './Chat.css';

const Chat = () => {
  usePageTitle('Chat');

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="video-grid">
          <div className="video-item">
            <LocalVideo />
          </div>
          <div className="video-item">
            <RemoteVideo />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;

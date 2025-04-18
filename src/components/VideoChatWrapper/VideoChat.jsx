import React from 'react';
import LocalVideo from '../LocalVideo/LocalVideo';
import RemoteVideo from '../RemoteVideo/RemoteVideo';
import './VideoChat.css';

const VideoChat = () => {
  return (
    <div className="video-chat-container">
      <LocalVideo />
      <RemoteVideo />
    </div>
  );
};

export default VideoChat;

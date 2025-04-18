import React, { useEffect, useRef, useState } from 'react';
import { webRTCState } from '../../webrtc/webRTCGlobal';
import './RemoteVideo.css';

const RemoteVideo = () => {
  const videoRef = useRef(null);
  const [hasStream, setHasStream] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [remoteDisconnected, setRemoteDisconnected] = useState(false);

  // Function to update video stream
  const updateVideoStream = (stream) => {
    console.log('Updating video stream:', stream);
    
    if (!stream || stream.getTracks().length === 0) {
      console.warn('No tracks in stream to display');
      setHasStream(false);
      return;
    }
    
    try {
      if (videoRef.current) {
        // Check if the stream has different tracks than current
        const currentTracks = videoRef.current.srcObject?.getTracks() || [];
        const newTracks = stream.getTracks();
        
        // Only update if stream is different
        const needsUpdate = 
          !videoRef.current.srcObject || 
          currentTracks.length !== newTracks.length ||
          !currentTracks.every(track => 
            newTracks.some(newTrack => 
              newTrack.kind === track.kind && newTrack.id === track.id
            )
          );
        
        if (needsUpdate) {
          console.log('Setting new srcObject on video element');
          videoRef.current.srcObject = stream;
          
          // Check which tracks are available
          const videoTracks = stream.getVideoTracks();
          const audioTracks = stream.getAudioTracks();
          console.log(`Remote stream has ${videoTracks.length} video and ${audioTracks.length} audio tracks`);
          
          setHasStream(true);
          setStreamError(null);
          
          // Force video element to load new stream (only if not already playing)
          if (videoRef.current.paused) {
            videoRef.current.load();
            videoRef.current.play().catch(e => {
              console.error('Error playing video:', e);
              setStreamError(`Error playing video: ${e.message}`);
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating video stream:', error);
      setStreamError(`Error updating stream: ${error.message}`);
    }
  };

  useEffect(() => {
    console.log('RemoteVideo component mounted');
    
    // Set up stream update handler immediately
    webRTCState.onStreamUpdate = (stream) => {
      console.log('Stream update callback triggered:', stream);
      updateVideoStream(stream);
    };

    // Initial setup - check if we already have a remote stream
    if (webRTCState.remoteStream) {
      console.log('Initial remote stream exists, updating video');
      updateVideoStream(webRTCState.remoteStream);
    }

    // Monitor peer connection state for disconnections
    const connectionMonitor = setInterval(() => {
      if (webRTCState.pc) {
        const connectionState = webRTCState.pc.connectionState;
        const iceConnectionState = webRTCState.pc.iceConnectionState;
        
        // Check for disconnected states
        if (connectionState === 'disconnected' || 
            connectionState === 'failed' || 
            connectionState === 'closed' ||
            iceConnectionState === 'disconnected' ||
            iceConnectionState === 'failed' ||
            iceConnectionState === 'closed') {
          
          console.log('Remote peer disconnected detected');
          setRemoteDisconnected(true);
        } else {
          setRemoteDisconnected(false);
        }
      }
    }, 1000);

    // Cleanup
    return () => {
      console.log('RemoteVideo component unmounting, clearing callbacks');
      webRTCState.onStreamUpdate = null;
      clearInterval(connectionMonitor);
    };
  }, [hasStream]);

  return (
    <div className="remote-video-container">
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        className="remote-video"
      />
      
      {remoteDisconnected && (
        <div className="disconnection-overlay">
          <div className="disconnection-message">
            <div className="disconnection-icon">❌</div>
            <p>Remote user disconnected</p>
            <p className="disconnection-tip">The other person has left the call</p>
          </div>
        </div>
      )}
      
      {!hasStream && !remoteDisconnected && (
        <div className="waiting-message">
          <p>Waiting for remote stream...</p>
          <p className="connection-tip">Make sure the other person has joined the call</p>
        </div>
      )}
      
      {streamError && (
        <div className="stream-error">
          {streamError}
        </div>
      )}
    </div>
  );
};

export default RemoteVideo;

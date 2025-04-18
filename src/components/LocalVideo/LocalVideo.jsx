import React, { useEffect, useRef, useState } from 'react';
import { 
  setupMediaSources, 
  searchForPartner,
  cancelSearch, 
  cleanup, 
  webRTCState, 
  initializePeerConnection 
} from '../../webrtc/webRTCGlobal';
import TextSender from '../textSender/textSender';
import './LocalVideo.css';

const LocalVideo = () => {
  const videoRef = useRef(null);
  const [callId, setCallId] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    initializeWebRTC();
    
    return () => {
      console.log('LocalVideo component unmounting, cleaning up WebRTC');
      cleanup();
    };
  }, []);

  const initializeWebRTC = async () => {
    try {
      console.log('Initializing WebRTC...');
      initializePeerConnection();
      
      // Add connection state change listener
      if (webRTCState.pc) {
        webRTCState.pc.onconnectionstatechange = () => {
          console.log('Connection state changed:', webRTCState.pc.connectionState);
          
          // If connection is closed or failed, cleanup
          if (webRTCState.pc.connectionState === 'disconnected' || 
              webRTCState.pc.connectionState === 'failed' ||
              webRTCState.pc.connectionState === 'closed') {
            console.log('Peer disconnected, cleaning up call');
            handleEndCall();
          }
        };
      }
      
      const localStream = await setupMediaSources();
      
      if (videoRef.current && localStream) {
        videoRef.current.srcObject = localStream;
      }
      
      setError(null);
    } catch (err) {
      console.error('Error initializing WebRTC:', err);
      setError(`Failed to access camera/microphone: ${err.message}`);
    }
  };

  const handleSearch = async () => {
    try {
      setIsSearching(true);
      setStatus('searching');
      setError(null);
      
      if (!webRTCState.localStream || webRTCState.localStream.getTracks().length === 0) {
        await initializeWebRTC();
      }
      
      const id = await searchForPartner();
      setCallId(id);
      
      if (webRTCState.callRole === 'callee') {
        setStatus('connected');
        console.log('Connected to call with ID:', id);
      } else {
        setStatus('waiting');
        console.log('Created waiting room with ID:', id);
      }
    } catch (err) {
      console.error('Error finding partner:', err);
      setError(`Failed to find partner: ${err.message}`);
      setStatus('disconnected');
    } finally {
      setIsSearching(false);
    }
  };

  const handleEndCall = async () => {
    console.log('Ending call explicitly');
    
    setStatus('disconnecting'); // Show disconnecting state
    
    try {
      // Explicitly await the cleanup
      await cleanup();
      console.log('Cleanup completed in handleEndCall');
      
      // Reset UI state
      setStatus('disconnected');
      setCallId('');
      setError(null);
      
      // Reinitialize for next call
      setTimeout(() => {
        initializeWebRTC();
      }, 500);
    } catch (err) {
      console.error('Error during end call:', err);
      setError(`Failed to end call properly: ${err.message}`);
      setStatus('disconnected');
    }
  };

  // Add an effect to monitor connection state changes
  useEffect(() => {
    // Set up a connection monitor
    const connectionMonitor = setInterval(() => {
      if (webRTCState.pc && 
         (webRTCState.pc.connectionState === 'disconnected' || 
          webRTCState.pc.connectionState === 'failed' || 
          webRTCState.pc.connectionState === 'closed')) {
        
        console.log('Connection lost, ending call');
        handleEndCall();
      }
    }, 2000);
    
    return () => {
      clearInterval(connectionMonitor);
    };
  }, []);

  // Add a handler for canceling search
  const handleCancelSearch = async () => {
    console.log('Canceling search explicitly');
    setStatus('canceling'); // Show canceling state
    
    try {
      // Explicitly await the cancelSearch
      await cancelSearch();
      console.log('Search canceled successfully');
      
      setStatus('disconnected');
      setIsSearching(false);
      setCallId('');
    } catch (err) {
      console.error('Error canceling search:', err);
      setError(`Failed to cancel search: ${err.message}`);
      setStatus('disconnected');
    }
  };

  return (
    <div className="local-video-container">
      <video 
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="local-video"
      />
      
      <div className="call-controls">
        {status === 'disconnected' ? (
          <button 
            onClick={handleSearch} 
            className="call-button"
            disabled={isSearching || (!!error && error.includes('camera/microphone'))}
          >
            {isSearching ? 'Searching...' : '🔍 Find a random partner'}
          </button>
        ) : status === 'searching' ? (
          <button 
            onClick={handleCancelSearch} 
            className="cancel-button"
          >
            Cancel Search
          </button>
        ) : (
          <button onClick={handleEndCall} className="end-call-button">
            End Call
          </button>
        )}

        {error && (
          <div className="error-message">
            {error}
            {error.includes('camera/microphone') && (
              <button 
                onClick={initializeWebRTC} 
                className="retry-button"
              >
                Retry Camera Access
              </button>
            )}
          </div>
        )}

        <div className="connection-status">
          Status: {status}
        </div>
      </div>
      <TextSender />
    </div>
  );
};

export default LocalVideo;

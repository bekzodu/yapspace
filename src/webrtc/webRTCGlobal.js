import { getFirestore, collection, doc, setDoc, onSnapshot, getDoc, addDoc, query, where, orderBy, limit, getDocs, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { app } from '../firebase/firebase';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const db = getFirestore(app);

// Initialize auth
export const auth = getAuth(app);

// Sign in anonymously on module load
signInAnonymously(auth)
  .catch(err => console.error('Auth error:', err));

onAuthStateChanged(auth, user => {
  if (user) {
    console.log('Signed in anonymously as', user.uid);
  }
});

const servers = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ],
    },
    // Add a TURN server for better connectivity
    {
      urls: 'turn:numb.viagenie.ca',
      username: 'webrtc@live.com',
      credential: 'muazkh'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

// Global State
export const webRTCState = {
  pc: null,
  localStream: null,
  remoteStream: null,
  onStreamUpdate: null,
  callRole: null, // 'caller' or 'callee' to determine ICE candidate handling
  currentCallDoc: null,
};

// Add this function to get ICE servers from Twilio
const getTwilioIceServers = async () => {
  try {
    // Use your Firebase Cloud Function URL
    const functionUrl = 'https://us-central1-yapspace-app.cloudfunctions.net/getIceServers';
    
    console.log('🔄 Requesting ICE servers from Cloud Function...');
    
    const response = await fetch(functionUrl);
    
    if (!response.ok) {
      throw new Error(`Cloud Function error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ ICE servers obtained successfully');
    console.log('📋 Server list:', data.iceServers.map(s => s.urls).flat());
    
    return { 
      iceServers: data.iceServers,
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all'
    };
  } catch (error) {
    console.error('❌ Error getting ICE servers:', error);
    console.log('⚠️ Falling back to basic STUN servers');
    
    // Fallback to basic STUN servers if Cloud Function fails
    return {
      iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
      ],
      iceCandidatePoolSize: 10
    };
  }
};

// Update the initialize function to use Twilio's ICE servers
export const initializePeerConnection = async () => {
  try {
    // Get ICE servers from Twilio
    const iceConfig = await getTwilioIceServers();
    
    // Create peer connection with Twilio's ICE servers
    webRTCState.pc = new RTCPeerConnection(iceConfig);
    setupPeerConnectionHandlers(webRTCState.pc);
    return webRTCState.pc;
  } catch (error) {
    console.error('Failed to initialize peer connection:', error);
    // Fallback to default configuration
    webRTCState.pc = new RTCPeerConnection({
      iceServers: [{ urls: ['stun:stun1.l.google.com:19302'] }]
    });
    setupPeerConnectionHandlers(webRTCState.pc);
    return webRTCState.pc;
  }
};

// Correctly handle ICE candidates based on call role
const handleIceCandidate = (event) => {
  if (!event.candidate) return;
  
  // Debug candidate type and server
  const candidate = event.candidate;
  const candidateType = candidate.type; // 'host', 'srflx' (STUN), or 'relay' (TURN)
  const candidateProtocol = candidate.protocol; // 'udp' or 'tcp'
  const candidateAddress = candidate.address;
  
  console.log(`🧊 ICE Candidate: type=${candidateType}, protocol=${candidateProtocol}, address=${candidateAddress}`);
  
  // STUN candidates will be of type 'srflx'
  if (candidateType === 'srflx') {
    console.log('📡 STUN candidate found - likely using Google STUN servers');
    console.log('STUN Server:', candidate.relatedAddress);
  }
  
  // TURN candidates will be of type 'relay'
  if (candidateType === 'relay') {
    console.log('🔄 TURN candidate found - likely using Twilio TURN relay');
    console.log('TURN Server:', candidate.relatedAddress);
  }
  
  try {
    if (!webRTCState.currentCallDoc) {
      console.error('No active call document to send ICE candidates');
      return;
    }
    
    const callDoc = webRTCState.currentCallDoc;
    
    // Add the candidate to the appropriate collection based on call role
    if (webRTCState.callRole === 'caller') {
      const offerCandidates = collection(callDoc, 'offerCandidates');
      addDoc(offerCandidates, event.candidate.toJSON());
    } else if (webRTCState.callRole === 'callee') {
      const answerCandidates = collection(callDoc, 'answerCandidates');
      addDoc(answerCandidates, event.candidate.toJSON());
    }
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
  }
};

// Modify setupPeerConnectionHandlers to better handle disconnections
export const setupPeerConnectionHandlers = (pc) => {
  pc.onconnectionstatechange = () => {
    console.log('Connection state changed:', pc.connectionState);
    
    if (pc.connectionState === 'disconnected' || 
        pc.connectionState === 'failed' || 
        pc.connectionState === 'closed') {
      console.log('Connection ended, performing cleanup');
      // This ensures the call document is updated when peer disconnects
      cleanup();
    }
  };

  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    console.log('🧊 ICE connection state changed:', state);
    
    switch (state) {
      case 'checking':
        console.log('👀 Checking ICE candidates...');
        break;
      case 'connected':
        // Log selected candidate pair
        const currentPair = pc.sctp?.transport?.iceTransport?.getSelectedCandidatePair();
        if (currentPair) {
          console.log('✅ Connected using candidate pair:', currentPair);
          if (currentPair.remote?.type === 'relay') {
            console.log('🌐 Using TURN relay connection (Twilio)');
          } else if (currentPair.remote?.type === 'srflx') {
            console.log('🌐 Using STUN reflexive connection (Google)');
          } else {
            console.log('🌐 Using direct connection (host)');
          }
        } else {
          console.log('✅ Connected but candidate pair info not available');
        }
        break;
      case 'failed':
        console.log('❌ Connection failed, attempting to restart ICE');
        pc.restartIce();
        break;
      case 'disconnected':
        console.log('🔌 ICE disconnected - may recover automatically');
        break;
      case 'closed':
        console.log('🚫 ICE connection closed');
        break;
    }
  };

  // Add debugging for ICE gathering state
  pc.onicegatheringstatechange = () => {
    const state = pc.iceGatheringState;
    console.log('🧊 ICE gathering state changed:', state);
    
    if (state === 'complete') {
      // Count candidate types
      let hostCount = 0;
      let stunCount = 0;
      let turnCount = 0;
      
      // We don't have direct access to all gathered candidates in the API,
      // but we can log a summary message
      console.log('🧊 ICE gathering complete - check previous logs for candidate types');
    }
  };

  // Set the single, consistent ice candidate handler
  pc.onicecandidate = handleIceCandidate;

  pc.ontrack = (event) => {
    console.log('Track received:', event.track.kind);
    if (!webRTCState.remoteStream) {
      webRTCState.remoteStream = new MediaStream();
    }
    
    event.streams[0].getTracks().forEach((track) => {
      console.log(`Adding ${track.kind} track to remote stream`);
      webRTCState.remoteStream.addTrack(track);
    });
    
    if (webRTCState.onStreamUpdate) {
      webRTCState.onStreamUpdate(webRTCState.remoteStream);
    } else {
      console.warn('No onStreamUpdate callback set to handle remote stream');
    }
  };
};

// Setup media sources
export const setupMediaSources = async () => {
  try {
    // Initialize peer connection if not already done
    if (!webRTCState.pc) {
      initializePeerConnection();
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: true, 
      audio: true 
    });
    
    // Ensure tracks are enabled
    stream.getTracks().forEach(track => {
      console.log(`${track.kind} track:`, track.enabled);
      track.enabled = true;
    });
    
    // Set local stream in global state
    webRTCState.localStream = stream;
    
    // Add tracks to the peer connection
    stream.getTracks().forEach(track => {
      console.log(`Adding ${track.kind} track to peer connection`);
      webRTCState.pc.addTrack(track, stream);
    });
    
    return stream; // Return the stream so the component can set video srcObject
    
  } catch (error) {
    console.error('Error accessing media:', error);
    throw error;
  }
};

// Create a call
export const createCall = async () => {
  try {
    console.log('Creating call...');
    
    // Ensure we have a peer connection
    if (!webRTCState.pc) {
      initializePeerConnection();
    }
    
    // Set call role
    webRTCState.callRole = 'caller';
    
    // Ensure we have media before creating the offer
    if (!webRTCState.localStream) {
      await setupMediaSources();
    }
    
    const callsRef = collection(db, 'calls');
    const callDoc = doc(callsRef);
    webRTCState.currentCallDoc = callDoc;
    
    const offerCandidates = collection(callDoc, 'offerCandidates');
    const answerCandidates = collection(callDoc, 'answerCandidates');

    // Create and set local description
    const offerDescription = await webRTCState.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await webRTCState.pc.setLocalDescription(offerDescription);

    // Store the offer with status field
    await setDoc(callDoc, { 
      offer: {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      },
      status: 'waiting',              // New status field
      createdBy: auth.currentUser.uid, // Track creator
      created: new Date().toISOString()
    });

    // Listen for remote answer
    onSnapshot(callDoc, (snapshot) => {
      try {
        const data = snapshot.data();
        if (!webRTCState.pc.currentRemoteDescription && data?.answer) {
          console.log('Received remote answer');
          const answerDescription = new RTCSessionDescription(data.answer);
          webRTCState.pc.setRemoteDescription(answerDescription);
        }
      } catch (error) {
        console.error('Error processing remote answer:', error);
      }
    });

    // Listen for remote ICE candidates
    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          try {
            console.log('Adding answer ICE candidate');
            const candidate = new RTCIceCandidate(change.doc.data());
            webRTCState.pc.addIceCandidate(candidate);
          } catch (error) {
            console.error('Error adding answer ICE candidate:', error);
          }
        }
      });
    });

    return callDoc.id;
  } catch (err) {
    console.error('Error in createCall:', err);
    throw err;
  }
};

// Answer a call
export const answerCall = async (callId) => {
  try {
    console.log('Answering call:', callId);
    
    // Ensure we have a peer connection
    if (!webRTCState.pc) {
      initializePeerConnection();
    }
    
    // Set call role
    webRTCState.callRole = 'callee';
    
    // Ensure we have media before answering
    if (!webRTCState.localStream) {
      await setupMediaSources();
    }
    
    const callDoc = doc(db, 'calls', callId);
    webRTCState.currentCallDoc = callDoc;
    
    const offerCandidates = collection(callDoc, 'offerCandidates');

    // Get the offer data
    const callData = (await getDoc(callDoc)).data();
    if (!callData || !callData.offer) {
      throw new Error('Invalid call data: no offer found');
    }
    
    const offerDescription = callData.offer;
    
    // Set remote description (the offer)
    await webRTCState.pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    // Create and set local description (the answer)
    const answerDescription = await webRTCState.pc.createAnswer();
    await webRTCState.pc.setLocalDescription(answerDescription);

    // Store the answer
    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };
    await setDoc(callDoc, { answer }, { merge: true });

    // Listen for remote ICE candidates
    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          try {
            const candidate = new RTCIceCandidate(change.doc.data());
            webRTCState.pc.addIceCandidate(candidate);
          } catch (error) {
            console.error('Error adding offer ICE candidate:', error);
          }
        }
      });
    });
    
    return callId;
  } catch (error) {
    console.error('Error in answerCall:', error);
    throw error;
  }
};

// Make cleanup function explicitly async and await all operations
export const cleanup = async () => {
  console.log('Starting explicit cleanup process');
  
  try {
    // Delete the Firestore document instead of just updating it
    if (webRTCState.currentCallDoc) {
      try {
        console.log('Attempting to delete call document:', webRTCState.currentCallDoc.id);
        
        // Make sure we're still authenticated
        if (!auth.currentUser) {
          console.error('No authenticated user during cleanup');
          await signInAnonymously(auth);
        }
        
        // Delete the document completely
        await deleteDoc(webRTCState.currentCallDoc);
        
        console.log('✓ Successfully deleted call document');
      } catch (docError) {
        console.error('Failed to delete call document:', docError);
      }
    } else {
      console.log('No call document to clean up');
    }
    
    // 2. Close the peer connection
    if (webRTCState.pc) {
      try {
        webRTCState.pc.onconnectionstatechange = null;
        webRTCState.pc.close();
        console.log('✓ Closed peer connection');
      } catch (pcError) {
        console.error('Error closing peer connection:', pcError);
      }
    }
    
    // 3. Stop media tracks
    if (webRTCState.localStream) {
      try {
        webRTCState.localStream.getTracks().forEach(track => {
          track.stop();
        });
        console.log('✓ Stopped local tracks');
      } catch (trackError) {
        console.error('Error stopping local tracks:', trackError);
      }
    }
    
    if (webRTCState.remoteStream) {
      try {
        webRTCState.remoteStream.getTracks().forEach(track => {
          track.stop();
        });
        console.log('✓ Stopped remote tracks');
      } catch (trackError) {
        console.error('Error stopping remote tracks:', trackError);
      }
    }
    
    // 4. Clear state
    webRTCState.pc = null;
    webRTCState.localStream = null;
    webRTCState.remoteStream = null;
    webRTCState.callRole = null;
    webRTCState.currentCallDoc = null;
    
    console.log('Cleanup completed successfully');
    return true;
  } catch (error) {
    console.error('Critical error during cleanup:', error);
    return false;
  }
};

// New function to search for a random partner
export const searchForPartner = async () => {
  // Look for an existing 'waiting' call NOT created by me
  const callsRef = collection(db, 'calls');
  const q = query(
    callsRef,
    where('status', '==', 'waiting'),
    where('createdBy', '!=', auth.currentUser.uid),
    orderBy('createdBy'), // Required for inequality filter
    orderBy('created'),
    limit(1)
  );
  const snap = await getDocs(q);

  if (!snap.empty) {
    // Found someone waiting → I become callee
    const callDocRef = snap.docs[0].ref;
    const callId = callDocRef.id;
    
    await updateDoc(callDocRef, {
      status: 'matched',
      answeredBy: auth.currentUser.uid,
      matchedAt: serverTimestamp()
    });
    
    // Answer the call
    await answerCall(callId);
    return callId;
  } else {
    // No one waiting → I become caller
    const callId = await createCall();
    return callId;
  }
};

// Modify cancelSearch to ensure it properly awaits cleanup
export const cancelSearch = async () => {
  console.log('Cancel search initiated');
  
  try {
    if (webRTCState.currentCallDoc) {
      const callDocRef = webRTCState.currentCallDoc;
      
      // First, get the current document data
      const docSnap = await getDoc(callDocRef);
      
      if (docSnap.exists()) {
        const callData = docSnap.data();
        
        // Check if I'm the creator of this document
        if (callData.createdBy === auth.currentUser?.uid) {
          console.log('Found my created document to cancel:', callDocRef.id);
          
          // Delete the document instead of updating it
          await deleteDoc(callDocRef);
          
          console.log('✓ Deleted the call document');
        } else {
          console.log('Not the creator of this document, skipping deletion');
        }
      }
    }
    
    // Always run full cleanup
    await cleanup();
    
    return true;
  } catch (error) {
    console.error('Failed to cancel search:', error);
    throw error;
  }
};

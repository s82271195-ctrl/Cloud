import React, { useEffect, useRef, useState } from 'react';
import { db } from '../config';
import { ref, onValue, set, push, remove, off, update } from 'firebase/database';
import { IncomingCallData, UserProfile } from '../types';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Phone, RefreshCcw } from 'lucide-react';

interface CallModalProps {
  currentUser: UserProfile;
  partner?: UserProfile; // If initiating
  incomingCall?: IncomingCallData; // If receiving
  onEndCall: () => void;
  isVideo: boolean;
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
};

const CallModal: React.FC<CallModalProps> = ({ currentUser, partner, incomingCall, onEndCall, isVideo }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(!isVideo);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  // Identify Call ID and Role
  const callId = incomingCall ? incomingCall.callId : `${currentUser.uid}_${Date.now()}`;
  const isInitiator = !incomingCall;

  useEffect(() => {
    // Check for multiple video inputs (cameras)
    navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
    });

    // Explicitly listen for call termination from the other side
    const callStatusRef = ref(db, `calls/${callId}/status`);
    const handleStatusChange = (snapshot: any) => {
        if (snapshot.val() === 'ended') {
            onEndCall();
        }
    };
    onValue(callStatusRef, handleStatusChange);

    const startCall = async () => {
      try {
        // 1. Get Local Stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideo ? { facingMode: 'user' } : false,
          audio: true,
        });
        
        localStream.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Create Peer Connection
        peerConnection.current = new RTCPeerConnection(servers);

        // Add tracks to PC
        stream.getTracks().forEach((track) => {
          peerConnection.current?.addTrack(track, stream);
        });

        // Handle remote tracks
        peerConnection.current.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE Candidates
        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            const candidatesRef = ref(db, `calls/${callId}/candidates/${currentUser.uid}`);
            push(candidatesRef, event.candidate.toJSON());
          }
        };

        // Handle Connection State
        peerConnection.current.onconnectionstatechange = () => {
            const state = peerConnection.current?.connectionState;
            if (state === 'connected') {
                setConnectionStatus('Connected');
            } else if (state === 'disconnected' || state === 'failed') {
                setConnectionStatus('Disconnected');
                onEndCall();
            }
        };

        // 3. Signaling Logic
        if (isInitiator && partner) {
          set(ref(db, `calls/${callId}/status`), 'active');

          // Create Offer
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);

          // Send Call Request to Partner
          const callData: IncomingCallData = {
            callerId: currentUser.uid,
            callerName: currentUser.displayName,
            callerPhoto: currentUser.photoURL || '',
            callId: callId,
            isVideo,
            offer: { type: 'offer', sdp: offer.sdp! }
          };
          
          await set(ref(db, `users/${partner.uid}/incomingCall`), callData);

          // Listen for Answer
          const answerRef = ref(db, `calls/${callId}/answer`);
          onValue(answerRef, (snapshot) => {
            const data = snapshot.val();
            if (data && !peerConnection.current?.currentRemoteDescription) {
              const remoteDesc = new RTCSessionDescription(data);
              peerConnection.current?.setRemoteDescription(remoteDesc);
            }
          });

        } else if (incomingCall) {
          // Handle Incoming Offer
          const remoteDesc = new RTCSessionDescription(incomingCall.offer);
          await peerConnection.current.setRemoteDescription(remoteDesc);

          // Create Answer
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);

          // Send Answer
          await set(ref(db, `calls/${callId}/answer`), {
            type: 'answer',
            sdp: answer.sdp
          });
        }

        // 4. Listen for Remote ICE Candidates
        const partnerId = isInitiator && partner ? partner.uid : incomingCall?.callerId;
        if (partnerId) {
            const remoteCandidatesRef = ref(db, `calls/${callId}/candidates/${partnerId}`);
            onValue(remoteCandidatesRef, (snapshot) => {
                snapshot.forEach((childSnapshot) => {
                    const candidate = new RTCIceCandidate(childSnapshot.val());
                    peerConnection.current?.addIceCandidate(candidate).catch(e => console.error("Ice error", e));
                });
            });
        }

      } catch (err) {
        console.error("Error starting call:", err);
        setConnectionStatus("Failed to access media devices");
        setTimeout(onEndCall, 3000);
      }
    };

    startCall();

    return () => {
      // Cleanup
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      
      // Mark call as ended in DB to notify other peer
      update(ref(db, `calls/${callId}`), { status: 'ended' });

      // Clean up signaling listeners
      off(callStatusRef);
      if (isInitiator && partner) {
          remove(ref(db, `users/${partner.uid}/incomingCall`));
          off(ref(db, `calls/${callId}/answer`));
      } else if (!isInitiator && incomingCall) {
          remove(ref(db, `users/${currentUser.uid}/incomingCall`));
      }
      
      // Clean up candidates listeners
      const partnerId = isInitiator && partner ? partner.uid : incomingCall?.callerId;
      if (partnerId) {
          off(ref(db, `calls/${callId}/candidates/${partnerId}`));
      }
    };
  }, []);

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream.current && isVideo) {
        localStream.current.getVideoTracks().forEach(track => track.enabled = !track.enabled);
        setIsCameraOff(!isCameraOff);
    }
  };

  const switchCamera = async () => {
      if (!localStream.current || !hasMultipleCameras) return;
      
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        
        const currentTrack = localStream.current.getVideoTracks()[0];
        const currentDeviceId = currentTrack?.getSettings().deviceId;
        
        const currentIndex = videoInputs.findIndex(d => d.deviceId === currentDeviceId);
        const nextDevice = videoInputs[(currentIndex + 1) % videoInputs.length];
        
        if (nextDevice) {
             const newStream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: nextDevice.deviceId } },
                audio: false
            });
            
            const newTrack = newStream.getVideoTracks()[0];
            
            const sender = peerConnection.current?.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
                await sender.replaceTrack(newTrack);
            }
            
            localStream.current.removeTrack(currentTrack);
            localStream.current.addTrack(newTrack);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStream.current;
            }
        }
      } catch (e) {
          console.error("Error switching camera:", e);
      }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-gray-900 flex flex-col animate-in fade-in duration-300">
      {/* Remote Video (Full Screen) */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
        <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover"
        />
        {connectionStatus !== 'Connected' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 text-white flex-col gap-6 backdrop-blur-sm">
                 <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-purple-600 flex items-center justify-center shadow-2xl shadow-purple-500/50">
                        {partner?.photoURL || incomingCall?.callerPhoto ? (
                            <img src={partner?.photoURL || incomingCall?.callerPhoto} className="w-full h-full rounded-full object-cover opacity-80" />
                        ) : (
                            <Phone size={40} className="animate-pulse" />
                        )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-black animate-bounce"></div>
                 </div>
                 <div className="text-center">
                    <p className="text-2xl font-bold tracking-tight mb-2">{connectionStatus}</p>
                    <p className="text-base text-gray-400 font-medium">
                        {isInitiator ? `Calling ${partner?.displayName}...` : `${incomingCall?.callerName} is calling...`}
                    </p>
                 </div>
            </div>
        )}
      </div>

      {/* Local Video (PiP) */}
      <div className="absolute top-4 right-4 w-32 h-48 sm:w-40 sm:h-60 bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/10 transition-all hover:scale-105">
         <video 
            ref={localVideoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-cover transform scale-x-[-1] ${isCameraOff ? 'hidden' : ''}`}
         />
         {isCameraOff && (
             <div className="w-full h-full flex items-center justify-center text-white bg-gray-800">
                 <VideoOff size={32} className="opacity-50" />
             </div>
         )}
         <div className="absolute bottom-2 right-2 flex gap-1">
             {hasMultipleCameras && !isCameraOff && (
                 <button onClick={switchCamera} className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-md">
                     <RefreshCcw size={14} />
                 </button>
             )}
         </div>
      </div>

      {/* Controls */}
      <div className="h-28 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center gap-6 pb-6 pt-4">
         <button 
            onClick={toggleMute}
            className={`p-4 rounded-full ${isMuted ? 'bg-white text-gray-900 shadow-lg' : 'bg-gray-800/60 text-white hover:bg-gray-700'} backdrop-blur-md transition-all duration-300`}
            title={isMuted ? "Unmute" : "Mute"}
         >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
         </button>
         
         <button 
            onClick={onEndCall}
            className="p-5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-110 shadow-xl shadow-red-600/40"
            title="End Call"
         >
            <PhoneOff size={32} fill="currentColor" />
         </button>

         <button 
            onClick={toggleVideo}
            disabled={!isVideo}
            className={`p-4 rounded-full ${isCameraOff ? 'bg-white text-gray-900 shadow-lg' : 'bg-gray-800/60 text-white hover:bg-gray-700'} backdrop-blur-md transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed`}
            title={isCameraOff ? "Turn Video On" : "Turn Video Off"}
         >
            {isCameraOff ? <VideoOff size={24} /> : <Video size={24} />}
         </button>
      </div>
    </div>
  );
};

export default CallModal;
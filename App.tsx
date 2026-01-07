import React, { useEffect, useState } from 'react';
import { auth, db } from './config';
import { onAuthStateChanged, User } from 'firebase/auth';
import { ref, set, onValue, update } from 'firebase/database';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import ProfileModal from './components/ProfileModal';
import CallModal from './components/CallModal';
import { UserProfile, IncomingCallData } from './types';
import { Phone, Video, X } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Profile Modal State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTargetUser, setProfileTargetUser] = useState<UserProfile | null>(null);
  const [isProfileEditable, setIsProfileEditable] = useState(false);

  // Call State
  const [isInCall, setIsInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isVideoCall, setIsVideoCall] = useState(false);

  // 1. Listen for Auth State Changes (Persisted Login)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        // Logged out
        setUserProfile(null);
        setSelectedPartner(null);
        setLoading(false); // Immediately show AuthScreen
      }
      // If logged in, we wait for the profile listener (below) to set loading = false
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen for User Profile Data when User is Authenticated
  useEffect(() => {
    if (!user) return;

    const userRef = ref(db, 'users/' + user.uid);
    const unsubscribe = onValue(userRef, (snapshot) => {
        const val = snapshot.val();
        if (val) {
            setUserProfile(val);
            if (val.incomingCall) {
                setIncomingCall(val.incomingCall);
            } else {
                setIncomingCall(null);
            }
        } else {
            // Initial creation if not exists
             const profile: UserProfile = {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || user.email?.split('@')[0] || 'User',
                photoURL: user.photoURL || undefined,
                status: 'online',
                lastSeen: Date.now()
            };
            setUserProfile(profile);
            set(userRef, profile);
        }
        setLoading(false); // Profile loaded, show App
    });

    return () => unsubscribe();
  }, [user]);

  const handleEditOwnProfile = () => {
    if (userProfile) {
        setProfileTargetUser(userProfile);
        setIsProfileEditable(true);
        setShowProfileModal(true);
    }
  };

  const handleViewPartnerProfile = (partner: UserProfile) => {
      setProfileTargetUser(partner);
      setIsProfileEditable(false);
      setShowProfileModal(true);
  };

  const handleSelectUser = async (partner: UserProfile) => {
    setSelectedPartner(partner);
    // If marked as unread, mark as read when opening
    if (userProfile && userProfile.unreadChats && userProfile.unreadChats[partner.uid]) {
        try {
            await update(ref(db, `users/${userProfile.uid}/unreadChats`), {
                [partner.uid]: null 
            });
        } catch (e) {
            console.error("Error marking chat as read:", e);
        }
    }
  };

  // Call Handlers
  const startCall = (video: boolean) => {
      setIsVideoCall(video);
      setIsInCall(true);
  };

  const acceptCall = () => {
      if (incomingCall) {
          setIsVideoCall(incomingCall.isVideo);
          setIsInCall(true);
      }
  };

  const rejectCall = () => {
      if (userProfile) {
          set(ref(db, `users/${userProfile.uid}/incomingCall`), null);
      }
      setIncomingCall(null);
  };

  const endCall = () => {
      setIsInCall(false);
      setIncomingCall(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 select-none">
        <div className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden">
             <div className="h-full bg-purple-600 animate-pulse w-full"></div>
        </div>
        <p className="mt-4 text-gray-500 text-sm font-light tracking-widest uppercase">Initializing</p>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <AuthScreen />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#d1d7db] relative select-none">
        {/* Responsive Layout */}
        <div className={`
             fixed inset-0 z-20 md:static md:z-0 w-full md:w-auto h-full bg-white transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
             ${selectedPartner ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
             md:flex
        `}>
             <Sidebar 
                currentUser={userProfile} 
                onSelectUser={handleSelectUser}
                selectedUserId={selectedPartner?.uid}
                onEditProfile={handleEditOwnProfile}
             />
        </div>

        {/* Chat Window Container */}
        <div className={`
            fixed inset-0 z-10 md:static w-full h-full bg-gray-100 transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1)
            ${selectedPartner ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
            md:flex-1 md:flex
        `}>
            <ChatWindow 
                currentUser={userProfile} 
                partner={selectedPartner} 
                onBack={() => setSelectedPartner(null)}
                onViewProfile={handleViewPartnerProfile}
                onStartCall={startCall}
            />
        </div>

        {/* Profile Modal Overlay */}
        {showProfileModal && profileTargetUser && (
            <ProfileModal 
                user={profileTargetUser} 
                isEditable={isProfileEditable} 
                onClose={() => setShowProfileModal(false)} 
            />
        )}

        {/* Incoming Call Notification (If not already in call) */}
        {incomingCall && !isInCall && (
            <div className="fixed top-4 right-4 z-[50] bg-white rounded-2xl shadow-2xl p-4 w-80 animate-bounce-slight border border-purple-100/50 glass">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden shadow-inner border border-white">
                        {incomingCall.callerPhoto ? <img src={incomingCall.callerPhoto} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400">{incomingCall.callerName[0]}</div>}
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-gray-900 text-lg leading-none mb-1">{incomingCall.callerName}</p>
                        <p className="text-xs text-purple-600 font-medium bg-purple-50 inline-block px-2 py-0.5 rounded-full">Incoming {incomingCall.isVideo ? 'Video' : 'Voice'} Call...</p>
                    </div>
                </div>
                <div className="flex gap-3 mt-4">
                    <button onClick={rejectCall} className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl font-semibold hover:bg-red-100 flex items-center justify-center gap-2 transition-colors active:scale-95">
                        <X size={18} /> Decline
                    </button>
                    <button onClick={acceptCall} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all hover:-translate-y-0.5 active:scale-95">
                        {incomingCall.isVideo ? <Video size={18} /> : <Phone size={18} />} Accept
                    </button>
                </div>
            </div>
        )}

        {/* Active Call Modal */}
        {isInCall && (
            <CallModal 
                currentUser={userProfile}
                partner={selectedPartner || undefined} // passed if Initiator
                incomingCall={incomingCall || undefined} // passed if Receiver
                onEndCall={endCall}
                isVideo={isVideoCall}
            />
        )}
    </div>
  );
};

export default App;
import React, { useState, useRef } from 'react';
import { UserProfile, AI_BOT_ID } from '../types';
import { X, Camera, User, Mail, Save } from 'lucide-react';
import { updateProfile } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import { db, auth } from '../config';

interface ProfileModalProps {
  user: UserProfile;
  isEditable: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, isEditable, onClose }) => {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!isEditable || !auth.currentUser) return;
    setIsLoading(true);

    try {
      // 1. Update Firebase Auth Profile
      await updateProfile(auth.currentUser, {
        displayName: displayName,
        photoURL: photoURL || null
      });

      // 2. Update Realtime Database
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, {
        displayName: displayName,
        photoURL: photoURL || null
      });

      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to update profile.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden modal-animate relative flex flex-col max-h-[90vh]">
        
        {/* Header Image / Background */}
        <div className="h-32 bg-gradient-to-r from-purple-500 to-indigo-600 relative">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 text-white rounded-full hover:bg-black/40 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Avatar Section */}
        <div className="px-6 relative -mt-16 text-center">
          <div className="relative inline-block group">
            <div className="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-200 flex items-center justify-center">
              {photoURL ? (
                <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-gray-400" />
              )}
            </div>
            
            {isEditable && user.uid !== AI_BOT_ID && (
              <>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 p-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-transform hover:scale-105"
                  title="Change Photo"
                >
                  <Camera size={18} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Name Field */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <User size={14} /> Name
            </label>
            {isEditable && user.uid !== AI_BOT_ID ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full text-lg font-semibold text-gray-800 border-b-2 border-gray-200 focus:border-purple-600 outline-none py-1 transition-colors bg-transparent"
              />
            ) : (
              <p className="text-xl font-semibold text-gray-900">{user.displayName}</p>
            )}
            <p className="text-xs text-gray-400">
              {isEditable ? "This is not your username or pin. This name will be visible to your Chitchat contacts." : ""}
            </p>
          </div>

          {/* Email Field (Read-only) */}
          <div className="space-y-2">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Mail size={14} /> Email
            </label>
            <p className="text-gray-800 font-medium">{user.email}</p>
          </div>
           
           {/* Info / Bio (Static for now) */}
           <div className="space-y-2">
             <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">About</label>
             <p className="text-gray-600 italic">
                {user.uid === AI_BOT_ID 
                  ? "I am an AI assistant powered by Google Gemini. Ask me anything!" 
                  : "Hey there! I am using Chitchat."}
             </p>
           </div>
        </div>

        {/* Footer Actions */}
        {isEditable && user.uid !== AI_BOT_ID && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save size={18} /> Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
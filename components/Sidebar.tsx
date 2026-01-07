import React, { useEffect, useState, useRef } from 'react';
import { UserProfile, AI_BOT_ID } from '../types';
import { db, auth } from '../config';
import { ref, onValue, off, remove, update } from 'firebase/database';
import { LogOut, Search, MessageSquarePlus, Bot, Trash2, Mail, MailOpen } from 'lucide-react';

interface SidebarProps {
  currentUser: UserProfile;
  onSelectUser: (user: UserProfile) => void;
  selectedUserId?: string;
  onEditProfile: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, onSelectUser, selectedUserId, onEditProfile }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, userId: string } | null>(null);
  
  // Long Press State
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const handleData = (snapshot: any) => {
      const data = snapshot.val();
      const userList: UserProfile[] = [];
      
      // Always add AI Bot first
      userList.push({
        uid: AI_BOT_ID,
        displayName: 'Chitchat AI',
        email: 'ai@chitchat.app',
        status: 'online'
      });

      if (data) {
        Object.keys(data).forEach((key) => {
          if (key !== currentUser.uid) {
            userList.push({
              uid: key,
              ...data[key]
            });
          }
        });
      }
      setUsers(userList);
    };

    onValue(usersRef, handleData);
    return () => {
      off(usersRef, handleData);
    };
  }, [currentUser.uid]);

  // Close context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, userId: string) => {
      e.preventDefault(); // Prevent default browser menu
      setContextMenu({
          x: e.pageX,
          y: e.pageY,
          userId
      });
  };

  // Mobile Long Press Logic
  const handleTouchStart = (e: React.TouchEvent, userId: string) => {
    longPressTimer.current = setTimeout(() => {
        const touch = e.touches[0];
        setContextMenu({
            x: touch.pageX,
            y: touch.pageY,
            userId
        });
    }, 600); // 600ms threshold for long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
  };

  const getChatId = (partnerId: string) => {
      if (partnerId === AI_BOT_ID) {
          return `${currentUser.uid}_${AI_BOT_ID}`;
      }
      return [currentUser.uid, partnerId].sort().join('_');
  };

  const handleDeleteChat = async () => {
      if (!contextMenu) return;
      
      if (window.confirm("Are you sure you want to delete this chat history? This cannot be undone.")) {
        const chatId = getChatId(contextMenu.userId);
        const messagesRef = ref(db, `messages/${chatId}`);
        try {
            await remove(messagesRef);
            // alert("Chat deleted successfully."); // Keep it silent for smoother UX
        } catch (error) {
            console.error("Error deleting chat:", error);
            alert("Could not delete chat.");
        }
      }
      setContextMenu(null);
  };

  const handleToggleUnread = async () => {
    if (!contextMenu) return;
    const targetId = contextMenu.userId;
    const isUnread = currentUser.unreadChats?.[targetId];
    
    const userRef = ref(db, `users/${currentUser.uid}/unreadChats`);
    try {
        await update(userRef, {
            [targetId]: !isUnread ? true : null
        });
    } catch (error) {
        console.error("Error toggling unread", error);
    }
    setContextMenu(null);
  };

  const filteredUsers = users.filter(user => 
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full md:w-[400px] select-none">
      {/* Sidebar Header */}
      <div className="px-4 py-4 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm">
        <div 
          className="flex items-center gap-3 cursor-pointer p-1.5 rounded-xl hover:bg-gray-100 transition-all duration-300 group"
          onClick={onEditProfile}
          title="Edit your profile"
        >
          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold text-lg overflow-hidden border-2 border-white shadow-md group-hover:scale-105 transition-transform">
             {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="Me" className="w-full h-full object-cover" />
             ) : (
                currentUser.displayName.charAt(0).toUpperCase()
             )}
          </div>
          <span className="font-bold text-gray-800 text-sm hidden sm:block group-hover:text-purple-600 transition-colors">Me</span>
        </div>

        <div className="flex gap-2">
            <button className="p-2.5 text-gray-500 hover:bg-white hover:text-purple-600 hover:shadow-md rounded-full transition-all duration-300 active:scale-95" title="New Chat">
                <MessageSquarePlus size={20} />
            </button>
            <button 
            onClick={() => auth.signOut()}
            className="p-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:shadow-md rounded-full transition-all duration-300 active:scale-95" 
            title="Sign Out">
            <LogOut size={20} />
            </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4">
        <div className="relative group">
          <Search className="absolute left-3.5 top-3 text-gray-400 w-4 h-4 group-focus-within:text-purple-500 transition-colors" />
          <input 
            type="text" 
            placeholder="Search friends..." 
            className="w-full bg-gray-100 py-2.5 pl-10 pr-4 rounded-full focus:outline-none focus:bg-white focus:ring-2 focus:ring-purple-100 focus:shadow-sm text-sm transition-all duration-300 allow-select"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {filteredUsers.map((user, index) => {
          const isUnread = currentUser.unreadChats?.[user.uid];
          
          return (
          <div 
            key={user.uid}
            onClick={() => onSelectUser(user)}
            onContextMenu={(e) => handleContextMenu(e, user.uid)}
            onTouchStart={(e) => handleTouchStart(e, user.uid)}
            onTouchEnd={handleTouchEnd}
            style={{ animationDelay: `${index * 50}ms` }}
            className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200 list-item-enter relative group border border-transparent 
                ${selectedUserId === user.uid ? 'bg-purple-50 border-purple-100 shadow-sm scale-[1.01]' : 'hover:bg-gray-50 hover:scale-[1.01]'}
                ${isUnread ? 'bg-gray-50' : ''}`}
          >
            <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-lg overflow-hidden border-2 border-transparent transition-all duration-300
                ${user.uid === AI_BOT_ID ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-purple-200 shadow-md' : 'bg-gray-300 group-hover:border-white group-hover:shadow-md'}
                ${selectedUserId === user.uid ? 'border-purple-200' : ''}
            `}>
                {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" />
                ) : (
                    user.uid === AI_BOT_ID ? <Bot size={24} /> : user.displayName.charAt(0).toUpperCase()
                )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <h4 className={`text-[15px] truncate transition-colors ${user.uid === AI_BOT_ID ? 'text-purple-700 font-semibold' : 'group-hover:text-black'} ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>
                    {user.displayName}
                </h4>
                {selectedUserId === user.uid && <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>}
              </div>
              <p className={`text-sm truncate transition-colors ${selectedUserId === user.uid ? 'text-purple-600/70 font-medium' : ''} ${isUnread ? 'font-bold text-gray-800' : 'font-normal text-gray-500 group-hover:text-gray-600'}`}>
                {user.uid === AI_BOT_ID ? "How can I help you today?" : "Hey there! I am using Chitchat."}
              </p>
            </div>
            {isUnread && (
                <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm flex-shrink-0"></div>
            )}
          </div>
        )}})}

        {filteredUsers.length === 0 && (
           <div className="p-8 text-center text-gray-400 text-sm flex flex-col items-center animate-pulse">
               <Search size={32} className="mb-2 opacity-20" />
               No contacts found.
           </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <div 
            className="fixed bg-white shadow-2xl rounded-xl border border-gray-100 py-1.5 z-50 w-48 modal-animate overflow-hidden"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
             <button 
                onClick={handleToggleUnread}
                className="w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50 flex items-center gap-3 text-sm font-medium transition-colors"
             >
                {currentUser.unreadChats?.[contextMenu.userId] ? (
                    <><MailOpen size={16} /> Mark as Read</>
                ) : (
                    <><Mail size={16} /> Mark as Unread</>
                )}
             </button>
             <button 
                onClick={handleDeleteChat}
                className="w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 flex items-center gap-3 text-sm font-medium transition-colors"
             >
                <Trash2 size={16} /> Delete Chat
             </button>
          </div>
      )}
    </div>
  );
};

export default Sidebar;
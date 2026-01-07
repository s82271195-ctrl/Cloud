import React, { useEffect, useRef, useState } from 'react';
import { Message, UserProfile, AI_BOT_ID } from '../types';
import { db } from '../config';
import { ref, push, onValue, off, serverTimestamp } from 'firebase/database';
import { generateAIResponse } from '../services/geminiService';
import { Send, MoreVertical, Phone, Video, Bot, Image as ImageIcon, Paperclip, ArrowLeft } from 'lucide-react';

interface ChatWindowProps {
  currentUser: UserProfile;
  partner: UserProfile | null;
  onBack: () => void;
  onViewProfile: (user: UserProfile) => void;
  onStartCall: (video: boolean) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, partner, onBack, onViewProfile, onStartCall }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatId = partner
    ? partner.uid === AI_BOT_ID
      ? `${currentUser.uid}_${AI_BOT_ID}`
      : [currentUser.uid, partner.uid].sort().join('_')
    : null;

  useEffect(() => {
    if (!chatId || !partner) return;

    // Load messages
    const messagesRef = ref(db, `messages/${chatId}`);
    const handleData = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        const loadedMessages = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
        setMessages(loadedMessages);
      } else {
        setMessages([]);
      }
    };

    onValue(messagesRef, handleData);

    return () => {
      off(messagesRef, handleData);
    };
  }, [chatId, partner]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (content: string, type: 'text' | 'image' = 'text') => {
    if (!chatId || !partner) return;
    
    const messagesRef = ref(db, `messages/${chatId}`);
    
    // Push user message
    await push(messagesRef, {
      senderId: currentUser.uid,
      text: content,
      type: type,
      timestamp: serverTimestamp(),
    });

    // Handle AI Bot Response (only for text)
    if (partner.uid === AI_BOT_ID && type === 'text') {
      setIsTyping(true);
      
      const history = messages.slice(-10).map(m => ({
        role: m.senderId === currentUser.uid ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }]
      }));

      try {
        const aiResponse = await generateAIResponse(history, content);
        await push(messagesRef, {
          senderId: AI_BOT_ID,
          text: aiResponse,
          type: 'text',
          timestamp: serverTimestamp(),
        });
      } catch (e) {
        console.error("AI Error", e);
      } finally {
        setIsTyping(false);
      }
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText, 'text');
    setInputText('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        sendMessage(base64String, 'image');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  if (!partner) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-[#f0f2f5] border-l border-gray-200 select-none">
         <div className="text-center animate-bounce-slight">
            <div className="inline-flex items-center justify-center w-28 h-28 mb-6 rounded-full bg-white shadow-xl">
                <div className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                    <Bot size={40} className="text-white" />
                </div>
            </div>
            <h2 className="text-3xl font-light text-gray-800 mb-3 tracking-tight">Chitchat for Web</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto leading-relaxed">
                Send and receive messages without keeping your phone online.<br/>
                Connect securely with people that matter.
            </p>
         </div>
         <div className="absolute bottom-10 flex items-center gap-2 text-gray-400 text-xs tracking-wider uppercase">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Encrypted by Gemini Tech
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#efeae2] relative w-full select-none">
      {/* Glassmorphic Header */}
      <div className="px-4 py-3 flex items-center justify-between shadow-sm z-20 sticky top-0 border-b border-white/40 glass">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden text-gray-600 hover:bg-black/5 p-2 rounded-full transition-colors active:scale-95">
             <ArrowLeft size={20} />
          </button>
          
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onViewProfile(partner)}
          >
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md border-2 border-white transition-transform group-hover:scale-105 ${partner.uid === AI_BOT_ID ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gray-300'} overflow-hidden`}>
                {partner.photoURL ? (
                <img src={partner.photoURL} alt="avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                partner.uid === AI_BOT_ID ? <Bot size={22} /> : partner.displayName.charAt(0).toUpperCase()
                )}
            </div>
            <div>
                <h3 className="font-semibold text-gray-800 leading-tight group-hover:text-purple-700 transition-colors">{partner.displayName}</h3>
                {partner.uid === AI_BOT_ID ? (
                <span className="text-xs text-purple-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>AI Assistant</span>
                ) : (
                <span className="text-xs text-gray-500 font-medium">Click for info</span>
                )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 text-purple-600 items-center">
           {partner.uid !== AI_BOT_ID && (
               <>
                <button onClick={() => onStartCall(true)} className="p-2.5 hover:bg-purple-50 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95" title="Video Call"><Video size={20} /></button>
                <button onClick={() => onStartCall(false)} className="p-2.5 hover:bg-purple-50 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95" title="Voice Call"><Phone size={20} /></button>
               </>
           )}
           <div className="p-2.5 hover:bg-purple-50 rounded-full cursor-pointer transition-all hover:scale-110 active:scale-95"><MoreVertical size={20} /></div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')] bg-repeat">
        <div className="absolute inset-0 bg-white/30 pointer-events-none"></div> {/* Fade pattern slightly */}
        
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUser.uid;
          const showAvatar = !isMe && (index === 0 || messages[index - 1].senderId !== msg.senderId);

          return (
            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} relative z-10 message-enter`}>
              <div className={`flex max-w-[85%] md:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end gap-2`}>
                 {/* Tiny Avatar for incoming */}
                 {!isMe && (
                     <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mb-1 shadow-sm border border-white bg-gray-200">
                         {showAvatar ? (
                             partner.photoURL ? <img src={partner.photoURL} className="w-full h-full object-cover"/> : <div className="w-full h-full bg-gray-300 flex items-center justify-center text-[10px] text-gray-600 font-bold">{partner.displayName[0]}</div>
                         ) : <div className="w-full h-full bg-transparent"></div>}
                     </div>
                 )}

                <div 
                  className={`px-4 py-2.5 shadow-md relative text-[15px] break-words transition-all hover:shadow-lg ${
                    isMe 
                      ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-white text-gray-800 rounded-2xl rounded-tl-sm'
                  } ${msg.type === 'image' ? 'p-1 bg-white border border-gray-100' : ''}`}
                >
                  {/* Selectable Content */}
                  <div className={`leading-relaxed allow-select ${isMe ? 'text-purple-50' : 'text-gray-700'}`}>
                    {msg.type === 'image' ? (
                      <div className="rounded-xl overflow-hidden mb-1">
                        <img src={msg.text} alt="Shared" className="max-w-full max-h-80 object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-300" />
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>

                  {/* Non-selectable Timestamp */}
                  <div className={`text-[10px] mt-1 text-right min-w-[50px] font-medium select-none ${isMe && msg.type !== 'image' ? 'text-purple-200/80' : 'text-gray-400'}`}>
                     {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex justify-start relative z-10 message-enter">
             <div className="w-8 h-8 mr-2"></div>
            <div className="bg-white text-gray-500 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5 border border-gray-100">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-75"></span>
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Input Area */}
      <div className="p-4 bg-transparent z-20 pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto bg-white p-2 rounded-full shadow-lg border border-gray-100">
            <button 
                className="text-gray-400 hover:text-purple-600 hover:bg-purple-50 p-2.5 rounded-full transition-all active:scale-90"
                onClick={() => fileInputRef.current?.click()}
                title="Attach Image"
            >
                <Paperclip size={20} strokeWidth={2.5} />
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileSelect} 
            />
            
            <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-2 py-2 bg-transparent text-gray-700 placeholder-gray-400 focus:outline-none allow-select"
            />
            
            {inputText.trim() ? (
                <button 
                    onClick={handleSendText}
                    className="p-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all hover:scale-105 active:scale-95 shadow-md shadow-purple-200"
                >
                    <Send size={18} fill="currentColor" />
                </button>
            ) : (
                <button className="p-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-full transition-all active:scale-90">
                    <ImageIcon size={22} onClick={() => fileInputRef.current?.click()}/>
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
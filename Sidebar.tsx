import React from 'react';
import { Plus, MessageSquare, Trash2, Menu, X, LogOut } from 'lucide-react';
import { ChatSession } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (e: React.MouseEvent, id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/80 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[260px] bg-[#171717] text-gray-100 transform transition-transform duration-300 ease-in-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex items-center gap-3 w-full px-4 py-3 border border-white/20 rounded-md hover:bg-gray-800 transition-colors text-sm text-white"
          >
            <Plus size={16} />
            <span>New chat</span>
          </button>
        </div>

        {/* Scrollable History List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scrollbar-thin scrollbar-thumb-gray-700">
          <div className="text-xs font-semibold text-gray-500 px-3 py-2">History</div>
          {sessions.length === 0 ? (
             <div className="text-sm text-gray-500 px-3 italic">No previous chats</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id);
                  if (window.innerWidth < 768) onClose();
                }}
                className={`
                  group relative flex items-center gap-3 px-3 py-3 rounded-md cursor-pointer text-sm transition-colors
                  ${currentSessionId === session.id ? 'bg-[#343541] pr-10' : 'hover:bg-[#2A2B32]'}
                `}
              >
                <MessageSquare size={16} className="text-gray-400 shrink-0" />
                <div className="truncate flex-1 text-gray-100">
                  {session.title || 'New Chat'}
                </div>
                
                {/* Delete action (visible on hover or active) */}
                <button
                  onClick={(e) => onDeleteSession(e, session.id)}
                  className={`
                    absolute right-2 p-1 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity
                    ${currentSessionId === session.id ? 'opacity-100' : ''}
                  `}
                  title="Delete chat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* User / Footer */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-3 rounded-md hover:bg-gray-800 cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-sm bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
              U
            </div>
            <div className="flex-1 text-sm font-medium">Guest User</div>
            <LogOut size={16} className="text-gray-500" />
          </div>
        </div>

        {/* Mobile Close Button (inside drawer) */}
        <button 
          onClick={onClose}
          className="md:hidden absolute top-2 right-2 p-2 text-gray-400"
        >
          <X size={20} />
        </button>
      </div>
    </>
  );
};

export default Sidebar;

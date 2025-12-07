import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MessageList from './components/MessageList';
import InputArea from './components/InputArea';
import { ChatSession, Message, generateId, AppMode, Attachment, GenerationConfig } from './types';
import { streamResponse, generateChatTitle, generateImage, generateVideo, generateSpeech, LiveClient } from './services/geminiService';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Live API State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const liveClientRef = useRef<LiveClient | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const currentMessages = currentSession?.messages || [];

  useEffect(() => {
    if (sessions.length === 0) createNewChat();
  }, []);

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: generateId(),
      title: 'New Chat',
      messages: [],
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setIsStreaming(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (currentSessionId === id) {
        if (filtered.length > 0) setCurrentSessionId(filtered[0].id);
        else setCurrentSessionId(null); 
      }
      return filtered;
    });
  };

  const updateSessionTitle = useCallback(async (sessionId: string, firstMessage: string) => {
    const title = await generateChatTitle(firstMessage);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title } : s));
  }, []);

  const addMessageToSession = (sessionId: string, message: Message) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, messages: [...s.messages, message], updatedAt: Date.now() };
      }
      return s;
    }));
  };

  const updateMessageInSession = (sessionId: string, messageId: string, updates: Partial<Message>) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        const msgs = s.messages.map(m => m.id === messageId ? { ...m, ...updates } : m);
        return { ...s, messages: msgs };
      }
      return s;
    }));
  };

  const handleLiveToggle = async (shouldBeActive: boolean) => {
      if (shouldBeActive) {
          setIsLiveActive(true);
          const client = new LiveClient((status) => {
             if (status === 'disconnected' || status === 'error') {
                 setIsLiveActive(false);
                 liveClientRef.current = null;
             }
          });
          liveClientRef.current = client;
          await client.connect();
      } else {
          liveClientRef.current?.disconnect();
          liveClientRef.current = null;
          setIsLiveActive(false);
      }
  };

  const handleSendMessage = async (
    text: string, 
    mode: AppMode, 
    config: GenerationConfig, 
    attachments: Attachment[]
  ) => {
    if (!currentSessionId || isStreaming) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: attachments
    };

    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'model',
      content: '', 
      timestamp: Date.now(),
      isStreaming: true
    };

    addMessageToSession(currentSessionId, userMessage);
    addMessageToSession(currentSessionId, assistantMessage);
    
    setIsStreaming(true);
    abortControllerRef.current = new AbortController();

    if (currentMessages.length === 0) updateSessionTitle(currentSessionId, text || "Media Generation");

    try {
      if (mode === 'image') {
        updateMessageInSession(currentSessionId, assistantMessageId, { content: 'Generating image...' });
        const resultUrl = await generateImage(text, config, attachments[0]);
        updateMessageInSession(currentSessionId, assistantMessageId, { content: '', generatedImage: resultUrl });
      } 
      else if (mode === 'video') {
        updateMessageInSession(currentSessionId, assistantMessageId, { content: 'Generating video... this may take a moment.' });
        const resultUrl = await generateVideo(text, config, attachments[0]);
        updateMessageInSession(currentSessionId, assistantMessageId, { content: '', generatedVideo: resultUrl });
      }
      else if (mode === 'tts') {
        updateMessageInSession(currentSessionId, assistantMessageId, { content: 'Generating speech...' });
        const audioUrl = await generateSpeech(text);
        updateMessageInSession(currentSessionId, assistantMessageId, { content: text, audioData: audioUrl });
      }
      else {
        // Chat, Maps, Thinking, Fast, Audio Analysis, Image Analysis
        const historyContext = currentMessages; // Use only past messages
        await streamResponse(
          historyContext, 
          text, 
          attachments, 
          mode, 
          (chunk) => {
             setSessions(prev => prev.map(session => {
                if (session.id === currentSessionId) {
                  const msgs = session.messages.map(m => 
                    m.id === assistantMessageId ? { ...m, content: m.content + chunk } : m
                  );
                  return { ...session, messages: msgs };
                }
                return session;
             }));
          }, 
          abortControllerRef.current.signal
        );
      }
    } catch (error) {
      if (!abortControllerRef.current?.signal.aborted) {
        updateMessageInSession(currentSessionId, assistantMessageId, {
           content: error instanceof Error ? error.message : "Error occurred",
           isError: true
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
      updateMessageInSession(currentSessionId, assistantMessageId, { isStreaming: false });
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  return (
    <div className="flex h-screen bg-[#343541] text-gray-100 font-sans">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => setCurrentSessionId(id)}
        onNewChat={createNewChat}
        onDeleteSession={deleteSession}
      />

      <div className="flex-1 flex flex-col h-full relative">
        <div className="flex items-center p-2 text-gray-300 border-b border-white/10 md:hidden bg-[#343541]">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-700 rounded-md">
            <Menu size={24} />
          </button>
          <span className="mx-auto font-medium">{currentSession?.title || 'New Chat'}</span>
          <div className="w-10" />
        </div>

        <div className="flex-1 overflow-hidden relative flex flex-col">
          <MessageList messages={currentMessages} isStreaming={isStreaming} />
          <div className="w-full bg-gradient-to-t from-[#343541] via-[#343541] to-transparent pt-10 pb-6">
            <InputArea 
              onSend={handleSendMessage} 
              disabled={false} 
              isStreaming={isStreaming}
              onStop={handleStopGeneration}
              onLiveToggle={handleLiveToggle}
              isLiveActive={isLiveActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
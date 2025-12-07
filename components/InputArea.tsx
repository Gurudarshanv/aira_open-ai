import React, { useState, useRef, useEffect } from 'react';
import { Send, StopCircle, Mic, MicOff, Paperclip, X, Image as ImageIcon, Video, Map, Brain, MessageSquare, Settings2, Loader2, Zap, AudioLines, Radio } from 'lucide-react';
import { Attachment, AppMode, GenerationConfig } from '../types';

interface InputAreaProps {
  onSend: (message: string, mode: AppMode, config: GenerationConfig, attachments: Attachment[]) => void;
  disabled: boolean;
  isStreaming: boolean;
  onStop: () => void;
  onLiveToggle: (isActive: boolean) => void;
  isLiveActive: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, disabled, isStreaming, onStop, onLiveToggle, isLiveActive }) => {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<AppMode>('chat');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  
  // Generation Configs
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [videoAr, setVideoAr] = useState('16:9');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (isStreaming) return;
    if (!input.trim() && attachments.length === 0) return;
    
    const config: GenerationConfig = {
      aspectRatio: mode === 'video' ? videoAr : aspectRatio,
      imageSize,
      resolution: '720p'
    };

    onSend(input, mode, config, attachments);
    
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Raw = event.target?.result as string;
        const base64Data = base64Raw.split(',')[1];
        setAttachments(prev => [...prev, {
          mimeType: file.type,
          data: base64Data,
          name: file.name
        }]);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // UI Helpers
  const getModeIcon = (m: AppMode) => {
    switch(m) {
      case 'thinking': return <Brain size={16} className="text-purple-400" />;
      case 'maps': return <Map size={16} className="text-blue-400" />;
      case 'image': return <ImageIcon size={16} className="text-pink-400" />;
      case 'video': return <Video size={16} className="text-orange-400" />;
      case 'fast': return <Zap size={16} className="text-yellow-400" />;
      case 'tts': return <AudioLines size={16} className="text-green-400" />;
      case 'live': return <Radio size={16} className="text-red-500" />;
      default: return <MessageSquare size={16} className="text-emerald-400" />;
    }
  };

  const getModeLabel = (m: AppMode) => {
    switch(m) {
      case 'thinking': return 'Deep Think';
      case 'maps': return 'Maps';
      case 'image': return 'Image';
      case 'video': return 'Video';
      case 'fast': return 'Fast';
      case 'tts': return 'TTS';
      case 'live': return 'Live';
      default: return 'Chat';
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 bg-[#343541] md:bg-transparent">
      {/* Control Toolbar */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 scrollbar-none">
         {(['chat', 'fast', 'thinking', 'maps', 'image', 'video', 'tts', 'live'] as AppMode[]).map((m) => (
           <button
             key={m}
             onClick={() => setMode(m)}
             disabled={isLiveActive && m !== 'live'}
             className={`
               flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap
               ${mode === m 
                 ? 'bg-gray-700 text-white ring-1 ring-white/20' 
                 : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}
               ${isLiveActive && m !== 'live' ? 'opacity-30 cursor-not-allowed' : ''}
             `}
           >
             {getModeIcon(m)}
             {getModeLabel(m)}
           </button>
         ))}
      </div>

      {/* Configuration Panel */}
      {(mode === 'image' || mode === 'video') && (
        <div className="flex flex-wrap gap-3 mb-3 p-3 bg-gray-800/40 rounded-lg border border-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-400">
               <Settings2 size={12} />
               <span>Settings:</span>
            </div>
            {mode === 'image' && (
              <>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="bg-gray-900 text-xs text-gray-300 rounded px-2 py-1 border border-gray-700">
                  <option value="1:1">1:1 Square</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
                </select>
                 <select value={imageSize} onChange={(e) => setImageSize(e.target.value)} className="bg-gray-900 text-xs text-gray-300 rounded px-2 py-1 border border-gray-700">
                  <option value="1K">1K</option>
                  <option value="2K">2K</option>
                  <option value="4K">4K</option>
                </select>
              </>
            )}
            {mode === 'video' && (
              <select value={videoAr} onChange={(e) => setVideoAr(e.target.value)} className="bg-gray-900 text-xs text-gray-300 rounded px-2 py-1 border border-gray-700">
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Portrait</option>
              </select>
            )}
        </div>
      )}

      {/* Live Mode Interface */}
      {mode === 'live' ? (
         <div className="flex flex-col items-center justify-center p-6 bg-[#40414f] rounded-xl border border-black/10 shadow-md">
            <div className="mb-4 text-center">
               <h3 className="text-white font-semibold mb-1">Live Voice Conversation</h3>
               <p className="text-gray-400 text-xs">{isLiveActive ? "Listening..." : "Click start to begin a real-time voice chat with Aira."}</p>
            </div>
            <button
               onClick={() => onLiveToggle(!isLiveActive)}
               className={`
                 flex items-center gap-3 px-6 py-3 rounded-full font-semibold transition-all
                 ${isLiveActive 
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'}
               `}
            >
               {isLiveActive ? (
                 <> <StopCircle size={20} className="animate-pulse" /> End Session </>
               ) : (
                 <> <Mic size={20} /> Start Live Session </>
               )}
            </button>
         </div>
      ) : (
        /* Standard Input Interface */
        <>
          {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto py-1">
              {attachments.map((att, i) => (
                <div key={i} className="relative group shrink-0">
                  <div className="w-16 h-16 rounded-md border border-gray-600 overflow-hidden bg-gray-800 flex items-center justify-center">
                    {att.mimeType.startsWith('image') ? (
                      <img src={`data:${att.mimeType};base64,${att.data}`} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-gray-400 text-center px-1 break-all">{att.name || 'File'}</span>
                    )}
                  </div>
                  <button onClick={() => removeAttachment(i)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="relative flex items-end w-full p-3 bg-[#40414f] rounded-xl border border-black/10 shadow-md focus-within:border-gray-500/50 transition-colors">
            <button onClick={() => fileInputRef.current?.click()} className="p-2 mr-1 text-gray-400 hover:text-gray-200 transition-colors">
              <Paperclip size={20} />
            </button>
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept="image/*,video/*,audio/*" />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={mode === 'tts' ? "Enter text to speak..." : "Send a message..."}
              rows={1}
              disabled={disabled && !isStreaming}
              className="w-full max-h-[200px] py-2 pl-2 pr-24 bg-transparent text-white placeholder-gray-400 border-none focus:ring-0 resize-none outline-none scrollbar-thin scrollbar-thumb-gray-600"
              style={{ overflowY: 'hidden' }}
            />
            
            <button
              onClick={toggleListening}
              disabled={disabled || isStreaming}
              className={`absolute right-12 bottom-3 p-1.5 rounded-md transition-colors ${isListening ? 'bg-red-500/10 text-red-500 animate-pulse' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <button
              onClick={isStreaming ? onStop : handleSend}
              disabled={(!input.trim() && attachments.length === 0) && !isStreaming}
              className={`absolute right-3 bottom-3 p-1.5 rounded-md transition-all ${isStreaming ? 'bg-red-500/80 text-white hover:bg-red-600' : (input.trim() || attachments.length > 0 ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-transparent text-gray-500 cursor-not-allowed')}`}
            >
              {isStreaming ? <StopCircle size={16} className="animate-pulse" /> : <Send size={16} />}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default InputArea;
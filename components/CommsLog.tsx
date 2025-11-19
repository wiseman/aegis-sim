import React, { useEffect, useRef } from 'react';
import { LogMessage } from '../types';

interface CommsLogProps {
  messages: LogMessage[];
}

const CommsLog: React.FC<CommsLogProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gray-900 border border-gray-700 rounded-md overflow-hidden">
      <div className="bg-gray-800 px-3 py-1 text-xs font-bold text-gray-400 uppercase border-b border-gray-700">
        Tactical Net (Secure)
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-sm space-y-1">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.priority === 'high' ? 'text-tactical-amber' : msg.priority === 'critical' ? 'text-tactical-red font-bold' : 'text-tactical-green'}`}>
            <span className="opacity-50 select-none">[{msg.timestamp}]</span>
            <span className="font-bold select-none">{msg.sender}:</span>
            <span>{msg.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default CommsLog;
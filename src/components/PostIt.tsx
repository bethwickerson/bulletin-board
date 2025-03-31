import React, { useState, useRef } from 'react';
import { Note } from '../types';
import { GripHorizontal } from 'lucide-react';

interface PostItProps {
  note: Note;
  onDragEnd: (e: React.DragEvent, id: string) => void;
}

const PostIt: React.FC<PostItProps> = ({ note, onDragEnd }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: note.position.x, y: note.position.y });
  const noteRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent event from bubbling up to the board
    e.stopPropagation();
    
    if (noteRef.current) {
      const rect = noteRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.stopPropagation();
      e.preventDefault();
      
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging) {
      e.stopPropagation();
      
      // Create a synthetic drag event to use with the existing onDragEnd handler
      const syntheticEvent = {
        clientX: e.clientX,
        clientY: e.clientY,
        preventDefault: () => {},
        stopPropagation: () => {}
      } as unknown as React.DragEvent;
      
      onDragEnd(syntheticEvent, note.id);
      setIsDragging(false);
    }
  };

  // Add global mouse event handlers when dragging
  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      };

      const handleGlobalMouseUp = (e: MouseEvent) => {
        // Create a synthetic drag event to use with the existing onDragEnd handler
        const syntheticEvent = {
          clientX: e.clientX,
          clientY: e.clientY,
          preventDefault: () => {},
          stopPropagation: () => {}
        } as unknown as React.DragEvent;
        
        onDragEnd(syntheticEvent, note.id);
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, dragOffset, note.id, onDragEnd]);

  console.log('Rendering PostIt:', note);
  console.log('Note type:', note.type);
  console.log('Meme URL:', note.memeUrl);
  
  return (
    <div
      ref={noteRef}
      className="absolute cursor-move shadow-lg rounded-lg w-64 p-4 select-none"
      style={{
        left: position.x,
        top: position.y,
        backgroundColor: note.color,
        transform: 'rotate(-1deg)',
        zIndex: isDragging ? 1000 : 1,
        opacity: isDragging ? 0.8 : 1,
        transition: isDragging ? 'none' : 'opacity 0.2s'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="flex justify-between items-start mb-2">
        <GripHorizontal className="text-gray-600" size={20} />
      </div>
      
      {note.type === 'meme' && note.memeUrl && (
        <div className="mb-4">
          {/* Display the image */}
          {note.memeUrl.startsWith('data:') ? (
            // If it's a data URL (base64), display it directly
            <img 
              src={note.memeUrl} 
              alt="Meme" 
              className="w-full h-auto rounded shadow-md" 
              style={{ minHeight: '100px' }}
              onError={(e) => {
                console.error('Image failed to load');
                // @ts-expect-error - Event target is an HTMLImageElement
                e.target.style.backgroundColor = 'red';
                // @ts-expect-error - Event target is an HTMLImageElement
                e.target.style.height = '100px';
                // @ts-expect-error - Event target is an HTMLImageElement
                e.target.style.display = 'flex';
                // @ts-expect-error - Event target is an HTMLImageElement
                e.target.style.alignItems = 'center';
                // @ts-expect-error - Event target is an HTMLImageElement
                e.target.style.justifyContent = 'center';
                // @ts-expect-error - Event target is an HTMLImageElement
                e.target.innerText = 'Failed to load image';
              }}
              onLoad={() => console.log('Image loaded successfully')}
            />
          ) : (
            // If it's a regular URL, use a proxy
            <img 
              src={`https://images.weserv.nl/?url=${encodeURIComponent(note.memeUrl)}`}
              alt="Meme" 
              className="w-full h-auto rounded shadow-md" 
              style={{ minHeight: '100px' }}
              onError={(e) => {
                console.error('Proxy image failed to load, trying direct URL');
                // Try direct URL as fallback
                // @ts-expect-error - Event target is an HTMLImageElement
                e.target.src = note.memeUrl;
              }}
              onLoad={() => console.log('Proxy image loaded successfully')}
            />
          )}
        </div>
      )}
      
      <div className="text-gray-800 whitespace-pre-wrap break-words">
        {note.content}
      </div>
      
      <div className="mt-4 text-sm text-gray-600 italic">
        From: {note.author}
      </div>
    </div>
  );
};

export default PostIt;

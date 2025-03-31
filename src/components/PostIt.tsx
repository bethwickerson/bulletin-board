import React, { useState, useRef } from 'react';
import { Note } from '../types';
import { GripHorizontal, Trash2, Palette } from 'lucide-react';

// Helper function to remove style information from content
const removeStyleInfo = (content: string): string => {
  return content.replace(/\s*\(Style:.*?\)\s*$/, '');
};

interface PostItProps {
  note: Note;
  onDragEnd: (e: React.DragEvent, id: string) => void;
  onActivate: () => void;
  onDelete: () => void;
  onColorChange: (color: string, opacity: number) => void;
  isActive: boolean;
  isEditable: boolean;
  colorOptions: string[];
}

const PostIt: React.FC<PostItProps> = ({ 
  note, 
  onDragEnd, 
  onActivate, 
  onDelete,
  onColorChange,
  isActive,
  isEditable,
  colorOptions
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: note.position.x, y: note.position.y });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const noteRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent event from bubbling up to the board
    e.stopPropagation();
    
    // Activate this note
    onActivate();
    
    // Only allow dragging if this note is editable and active
    if (isEditable && isActive && noteRef.current) {
      const rect = noteRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditable) {
      onDelete();
    }
  };

  const handleColorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditable) {
      setShowColorPicker(!showColorPicker);
    }
  };

  const handleColorSelect = (color: string) => {
    if (isEditable) {
      onColorChange(color, opacity);
      setShowColorPicker(false);
    }
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseFloat(e.target.value);
    setOpacity(newOpacity);
    // Get the current color from the note and apply the new opacity
    onColorChange(note.color.startsWith('rgba') ? note.color.split(',')[0].replace('rgba(', '#') : note.color, newOpacity);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && isActive && isEditable) {
      e.stopPropagation();
      e.preventDefault();
      
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isDragging && isActive && isEditable) {
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
    if (isDragging && isActive && isEditable) {
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
  }, [isDragging, dragOffset, note.id, onDragEnd, isActive, isEditable]);

  // Close color picker when clicking outside
  React.useEffect(() => {
    if (showColorPicker) {
      const handleClickOutside = (e: MouseEvent) => {
        if (noteRef.current && !noteRef.current.contains(e.target as Node)) {
          setShowColorPicker(false);
        }
      };
      
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showColorPicker]);
  
  return (
    <div
      ref={noteRef}
      className={`absolute shadow-lg rounded-lg w-64 p-4 select-none ${isEditable ? 'cursor-move' : 'cursor-default'}`}
      style={{
        left: position.x,
        top: position.y,
        backgroundColor: note.color,
        transform: 'rotate(-1deg)',
        zIndex: isDragging ? 1000 : (showColorPicker ? 999 : 1),
        opacity: isDragging ? 0.8 : 1,
        transition: isDragging ? 'none' : 'opacity 0.2s, background-color 0.3s',
        border: isActive ? '2px solid #3b82f6' : 'none' // Highlight active note with blue border
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="flex justify-between items-start mb-2">
        {isEditable && (
          <>
            <div className="flex items-center space-x-2">
              <GripHorizontal className="text-gray-600" size={20} />
              <button
                onClick={handleColorClick}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Change color"
              >
                <Palette size={18} />
              </button>
            </div>
            <button 
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-500 transition-colors"
              aria-label="Delete note"
            >
              <Trash2 size={18} />
            </button>
          </>
        )}
      </div>
      
      {/* Color picker */}
      {showColorPicker && isEditable && (
        <div className="absolute left-0 right-0 mx-auto p-3 bg-white rounded-lg shadow-lg z-10 mt-1">
          <div className="grid grid-cols-5 gap-2 mb-3">
            {colorOptions.map((color) => (
              <button
                key={color}
                className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => handleColorSelect(color)}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Opacity:</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={handleOpacityChange}
              className="w-full"
            />
            <span className="text-xs text-gray-500">{Math.round(opacity * 100)}%</span>
          </div>
        </div>
      )}
      
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
        {removeStyleInfo(note.content)}
      </div>
      
      <div className="mt-4 text-sm text-gray-600 italic">
        <span>From: {note.author}</span>
      </div>
    </div>
  );
};

export default PostIt;

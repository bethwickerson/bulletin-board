import React, { useState, useRef, useEffect } from 'react';
import { Note } from '../types';
import { GripHorizontal, Trash2, Palette, RotateCw, Maximize2 } from 'lucide-react';

// Helper function to remove style information from content
const removeStyleInfo = (content: string): string => {
  return content.replace(/\s*\(Style:.*?\)\s*$/, '');
};

interface PostItProps {
  note: Note;
  onDragEnd: (position: { x: number, y: number }, id: string) => void;
  onActivate: () => void;
  onDelete: () => void;
  onColorChange: (color: string, opacity: number) => void;
  onResize?: (width: number, height: number, id: string) => void;
  onRotate?: (rotation: number, id: string) => void;
  isActive: boolean;
  isEditable: boolean;
  colorOptions: string[];
  transformScale: number;
  transformPosition: { x: number, y: number };
}

const PostIt: React.FC<PostItProps> = ({ 
  note, 
  onDragEnd, 
  onActivate, 
  onDelete,
  onColorChange,
  onResize,
  onRotate,
  isActive,
  isEditable,
  colorOptions,
  transformScale,
  transformPosition
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: note.position.x, y: note.position.y });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [size, setSize] = useState({ 
    width: note.width || 256, 
    height: note.height || 'auto' 
  });
  const [rotation, setRotation] = useState(note.rotation || -1);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 });
  const [rotateStartAngle, setRotateStartAngle] = useState(0);
  const noteRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent event from bubbling up to the board
    e.stopPropagation();
    
    // Activate this note
    onActivate();
    
    // Allow dragging for all notes, but only if not currently resizing or rotating
    // Only check isActive, not isEditable
    if (isActive && noteRef.current && !isResizing && !isRotating) {
      // Account for the transform scale and position
      // The mouse position needs to be adjusted based on the transform
      const adjustedX = (e.clientX - transformPosition.x) / transformScale;
      const adjustedY = (e.clientY - transformPosition.y) / transformScale;
      
      setDragOffset({
        x: adjustedX - position.x,
        y: adjustedY - position.y
      });
      setIsDragging(true);
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Allow resizing for all notes, not just editable ones
    if (isActive && noteRef.current) {
      setIsResizing(true);
      setResizeStartPos({ x: e.clientX, y: e.clientY });
      setResizeStartSize({ 
        width: typeof size.width === 'number' ? size.width : 256,
        height: typeof size.height === 'number' ? size.height : 256
      });
    }
  };

  const handleResizeMove = (e: React.MouseEvent) => {
    if (isResizing && isActive) {
      e.stopPropagation();
      e.preventDefault();
      
      const deltaX = e.clientX - resizeStartPos.x;
      const deltaY = e.clientY - resizeStartPos.y;
      
      // Calculate new size with minimum constraints
      const newWidth = Math.max(150, resizeStartSize.width + deltaX);
      const newHeight = Math.max(150, resizeStartSize.height + deltaY);
      
      setSize({ width: newWidth, height: newHeight });
    }
  };

  const handleResizeEnd = () => {
    if (isResizing && isActive && onResize) {
      setIsResizing(false);
      
      // Call the onResize callback to update the database
      const newWidth = typeof size.width === 'number' ? size.width : 256;
      const newHeight = typeof size.height === 'number' ? size.height : 256;
      onResize(newWidth, newHeight, note.id);
    }
  };

  const handleRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Allow rotation for all notes, not just editable ones
    if (isActive && noteRef.current) {
      setIsRotating(true);
      
      // Calculate the center of the note
      const rect = noteRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate the initial angle
      const initialAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      setRotateStartAngle(initialAngle);
    }
  };

  const handleRotateMove = (e: React.MouseEvent) => {
    if (isRotating && isActive && noteRef.current) {
      e.stopPropagation();
      e.preventDefault();
      
      // Calculate the center of the note
      const rect = noteRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Calculate the current angle
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      
      // Calculate the rotation delta in degrees
      const angleDelta = (currentAngle - rotateStartAngle) * (180 / Math.PI);
      
      // Update the rotation (add to the existing rotation)
      setRotation((prevRotation: number) => {
        const newRotation = prevRotation + angleDelta;
        return newRotation;
      });
      
      // Update the start angle for the next move
      setRotateStartAngle(currentAngle);
    }
  };

  const handleRotateEnd = () => {
    if (isRotating && isActive && onRotate) {
      setIsRotating(false);
      
      // Call the onRotate callback to update the database
      onRotate(rotation, note.id);
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
    if (isDragging && isActive) {
      e.stopPropagation();
      e.preventDefault();
      
      // Account for the transform scale and position
      // The mouse position needs to be adjusted based on the transform
      const adjustedX = (e.clientX - transformPosition.x) / transformScale;
      const adjustedY = (e.clientY - transformPosition.y) / transformScale;
      
      setPosition({
        x: adjustedX - dragOffset.x,
        y: adjustedY - dragOffset.y
      });
    } else if (isResizing) {
      handleResizeMove(e);
    } else if (isRotating) {
      handleRotateMove(e);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && isActive) {
      // Pass the current position directly to onDragEnd
      onDragEnd(position, note.id);
      setIsDragging(false);
    } else if (isResizing) {
      handleResizeEnd();
    } else if (isRotating) {
      handleRotateEnd();
    }
  };

  // Add global mouse event handlers when dragging, resizing, or rotating
  useEffect(() => {
    // For dragging, resizing, and rotating, only check isActive, not isEditable
    if ((isDragging || isResizing || isRotating) && isActive) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (isDragging) {
          // Account for the transform scale and position
          // The mouse position needs to be adjusted based on the transform
          const adjustedX = (e.clientX - transformPosition.x) / transformScale;
          const adjustedY = (e.clientY - transformPosition.y) / transformScale;
          
          setPosition({
            x: adjustedX - dragOffset.x,
            y: adjustedY - dragOffset.y
          });
        } else if (isResizing) {
          const deltaX = e.clientX - resizeStartPos.x;
          const deltaY = e.clientY - resizeStartPos.y;
          
          // Calculate new size with minimum constraints
          const newWidth = Math.max(150, resizeStartSize.width + deltaX);
          const newHeight = Math.max(150, resizeStartSize.height + deltaY);
          
          setSize({ width: newWidth, height: newHeight });
        } else if (isRotating && noteRef.current) {
          // Calculate the center of the note
          const rect = noteRef.current.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          // Calculate the current angle
          const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
          
          // Calculate the rotation delta in degrees
          const angleDelta = (currentAngle - rotateStartAngle) * (180 / Math.PI);
          
          // Update the rotation (add to the existing rotation)
          setRotation((prevRotation: number) => {
            const newRotation = prevRotation + angleDelta;
            return newRotation;
          });
          
          // Update the start angle for the next move
          setRotateStartAngle(currentAngle);
        }
      };

      const handleGlobalMouseUp = () => {
        if (isDragging) {
          // Pass the current position directly to onDragEnd
          onDragEnd(position, note.id);
          setIsDragging(false);
        } else if (isResizing && onResize) {
          setIsResizing(false);
          
          // Call the onResize callback to update the database
          const newWidth = typeof size.width === 'number' ? size.width : 256;
          const newHeight = typeof size.height === 'number' ? size.height : 256;
          onResize(newWidth, newHeight, note.id);
        } else if (isRotating && onRotate) {
          setIsRotating(false);
          
          // Call the onRotate callback to update the database
          onRotate(rotation, note.id);
        }
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [
    isDragging, isResizing, isRotating, 
    dragOffset, resizeStartPos, resizeStartSize, rotateStartAngle,
    note.id, onDragEnd, onResize, onRotate,
    isActive, isEditable, rotation, size,
    transformScale, transformPosition
  ]);

  // Close color picker when clicking outside
  useEffect(() => {
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
      className={`absolute shadow-lg rounded-lg select-none ${!isResizing && !isRotating ? 'cursor-move' : 'cursor-default'}`}
      style={{
        left: position.x,
        top: position.y,
        width: typeof size.width === 'number' ? `${size.width}px` : size.width,
        height: typeof size.height === 'number' ? `${size.height}px` : size.height,
        backgroundColor: note.color,
        transform: `rotate(${rotation}deg)`,
        zIndex: isDragging || isResizing || isRotating ? 1000 : (showColorPicker ? 999 : 1),
        opacity: isDragging ? 0.8 : 1,
        transition: isDragging || isResizing || isRotating ? 'none' : 'opacity 0.2s, background-color 0.3s',
        border: isActive ? '2px solid #3b82f6' : 'none', // Highlight active note with blue border
        padding: '1rem',
        overflow: 'hidden'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          {/* Maintain space for icons but only show them when note is active */}
          <GripHorizontal 
            className="text-gray-600" 
            size={20} 
            style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.2s' }}
          />
          <button
            onMouseDown={handleRotateStart}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Rotate note"
            title="Rotate note"
            style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.2s' }}
            disabled={!isActive}
          >
            <RotateCw size={18} />
          </button>
          
          {/* Show color picker button only for active and editable notes */}
          {isActive && isEditable && (
          <button
            onClick={handleColorClick}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Change color"
            title="Change color"
          >
            <Palette size={18} />
          </button>
          )}
        </div>
        
        {/* Show delete button only for active and editable notes */}
        {isActive && isEditable && (
        <button 
          onClick={handleDelete}
          className="text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Delete note"
          title="Delete note"
        >
          <Trash2 size={18} />
        </button>
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
      
      {(note.type === 'meme' || note.type === 'image') && note.memeUrl && (
        <div className="mb-4 overflow-hidden">
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
      
      {note.content && (
        <div className="text-gray-800 whitespace-pre-wrap break-words">
          {removeStyleInfo(note.content)}
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600 italic">
        <span>From: {note.author}</span>
      </div>
      
      {/* Resize handle - show for all active notes */}
      {isActive && (
        <div 
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center"
          onMouseDown={handleResizeStart}
          title="Resize note"
        >
          <Maximize2 size={14} className="text-gray-400" />
        </div>
      )}
    </div>
  );
};

export default PostIt;

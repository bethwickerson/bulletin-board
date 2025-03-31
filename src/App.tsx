import React, { useState, useCallback, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Plus } from 'lucide-react';
import PostIt from './components/PostIt';
import AddNoteDialog from './components/AddNoteDialog';
import { Note } from './types';
import { supabase } from './lib/supabase';

const COLORS = [
  '#fef3c7', // Yellow
  '#dbeafe', // Blue
  '#dcfce7', // Green
  '#fce7f3', // Pink
  '#f3e8ff', // Purple
];

// Additional colors for the color picker
const COLOR_OPTIONS = [
  '#fef3c7', // Yellow
  '#dbeafe', // Blue
  '#dcfce7', // Green
  '#fce7f3', // Pink
  '#f3e8ff', // Purple
  '#fee2e2', // Red
  '#ffedd5', // Orange
  '#ecfccb', // Lime
  '#d1fae5', // Emerald
  '#cffafe', // Cyan
  '#e0e7ff', // Indigo
  '#ede9fe', // Violet
  '#fae8ff', // Fuchsia
  '#f5f5f5', // Gray
  '#ffffff', // White
];

function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
  const [gridScale, setGridScale] = useState(1);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [myNoteIds, setMyNoteIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<number>(1); // Start with 1 (self)
  const [showTip, setShowTip] = useState(false);
  const [tipMessage, setTipMessage] = useState('');
  
  // Load notes created in this session from localStorage
  useEffect(() => {
    const savedNoteIds = localStorage.getItem('myBulletinBoardNotes');
    if (savedNoteIds) {
      try {
        const parsedIds = JSON.parse(savedNoteIds);
        if (Array.isArray(parsedIds)) {
          setMyNoteIds(parsedIds);
          console.log('Loaded my note IDs:', parsedIds);
        }
      } catch (e) {
        console.error('Error parsing saved note IDs:', e);
        localStorage.removeItem('myBulletinBoardNotes');
      }
    }
  }, []);
  
  // Save my note IDs whenever they change
  useEffect(() => {
    if (myNoteIds.length > 0) {
      localStorage.setItem('myBulletinBoardNotes', JSON.stringify(myNoteIds));
      console.log('Saved my note IDs:', myNoteIds);
    }
  }, [myNoteIds]);

  // Set up presence channel to track online users
  useEffect(() => {
    // Generate a random user ID for this session
    const userId = Math.random().toString(36).substring(2, 15);
    
    // Create a presence channel
    const presenceChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    // Set up presence handlers
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        // Get the current state of all online users
        const state = presenceChannel.presenceState();
        // Count the number of unique users
        const userCount = Object.keys(state).length;
        console.log('Online users:', userCount);
        setOnlineUsers(userCount);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Enter the channel with our user ID
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      presenceChannel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchNotes = async () => {
      console.log('Fetching notes...');
      setIsLoading(true);
      
      // Limit the number of notes to fetch to prevent timeout
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false }) // Newest first
        .limit(100); // Limit to 100 notes to prevent timeout

      if (error) {
        console.error('Error fetching notes:', error);
        return;
      }

      console.log('Notes fetched:', data);
      console.log('Number of notes:', data?.length || 0);
      
      if (data) {
        // Update positions of all notes to be visible
        for (const note of data) {
          if (note.position_x > 1000 || note.position_y > 1000) {
            console.log('Updating position of note:', note.id);
            // Update the position in the database
            await supabase
              .from('notes')
              .update({
                position_x: 100 + Math.random() * 300, // Random position in the visible area
                position_y: 100 + Math.random() * 300, // Random position in the visible area
              })
              .eq('id', note.id);
          }
        }
        
        // Fetch the notes again after updating positions, with limit
        const { data: updatedData } = await supabase
          .from('notes')
          .select('*')
          .order('created_at', { ascending: false }) // Newest first
          .limit(100); // Limit to 100 notes to prevent timeout
        
        if (!updatedData) {
          return;
        }
        
        const mappedNotes = updatedData.map(note => {
          console.log('Processing note:', note);
          console.log('Note ID:', note.id);
          console.log('Note Type:', note.type);
          console.log('Note Position:', note.position_x, note.position_y);
          console.log('Meme URL:', note.meme_url);
          
          return {
            id: note.id,
            content: note.content,
            position: {
              x: note.position_x,
              y: note.position_y,
            },
            author: note.author,
            color: note.color,
            type: note.type as 'text' | 'meme' | 'image',
            memeUrl: note.meme_url,
            width: note.width,
            height: note.height,
            rotation: note.rotation
          };
        });
        
        console.log('Mapped notes:', mappedNotes);
        console.log('Number of mapped notes:', mappedNotes.length);
        setNotes(mappedNotes);
      }
      
      setIsLoading(false);
    };

    fetchNotes();

    // Subscribe to real-time changes
    const channel = supabase.channel('notes_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notes'
        },
        (payload) => {
          console.log('Insert received!', payload);
          fetchNotes(); // Refetch all notes to ensure consistency
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes'
        },
        (payload) => {
          console.log('Update received!', payload);
          fetchNotes(); // Refetch all notes to ensure consistency
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notes'
        },
        (payload) => {
          console.log('Delete received!', payload);
          fetchNotes(); // Refetch all notes to ensure consistency
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from channel');
      channel.unsubscribe();
    };
  }, []);

  const handleAddNote = async (content: string, author: string, type: 'text' | 'meme' | 'image', imageData?: string) => {
    
    // Use a visible position for notes (0-1000 range)
    const position = {
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 300,
    };

    // Prepare the data to insert
    const noteData: {
      content: string;
      position_x: number;
      position_y: number;
      author: string;
      color: string;
      type: 'text' | 'meme' | 'image';
      meme_url?: string;
    } = {
      content,
      position_x: position.x,
      position_y: position.y,
      author,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      type
    };

    // If it's an image type and we have image data, add it to the meme_url field
    if (type === 'image' && imageData) {
      noteData.meme_url = imageData;
    }

    const { data, error } = await supabase
      .from('notes')
      .insert([noteData])
      .select();

    if (error) {
      console.error('Error adding note:', error);
    } else if (data && data.length > 0) {
      // Add the new note ID to my notes
      const newNoteId = data[0].id;
      setMyNoteIds(prev => [...prev, newNoteId]);
      
      // Show tip message
      setTipMessage('Tip: You can drag, resize, rotate, and change the color of your note!');
      setShowTip(true);
      
      // Hide tip after 8 seconds
      setTimeout(() => {
        setShowTip(false);
      }, 8000);
    }
  };

  const handleGenerateMeme = async (prompt: string, author: string) => {
    try {
      console.log('Generating meme with prompt:', prompt);
      console.log('Calling generate-meme function...');
      
      
      const response = await fetch('/.netlify/functions/generate-meme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt,
          style: prompt.includes("Style:") ? undefined : "cartoon sticker" // Default style if not specified
        }),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Failed to generate meme: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Response data:', responseData);
      
      // Get the URL from the response
      const { url, message } = responseData;
      console.log('Meme URL from OpenAI:', url);
      console.log('Message:', message || 'No message');
      
      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid meme URL received from OpenAI');
      }
      
      // Use the direct URL since base64 is no longer provided
      const imageUrl = url;
      console.log('Using image URL:', imageUrl);
      
      // Add the meme as a new note
      // Place meme notes in a fixed position that's guaranteed to be visible
      console.log('Adding meme note with URL/data');
      
      // Place the meme note at a fixed position in the top-left corner of the viewport
      // Use absolute coordinates (0-1000) instead of the large board coordinates
      const { data, error } = await supabase
        .from('notes')
        .insert([{
          content: prompt,
          position_x: 100, // Fixed position in the top-left corner (0-1000 range)
          position_y: 100, // Fixed position in the top-left corner (0-1000 range)
          author,
          color: '#ff9999', // Bright pink color for high visibility
          type: 'meme',
          meme_url: imageUrl // Use the base64 data if available, otherwise use the URL
        }])
        .select();
      
      console.log('Meme note added:', data);

      if (error) {
        console.error('Error adding meme note:', error);
      } else if (data && data.length > 0) {
        // Add the new meme note ID to my notes
        const newNoteId = data[0].id;
        setMyNoteIds(prev => [...prev, newNoteId]);
        
        // Show tip message
        setTipMessage('Tip: You can drag, resize, rotate, and change the color of your meme!');
        setShowTip(true);
        
        // Hide tip after 8 seconds
        setTimeout(() => {
          setShowTip(false);
        }, 8000);
      }
    } catch (error) {
      console.error('Error generating meme:', error);
    }
  };

  const handleDragEnd = useCallback(async (position: { x: number, y: number }, id: string) => {
    // Update the position in the database with the position provided by the PostIt component
    const { error } = await supabase
      .from('notes')
      .update({
        position_x: position.x,
        position_y: position.y,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating note position:', error);
    }
    
    // Reset active note after drag ends
    setActiveNoteId(null);
  }, [notes]);
  
  const handleNoteActivate = useCallback((id: string) => {
    // Allow activation of any note for dragging purposes
    setActiveNoteId(id);
  }, []);
  
  const handleDeleteNote = useCallback(async (id: string) => {
    // Only allow deletion if this is one of my notes
    if (!myNoteIds.includes(id)) {
      console.log('Cannot delete note: not created in this session');
      return;
    }
    
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
      
    if (error) {
      console.error('Error deleting note:', error);
    }
    
    // Reset active note if the deleted note was active
    if (activeNoteId === id) {
      setActiveNoteId(null);
    }
    // Remove the note ID from my notes
    setMyNoteIds(prev => prev.filter(noteId => noteId !== id));
  }, [activeNoteId, myNoteIds]);
  
  const handleColorChange = useCallback(async (id: string, color: string, opacity: number = 1) => {
    // Only allow color change if this is one of my notes
    if (!myNoteIds.includes(id)) {
      console.log('Cannot change color: not created in this session');
      return;
    }
    
    // Apply opacity to the color
    let finalColor = color;
    if (opacity < 1) {
      // Convert hex to rgba
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      finalColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    
    const { error } = await supabase
      .from('notes')
      .update({
        color: finalColor
      })
      .eq('id', id);
      
    if (error) {
      console.error('Error updating note color:', error);
    }
  }, [myNoteIds]);

  const handleResize = useCallback(async (width: number, height: number, id: string) => {
    // Only allow resize if this is one of my notes
    if (!myNoteIds.includes(id)) {
      console.log('Cannot resize note: not created in this session');
      return;
    }
    
    console.log('Updating note size:', id, width, height);
    
    const { error } = await supabase
      .from('notes')
      .update({
        width,
        height
      })
      .eq('id', id);
      
    if (error) {
      console.error('Error updating note size:', error);
    } else {
      console.log('Note size updated successfully');
    }
  }, [myNoteIds]);

  const handleRotate = useCallback(async (rotation: number, id: string) => {
    // Only allow rotation if this is one of my notes
    if (!myNoteIds.includes(id)) {
      console.log('Cannot rotate note: not created in this session');
      return;
    }
    
    console.log('Updating note rotation:', id, rotation);
    
    const { error } = await supabase
      .from('notes')
      .update({
        rotation
      })
      .eq('id', id);
      
    if (error) {
      console.error('Error updating note rotation:', error);
    } else {
      console.log('Note rotation updated successfully');
    }
  }, [myNoteIds]);

  const handleTransform = useCallback((ref: { state: { positionX: number, positionY: number, scale: number } }) => {
    setGridPosition({ x: ref.state.positionX, y: ref.state.positionY });
    setGridScale(ref.state.scale);
  }, []);

  return (
      <div className="h-screen w-screen overflow-hidden bg-gray-100">
      {/* Background grid that moves with the transform */}
      <div 
        className="absolute inset-0 pointer-events-none bg-grid-pattern" 
        style={{ 
          backgroundPosition: `${gridPosition.x}px ${gridPosition.y}px`,
          backgroundSize: `${30 * gridScale}px ${30 * gridScale}px`
        }}
      />
      
      {/* Loading message */}
      {isLoading && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-md z-50 flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading notes...
        </div>
      )}
      
      {/* Tip message after creating a note */}
      {showTip && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg shadow-md z-50 flex items-center animate-fadeIn">
          <svg className="h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {tipMessage}
        </div>
      )}
      
      {/* Online users indicator */}
      <div className="fixed top-4 right-4 bg-white px-4 py-2 rounded-lg shadow-md z-50 flex items-center">
        <div className="h-3 w-3 rounded-full bg-green-500 mr-2 animate-pulse"></div>
        <span>{onlineUsers} {onlineUsers === 1 ? 'user' : 'users'} online</span>
      </div>
      
      
      {/* TransformWrapper with initial position set to center of the board */}
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={2}
        wheel={{ step: 0.1 }}
        initialPositionX={-500} 
        initialPositionY={-500}
        panning={{ disabled: false, velocityDisabled: false }}
        limitToBounds={false}
        centerOnInit={true}
        onTransformed={handleTransform}
      >
        <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full">
          <div className="relative w-[100000px] h-[100000px]">
            {/* Center image - positioned at the center of the board */}
            <div 
              className="absolute"
              style={{ 
                left: '250px',
                top: '200px',  
                width: '500px',
                height: '500px',
                zIndex: -1
              }}
            >
              <img 
                src="/HappyBirthdayBoy.jpg" 
                alt="Bulletin Board" 
                className="rounded-lg shadow-xl"
                width="600"
                height="400"
              />
            </div>
            
            {notes.map((note) => (
              <PostIt
                key={note.id}
                note={note}
                onDragEnd={handleDragEnd}
                onActivate={() => handleNoteActivate(note.id)}
                onDelete={() => handleDeleteNote(note.id)}
                onColorChange={(color, opacity) => handleColorChange(note.id, color, opacity)}
                onResize={handleResize}
                onRotate={handleRotate}
                isActive={note.id === activeNoteId}
                isEditable={myNoteIds.includes(note.id)}
                colorOptions={COLOR_OPTIONS}
                transformScale={gridScale}
                transformPosition={gridPosition}
              />
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>

      {/* Tooltip that bounces up from below on load */}
      <div 
        className="fixed bottom-12 right-28 bg-white text-gray-800 px-4 py-2 rounded-lg
                  pointer-events-none flex items-center"
        style={{
          animation: 'tooltipBounce 1s ease-out forwards',
          boxShadow: '8px 6px 20px rgba(0, 0, 0, 0.2)'
        }}
      >
        <div className="absolute -right-2 top-1/2 transform -translate-y-1/2 w-0 h-0 
                      border-t-8 border-b-8 border-l-8 border-transparent border-l-white"></div>
        Click here to add a note!
      </div>

      <button
        onClick={() => setIsDialogOpen(true)}
        className="fixed bottom-8 right-8 bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
        aria-label="Add note"
      >
        <Plus size={45} />
      </button>

      <AddNoteDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onAddNote={handleAddNote}
        onGenerateMeme={handleGenerateMeme}
      />
    </div>
  );
}

export default App;

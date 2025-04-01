import React, { useState, useCallback, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Plus } from 'lucide-react';
import PostIt from './components/PostIt';
import AddNoteDialog from './components/AddNoteDialog';
import { Note } from './types';
import { supabase } from './lib/supabase';
import { Database } from './lib/database.types';

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
    // Define a function to map database notes to app notes
    const mapNoteFromDb = (note: Database['public']['Tables']['notes']['Row']): Note => ({
      id: note.id,
      content: note.content,
      position: {
        x: note.position_x,
        y: note.position_y,
      },
      author: note.author,
      color: note.color,
      type: note.type as 'text' | 'meme' | 'image',
      memeUrl: note.meme_url || undefined,
      width: note.width || undefined,
      height: note.height || undefined,
      rotation: note.rotation || undefined
    });

    // Function to fetch notes with improved retry logic
    const fetchNotes = async (retryCount = 0) => {
      const maxRetries = 5;
      
      if (retryCount > maxRetries) {
        console.error('Max retries reached when fetching notes');
        setIsLoading(false);
        
        // Show a user-friendly message when all retries fail
        setTipMessage('Having trouble connecting to the database. Please try again later.');
        setShowTip(true);
        
        // Hide tip after 8 seconds
        setTimeout(() => {
          setShowTip(false);
        }, 8000);
        
        // Still show any locally cached notes if available
        return;
      }

      console.log('Fetching notes (attempt ' + (retryCount + 1) + ')...');
      setIsLoading(true);
      
      try {
        // Use a shorter timeout for each attempt
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Local fetch timeout')), 5000);
        });
        
        // Fetch notes with a limit to reduce data size
        const fetchPromise = supabase
          .from('notes')
          .select('*')
          .order('created_at', { ascending: false }) // Newest first
          .limit(100); // Limit to 100 notes to reduce payload size
        
        // Race between fetch and timeout
        const result = await Promise.race([
          fetchPromise,
          timeoutPromise.then(() => {
            throw new Error('Local fetch timeout');
          })
        ]);
        
        const { data, error } = result;

        if (error) {
          console.error('Error fetching notes:', error);
          
          // Handle various error types
          if (
            error.code === '57014' || // Statement timeout
            error.code === 'PGRST002' || // Schema cache error
            error.message.includes('timeout') || // Generic timeout
            error.message.includes('timed out')
          ) {
            const backoffTime = Math.min(500 * Math.pow(2, retryCount), 8000); // Exponential backoff with max of 8 seconds
            console.log(`Retrying in ${backoffTime / 1000} seconds...`);
            setTimeout(() => fetchNotes(retryCount + 1), backoffTime);
            return;
          }
          
          setIsLoading(false);
          return;
        }

        if (!data) {
          setIsLoading(false);
          return;
        }
        
        // Map the notes with minimal logging
        const mappedNotes = data.map(mapNoteFromDb);
        console.log(`Fetched ${mappedNotes.length} notes successfully`);
        
        // Sort notes to prioritize user's own notes at the top
        const sortedNotes = [...mappedNotes].sort((a, b) => {
          const aIsOwn = myNoteIds.includes(a.id);
          const bIsOwn = myNoteIds.includes(b.id);
          
          if (aIsOwn && !bIsOwn) return -1;
          if (!aIsOwn && bIsOwn) return 1;
          return 0;
        });
        
        setNotes(sortedNotes);
        setIsLoading(false);
      } catch (error: unknown) {
        // Log the error with better formatting
        console.error('Error in fetchNotes:', 
          error instanceof Error ? error.message : String(error)
        );
        
        // Retry with exponential backoff
        const backoffTime = Math.min(500 * Math.pow(2, retryCount), 8000);
        console.log(`Retrying in ${backoffTime / 1000} seconds...`);
        setTimeout(() => fetchNotes(retryCount + 1), backoffTime);
        
        // If this is the third retry, show a message to the user
        if (retryCount === 2) {
          setTipMessage('Connection is slow. Still trying to load notes...');
          setShowTip(true);
          
          // Hide tip after 8 seconds
          setTimeout(() => {
            setShowTip(false);
          }, 8000);
        }
      }
    };

    fetchNotes();

    // Subscribe only to changes for the user's own notes if there are any
    let channel;
    
    if (myNoteIds.length > 0) {
      // Create a filter string for the user's notes
      const filterStr = myNoteIds.length === 1 
        ? `id=eq.${myNoteIds[0]}` 
        : `id=in.(${myNoteIds.join(',')})`;
      
      channel = supabase.channel('my_notes_changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'notes',
            filter: filterStr
          },
          (payload) => {
            console.log('Change received for my note:', payload);
            // Refresh all notes when user's own notes change
            fetchNotes();
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });
    } else {
      // If no notes yet, just subscribe to all notes table changes
      channel = supabase.channel('notes_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notes'
          },
          (payload) => {
            console.log('New note inserted:', payload);
            fetchNotes();
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });
    }

    return () => {
      console.log('Unsubscribing from channel');
      channel.unsubscribe();
    };
  }, [myNoteIds]); // Re-subscribe when myNoteIds changes

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
      setIsLoading(true);
      console.log('Generating meme with prompt:', prompt);
      console.log('Calling generate-meme function...');
      
      // Step 1: Generate the meme image
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
        setIsLoading(false);
        throw new Error(`Failed to generate meme: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();
      console.log('Response data:', responseData);
      
      // Get the URL from the response
      const { url, message } = responseData;
      console.log('Meme URL from OpenAI:', url);
      console.log('Message:', message || 'No message');
      
      if (!url || !url.startsWith('http')) {
        setIsLoading(false);
        throw new Error('Invalid meme URL received from OpenAI');
      }
      
      // Use the direct URL since base64 is no longer provided
      const imageUrl = url;
      console.log('Using image URL:', imageUrl);
      
      // Step 2: Add the meme as a new note with retry logic
      const addMemeToDatabase = async (retryCount = 0) => {
        if (retryCount > 3) {
          console.error('Max retries reached when adding meme to database');
          setIsLoading(false);
          return;
        }
        
        try {
          console.log(`Adding meme note to database (attempt ${retryCount + 1})...`);
          
          // Place the meme note at a fixed position in the top-left corner of the viewport
          // Use absolute coordinates (0-1000) instead of the large board coordinates
          const { data, error } = await supabase
            .from('notes')
            .insert([{
              content: prompt,
              position_x: 100 + Math.random() * 100, // Add some randomness to prevent overlap
              position_y: 100 + Math.random() * 100, // Add some randomness to prevent overlap
              author,
              color: '#ff9999', // Bright pink color for high visibility
              type: 'meme',
              meme_url: imageUrl,
              width: 256, // Default width
              height: 256, // Default height
              rotation: 0 // No rotation
            }])
            .select();
          
          if (error) {
            console.error('Error adding meme note:', error);
            
            // If we get a timeout error, retry after a delay
            if (error.code === '57014' || error.code === 'PGRST002' || error.message.includes('timeout')) {
              console.log(`Retrying in ${(retryCount + 1) * 2} seconds...`);
              setTimeout(() => addMemeToDatabase(retryCount + 1), (retryCount + 1) * 2000);
              return;
            }
            
            setIsLoading(false);
          } else if (data && data.length > 0) {
            console.log('Meme note added successfully:', data);
            
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
            
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Unexpected error adding meme to database:', error);
          
          // Retry on unexpected errors
          console.log(`Retrying in ${(retryCount + 1) * 2} seconds...`);
          setTimeout(() => addMemeToDatabase(retryCount + 1), (retryCount + 1) * 2000);
        }
      };
      
      // Start the database operation with retry logic
      await addMemeToDatabase();
      
    } catch (error) {
      console.error('Error generating meme:', error);
      setIsLoading(false);
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
  }, []);
  
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
    
    try {
      // First try to update both width and height
      const { error } = await supabase
        .from('notes')
        .update({
          width,
          height
        })
        .eq('id', id);
        
      if (error) {
        console.error('Error updating note size:', error);
        
        // If we get a schema error, try updating just the width
        if (error.code === 'PGRST204' && error.message.includes('height')) {
          console.log('Height column not found, trying to update width only');
          
          const { error: widthError } = await supabase
            .from('notes')
            .update({
              width
            })
            .eq('id', id);
            
          if (widthError) {
            console.error('Error updating width:', widthError);
          } else {
            console.log('Width updated successfully');
          }
        }
      } else {
        console.log('Note size updated successfully');
      }
    } catch (error) {
      console.error('Unexpected error updating note size:', error);
    }
  }, [myNoteIds]);

  const handleRotate = useCallback(async (rotation: number, id: string) => {
    // Only allow rotation if this is one of my notes
    if (!myNoteIds.includes(id)) {
      console.log('Cannot rotate note: not created in this session');
      return;
    }
    
    console.log('Updating note rotation:', id, rotation);
    
    try {
      const { error } = await supabase
        .from('notes')
        .update({
          rotation
        })
        .eq('id', id);
        
      if (error) {
        console.error('Error updating note rotation:', error);
        
        // If we get a schema error, the rotation column might not exist yet
        if (error.code === 'PGRST204' && error.message.includes('rotation')) {
          console.log('Rotation column not found in schema cache');
          
          // We'll just log this and not retry since the migration will fix it
          console.log('Waiting for migration to add rotation column...');
        }
      } else {
        console.log('Note rotation updated successfully');
      }
    } catch (error) {
      console.error('Unexpected error updating note rotation:', error);
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

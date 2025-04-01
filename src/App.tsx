import React, { useState, useCallback, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Plus } from 'lucide-react';
import PostIt from './components/PostIt';
import AddNoteDialog from './components/AddNoteDialog';
import { Note } from './types';
import { supabase } from './lib/supabase';
import { Database } from './lib/database.types';
import { fetchNotes, getNotesCount, addNote, updateNote, deleteNote } from './lib/db-helpers';

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

    // Function to load notes with pagination and caching
    const loadNotes = async () => {
      setIsLoading(true);
      
      try {
        // Get the total count of notes (uses cache if available)
        const count = await getNotesCount();
        console.log(`Total notes count: ${count}`);
        
        // If there are no notes, return early
        if (count === 0) {
          setIsLoading(false);
          setNotes([]);
          return;
        }
        
        // Calculate number of pages needed
        const PAGE_SIZE = 20;
        const totalPages = Math.ceil(count / PAGE_SIZE);
        let allNotes: Database['public']['Tables']['notes']['Row'][] = [];
        
        // Fetch notes page by page (uses cache if available)
        for (let page = 0; page < totalPages && page < 5; page++) { // Limit to 5 pages (100 notes) initially
          console.log(`Loading page ${page + 1} of ${totalPages}`);
          
          const pageNotes = await fetchNotes(page, PAGE_SIZE);
          
          if (pageNotes.length > 0) {
            allNotes = [...allNotes, ...pageNotes];
            console.log(`Loaded ${pageNotes.length} notes from page ${page + 1}`);
            
            // Update notes incrementally to show progress
            const mappedNotes = allNotes.map(note => mapNoteFromDb(note));
            setNotes(mappedNotes);
          }
        }
        
        // Sort notes to prioritize user's own notes at the top
        const sortedNotes = [...allNotes.map(note => mapNoteFromDb(note))].sort((a, b) => {
          const aIsOwn = myNoteIds.includes(a.id);
          const bIsOwn = myNoteIds.includes(b.id);
          
          if (aIsOwn && !bIsOwn) return -1;
          if (!aIsOwn && bIsOwn) return 1;
          return 0;
        });
        
        setNotes(sortedNotes);
        console.log(`Loaded ${sortedNotes.length} notes successfully`);
      } catch (error) {
        console.error('Error loading notes:', error);
        
        // Show a user-friendly message when loading fails
        setTipMessage('Having trouble connecting to the database. Please try again later.');
        setShowTip(true);
        
        // Hide tip after 8 seconds
        setTimeout(() => {
          setShowTip(false);
        }, 8000);
      } finally {
        setIsLoading(false);
      }
    };

    loadNotes();

    // Optimize realtime subscriptions to reduce server load
    let channel;
    
    // Only subscribe to user's own notes to reduce server load
    if (myNoteIds.length > 0) {
      // Limit the number of notes we subscribe to (max 5)
      const limitedNoteIds = myNoteIds.slice(0, 5);
      
      // Create a filter string for the user's notes
      const filterStr = limitedNoteIds.length === 1 
        ? `id=eq.${limitedNoteIds[0]}` 
        : `id=in.(${limitedNoteIds.join(',')})`;
      
      channel = supabase.channel('my_notes_changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'notes',
            filter: filterStr
          },
          (payload: {
            schema: string;
            table: string;
            commit_timestamp: string;
            eventType: 'INSERT' | 'UPDATE' | 'DELETE';
            new: Record<string, unknown> | null;
            old: Record<string, unknown> | null;
          }) => {
            console.log('Change received for my note:', payload);
            // Only refresh the specific note that changed instead of all notes
            const changedNoteId = (payload.new?.id as string | undefined) || (payload.old?.id as string | undefined);
            
            if (changedNoteId) {
              if (payload.eventType === 'DELETE') {
                // If a note was deleted, remove it from the local state
                setNotes(prev => prev.filter(note => note.id !== changedNoteId));
              } else {
                // For other changes, refresh all notes (could be optimized further)
                fetchNotes();
              }
            } else {
              // Fallback if we can't determine the note ID
              fetchNotes();
            }
          }
        )
        .subscribe((status) => {
          console.log('Realtime subscription status:', status);
        });
    } else {
      // If no notes yet, subscribe to INSERT events only with a throttled refresh
      let lastRefreshTime = 0;
      const REFRESH_THROTTLE = 10000; // 10 seconds minimum between refreshes
      
      channel = supabase.channel('notes_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT', // Only listen for new notes
            schema: 'public',
            table: 'notes'
          },
          (payload: {
            schema: string;
            table: string;
            commit_timestamp: string;
            eventType: 'INSERT';
            new: Record<string, unknown> | null;
            old: Record<string, unknown> | null;
          }) => {
            console.log('New note inserted:', payload);
            
            // Throttle refreshes to reduce server load
            const now = Date.now();
            if (now - lastRefreshTime > REFRESH_THROTTLE) {
              fetchNotes();
              lastRefreshTime = now;
            }
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
    const noteData = {
      content,
      position_x: position.x,
      position_y: position.y,
      author,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      type
    } as Database['public']['Tables']['notes']['Insert'];

    // If it's an image type and we have image data, add it to the meme_url field
    if (type === 'image' && imageData) {
      noteData.meme_url = imageData;
    }

    // Use our helper function to add the note
    const newNote = await addNote(noteData);

    if (newNote) {
      // Add the new note ID to my notes
      setMyNoteIds(prev => [...prev, newNote.id]);
      
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
      
      // Step 2: Add the meme as a new note
      console.log('Adding meme note to database...');
      
      // Prepare the meme note data
      const memeNoteData = {
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
      } as Database['public']['Tables']['notes']['Insert'];
      
      // Use our helper function to add the note
      const newNote = await addNote(memeNoteData);
      
      if (newNote) {
        console.log('Meme note added successfully:', newNote);
        
        // Add the new meme note ID to my notes
        setMyNoteIds(prev => [...prev, newNote.id]);
        
        // Show tip message
        setTipMessage('Tip: You can drag, resize, rotate, and change the color of your meme!');
        setShowTip(true);
        
        // Hide tip after 8 seconds
        setTimeout(() => {
          setShowTip(false);
        }, 8000);
      } else {
        console.error('Failed to add meme note');
      }
      
      setIsLoading(false);
      
    } catch (error) {
      console.error('Error generating meme:', error);
      setIsLoading(false);
    }
  };

  const handleDragEnd = useCallback(async (position: { x: number, y: number }, id: string) => {
    // Update the position in the database with the position provided by the PostIt component
    const success = await updateNote(id, {
      position_x: position.x,
      position_y: position.y,
    });

    if (!success) {
      console.error('Error updating note position');
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
    
    const success = await deleteNote(id);
      
    if (!success) {
      console.error('Error deleting note');
    } else {
      // Reset active note if the deleted note was active
      if (activeNoteId === id) {
        setActiveNoteId(null);
      }
      // Remove the note ID from my notes
      setMyNoteIds(prev => prev.filter(noteId => noteId !== id));
    }
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
    
    const success = await updateNote(id, {
      color: finalColor
    });
      
    if (!success) {
      console.error('Error updating note color');
    }
  }, [myNoteIds]);

  const handleResize = useCallback(async (width: number, height: number, id: string) => {
    // Allow resizing of all notes, not just the user's own notes
    console.log('Updating note size:', id, width, height);
    
    const success = await updateNote(id, {
      width,
      height
    });
    
    if (success) {
      console.log('Note size updated successfully');
    } else {
      console.error('Error updating note size');
    }
  }, []);

  const handleRotate = useCallback(async (rotation: number, id: string) => {
    // Allow rotation of all notes, not just the user's own notes
    console.log('Updating note rotation:', id, rotation);
    
    const success = await updateNote(id, {
      rotation
    });
    
    if (success) {
      console.log('Note rotation updated successfully');
    } else {
      console.error('Error updating note rotation');
    }
  }, []);

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

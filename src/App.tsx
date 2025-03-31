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

  useEffect(() => {
    const fetchNotes = async () => {
      console.log('Fetching notes...');
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: true });

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
        
        // Fetch the notes again after updating positions
        const { data: updatedData } = await supabase
          .from('notes')
          .select('*')
          .order('created_at', { ascending: true });
        
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
            type: note.type as 'text' | 'meme',
            memeUrl: note.meme_url
          };
        });
        
        console.log('Mapped notes:', mappedNotes);
        console.log('Number of mapped notes:', mappedNotes.length);
        setNotes(mappedNotes);
      }
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

  const handleAddNote = async (content: string, author: string, type: 'text' | 'meme') => {
    
    // Use a visible position for notes (0-1000 range)
    const position = {
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 300,
    };

    const { data, error } = await supabase
      .from('notes')
      .insert([{
        content,
        position_x: position.x,
        position_y: position.y,
        author,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        type
      }])
      .select();

    if (error) {
      console.error('Error adding note:', error);
    } else if (data && data.length > 0) {
      // Add the new note ID to my notes
      const newNoteId = data[0].id;
      setMyNoteIds(prev => [...prev, newNoteId]);
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
      
      // Get the URL and base64 data from the response
      const { url, base64 } = responseData;
      console.log('Meme URL from OpenAI:', url);
      
      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid meme URL received from OpenAI');
      }
      
      // Use the base64 data if available
      const imageUrl = base64 || url;
      console.log('Using image URL/data:', imageUrl.substring(0, 50) + '...');
      
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
      }
    } catch (error) {
      console.error('Error generating meme:', error);
    }
  };

  const handleDragEnd = useCallback(async (e: React.DragEvent, id: string) => {
    const { clientX, clientY } = e;
    
    const { error } = await supabase
      .from('notes')
      .update({
        position_x: clientX - 100,
        position_y: clientY - 50,
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating note position:', error);
    }
    
    // Reset active note after drag ends
    setActiveNoteId(null);
  }, []);
  
  const handleNoteActivate = useCallback((id: string) => {
    // Only allow activation if this is one of my notes
    if (myNoteIds.includes(id)) {
      setActiveNoteId(id);
    }
  }, [myNoteIds]);
  
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
      
      {/* Session info indicator */}
      <div className="fixed top-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md z-50">
        <span className="text-sm text-gray-500">You can edit:</span>
        <span className="ml-2 font-medium">{myNoteIds.length} notes</span>
        <span className="ml-2 text-xs text-gray-400">(created in this session)</span>
      </div>
      
      {/* TransformWrapper with initial position set to center of the board */}
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={2}
        wheel={{ step: 0.1 }}
        initialPositionX={0} 
        initialPositionY={0}
        panning={{ disabled: false, velocityDisabled: false }}
        limitToBounds={false}
        centerOnInit={false}
        onTransformed={handleTransform}
      >
        <TransformComponent wrapperClass="w-full h-full" contentClass="w-full h-full">
          <div className="relative w-[1000000px] h-[1000000px]">
            {/* Center image - positioned at the center of the board */}
            <div 
              className="absolute"
              style={{ 
                left: '600px', 
                top: '400px', 
                transform: 'translate(-50%, -50%)',
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
                isActive={note.id === activeNoteId}
                isEditable={myNoteIds.includes(note.id)}
                colorOptions={COLOR_OPTIONS}
              />
            ))}
          </div>
        </TransformComponent>
      </TransformWrapper>

      <button
        onClick={() => setIsDialogOpen(true)}
        className="fixed bottom-8 right-8 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
        aria-label="Add note"
      >
        <Plus size={24} />
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

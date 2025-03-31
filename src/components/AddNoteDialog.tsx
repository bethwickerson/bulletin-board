import React, { useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

interface AddNoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddNote: (content: string, author: string, type: 'text' | 'meme' | 'image', imageData?: string) => void;
  onGenerateMeme: (prompt: string, author: string) => Promise<void>;
}

const AddNoteDialog: React.FC<AddNoteDialogProps> = ({
  isOpen,
  onClose,
  onAddNote,
  onGenerateMeme,
}) => {
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [type, setType] = useState<'text' | 'meme' | 'image'>('text');
  const [style, setStyle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [imageData, setImageData] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageData(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'meme') {
      setIsGenerating(true);
      // Create a prompt that includes the style if specified
      const enhancedPrompt = style ? `${content} (Style: ${style})` : content;
      await onGenerateMeme(enhancedPrompt, author);
      setIsGenerating(false);
    } else if (type === 'image') {
      if (!imageData) {
        alert('Please upload an image');
        return;
      }
      onAddNote(content, author, type, imageData);
    } else {
      onAddNote(content, author, type);
    }
    setContent('');
    setAuthor('');
    setStyle('');
    setImageData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 w-[95vw] max-w-md">
          <Dialog.Title className="text-xl font-bold mb-4">
            Add Birthday Message
          </Dialog.Title>
          
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Message Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as 'meme' | 'image' | 'text')}
                  className="w-full rounded border p-2"
                >
                  <option value="meme">Generate Meme</option>
                  <option value="image">Upload Image</option>
                  <option value="text">Text Message</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {type === 'meme' 
                    ? 'Meme Description' 
                    : type === 'image' 
                      ? 'Caption (Optional)' 
                      : 'Message'}
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded border p-2 h-32"
                  placeholder={
                    type === 'meme'
                      ? 'Describe the birthday meme you want to generate...'
                      : type === 'image'
                        ? 'Add a caption for your image (optional)...'
                        : 'Write your birthday message...'
                  }
                  required={type !== 'image'}
                />
              </div>

              {type === 'image' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Upload Image
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full rounded border p-2"
                    required
                  />
                  {imageData && (
                    <div className="mt-2">
                      <p className="text-sm text-green-600 mb-1">Image preview:</p>
                      <img 
                        src={imageData} 
                        alt="Preview" 
                        className="max-h-32 rounded border"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full rounded border p-2"
                  placeholder="Enter your name"
                  required
                />
              </div>

              {type === 'meme' && (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Meme Style (Optional)
                  </label>
                  <input
                    type="text"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full rounded border p-2"
                    placeholder="e.g., cartoon, pixel art, watercolor, etc."
                  />
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Add Message'}
              </button>
            </div>
          </form>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AddNoteDialog;

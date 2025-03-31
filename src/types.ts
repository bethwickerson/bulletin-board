export interface Note {
  id: string;
  content: string;
  position: { x: number; y: number };
  author: string;
  color: string;
  type: 'text' | 'meme';
  memeUrl?: string;
}
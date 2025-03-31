export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      notes: {
        Row: {
          id: string
          content: string
          position_x: number
          position_y: number
          author: string
          color: string
          type: string
          meme_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          content: string
          position_x: number
          position_y: number
          author: string
          color: string
          type: string
          meme_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          content?: string
          position_x?: number
          position_y?: number
          author?: string
          color?: string
          type?: string
          meme_url?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
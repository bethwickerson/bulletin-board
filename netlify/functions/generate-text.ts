import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const handler: Handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: 'Method Not Allowed',
    };
  }

  try {
    const { prompt } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prompt is required' }),
      };
    }

    console.log('Generating text with prompt:', prompt);
    
    // Use GPT-4o for text generation
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates creative and engaging content for bulletin board notes."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const generatedText = response.choices[0]?.message?.content || '';
    console.log('Generated text:', generatedText);
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: generatedText
      }),
    };
  } catch (error) {
    console.error('Error generating text:', error);
    
    // Check if it's an API error with a specific status code
    let statusCode = 500;
    let errorMessage = 'Failed to generate text';
    
    interface OpenAIError extends Error {
      status?: number;
    }
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check if it's an OpenAI API error
      if ('status' in error && typeof (error as OpenAIError).status === 'number') {
        statusCode = (error as OpenAIError).status || 500;
      }
    }
    
    return {
      statusCode,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: errorMessage,
        message: error instanceof Error ? error.message : String(error)
      }),
    };
  }
};

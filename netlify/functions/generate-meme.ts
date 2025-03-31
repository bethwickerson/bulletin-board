import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { ImageGenerateParams } from 'openai/resources';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to download an image and convert it to a base64 data URL
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw error;
  }
}

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
    const { prompt, style } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prompt is required' }),
      };
    }

    console.log('Generating meme with prompt:', prompt);
    console.log('Style:', style || 'None specified');
    
    // Extract style from the prompt if it's in the format "description (Style: style)"
    let extractedStyle = style;
    let cleanPrompt = prompt;
    
    const styleMatch = prompt.match(/\(Style:\s*([^)]+)\)/i);
    if (styleMatch) {
      extractedStyle = styleMatch[1].trim();
      cleanPrompt = prompt.replace(/\s*\(Style:\s*[^)]+\)/i, '').trim();
    }
    
    // Build the prompt with style
    let enhancedPrompt = `Create a funny birthday meme with the following description: ${cleanPrompt}.`;
    
    if (extractedStyle) {
      enhancedPrompt += ` Use the following style: ${extractedStyle}.`;
    }
    
    // Add a hardcoded instruction to make the meme look like a specific person
    enhancedPrompt += ` Make the person in the meme look like a young professional with a friendly smile.`;
    
    enhancedPrompt += ` Make it appropriate for work environment.`;
    
    console.log('Enhanced prompt:', enhancedPrompt);
    
    // Always use DALL-E 3 for image generation
    const generateOptions: ImageGenerateParams = {
      model: "dall-e-3", // Fixed to DALL-E 3
      prompt: enhancedPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    };
    
    const response = await openai.images.generate(generateOptions);

    const imageUrl = response.data[0].url;
    console.log('Generated image URL:', imageUrl);
    
    if (!imageUrl) {
      throw new Error('No image URL returned from OpenAI');
    }
    
    // Download the image and convert it to a base64 data URL
    const base64Image = await imageUrlToBase64(imageUrl);
    console.log('Converted image to base64');
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: imageUrl,
        base64: base64Image,
      }),
    };
  } catch (error) {
    console.error('Error generating meme:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Failed to generate meme',
        message: error instanceof Error ? error.message : String(error)
      }),
    };
  }
};

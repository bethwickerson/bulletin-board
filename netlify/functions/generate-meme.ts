import { Handler } from '@netlify/functions';
import OpenAI from 'openai';
import { ImageGenerateParams } from 'openai/resources';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY environment variable');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Reference image URL
const REFERENCE_IMAGE_URL = 'https://bdayboard.netlify.app/reference.jpg';

// Helper function to download an image and convert it to a base64 data URL
// This is now optional and only used if explicitly requested
async function imageUrlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/png';
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    return ''; // Return empty string instead of throwing to prevent function failure
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
    
    // Build the prompt with style and reference image
    let enhancedPrompt = `Create a funny birthday meme with the following description: ${cleanPrompt}.`;
    
    if (extractedStyle) {
      enhancedPrompt += ` Use the following style: ${extractedStyle}.`;
    }
    
    // Add the reference image URL directly in the prompt
    enhancedPrompt += ` Make the person in the meme look like the person in this reference image: ${REFERENCE_IMAGE_URL}`;
    
    enhancedPrompt += ` Make the image look like a sticker.`;
    
    console.log('Enhanced prompt with reference image:', enhancedPrompt);
    
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
    
    // Skip base64 conversion to improve performance and avoid timeouts
    // The client can use the direct URL instead
    console.log('Returning direct image URL without base64 conversion');
    
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: imageUrl,
        // Don't include base64 to avoid timeout
        message: "Image generated successfully. Base64 conversion skipped to prevent timeout."
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

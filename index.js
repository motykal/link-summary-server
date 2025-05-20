const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Environmental variable for API key with fallback
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_API_KEY_HERE';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Middleware
app.use(cors());
app.use(express.json());

// Root route - just to check if server is running
app.get('/', (req, res) => {
  res.send('Link summary server is running! Send POST requests to /analyze');
});

// Main route to analyze links
app.post('/analyze', async (req, res) => {
  const { urls } = req.body;
  
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Please provide an array of URLs to analyze' });
  }

  // Limit to 10 URLs per request to avoid overload
  const urlsToProcess = urls.slice(0, 10);
  const results = {};

  // Process each URL
  await Promise.all(urlsToProcess.map(async (url) => {
    try {
      // Get the webpage content
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      // Extract text content from HTML
      const htmlContent = response.data;
      const textContent = extractText(htmlContent);
      
      // Generate summary
      const summary = await generateSummary(url, textContent);
      
      results[url] = {
        status: 'success',
        summary: summary || 'Website content analyzed successfully'
      };
    } catch (error) {
      console.error(`Error processing ${url}:`, error.message);
      results[url] = {
        status: 'error',
        error: error.message,
        summary: 'Could not access or analyze this site'
      };
    }
  }));

  res.json({ results });
});

// Helper function to extract text from HTML
function extractText(html) {
  // Very basic text extraction - in production you would use a library like cheerio
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}

// Generate 7-word summary with Gemini AI
async function generateSummary(url, content) {
  try {
    // Skip summary generation if no API key
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY_HERE') {
      return "No API key configured for summary";
    }

    const prompt = `
Summarize this website content in EXACTLY SEVEN WORDS. Not 6, not 8, but EXACTLY 7 words.
Make the summary informative about the actual content, not generic.
Just give the 7-word summary directly.

URL: ${url}

Content: 
${content.slice(0, 1500)}

Your 7-word summary (EXACTLY 7 words):`;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 30
        }
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const summary = response.data.candidates[0].content.parts[0].text.trim();
    
    // Ensure it's exactly 7 words
    const words = summary.split(/\s+/).filter(word => word.length > 0);
    if (words.length === 7) {
      return words.join(' ');
    } else {
      // If not 7 words, try to trim or expand
      return words.slice(0, 7).join(' ');
    }
  } catch (error) {
    console.error('Summary generation failed:', error.message);
    return "Could not generate summary for this content";
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// For Vercel serverless deployment
module.exports = app;

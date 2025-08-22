const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware for parsing JSON
app.use(express.json());

// Watsonx.ai configuration
const WATSONX_API_URL = process.env.WATSONX_API_URL || 'https://api.watsonx.ai/v1/text/generation';
const WATSONX_API_KEY = process.env.WATSONX_API_KEY;
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID;
const WATSONX_MODEL_ID = process.env.WATSONX_MODEL_ID || 'meta-llama/llama-2-70b-chat';

// IBM Cloud IAM authentication
const { IamAuthenticator } = require('ibm-cloud-sdk-core');

// Function to get IAM token for Watsonx.ai
async function getIamToken() {
  try {
    if (!WATSONX_API_KEY) {
      throw new Error('Missing Watsonx.ai configuration. Please set WATSONX_API_KEY in your .env file');
    }

    console.log('🔐 Getting IAM token from IBM Cloud...');
    
    const authenticator = new IamAuthenticator({
      apikey: WATSONX_API_KEY,
    });

    // Get the IAM token
    const tokenResponse = await authenticator.tokenManager.getToken();
    const token = tokenResponse.token;
    
    console.log('✅ IAM token retrieved successfully');
    console.log(`   Token type: ${tokenResponse.token_type}`);
    console.log(`   Expires in: ${tokenResponse.expires_in} seconds`);
    
    return token;
  } catch (error) {
    console.error('❌ IAM token retrieval failed:', error.message);
    throw error;
  }
}

// Function to call Watsonx.ai LLM
async function generateTextWithLLM(prompt) {
  try {
    if (!WATSONX_API_KEY || !WATSONX_PROJECT_ID) {
      throw new Error('Missing Watsonx.ai configuration. Please set WATSONX_API_KEY and WATSONX_PROJECT_ID in your .env file');
    }

    console.log('🤖 Calling Watsonx.ai LLM...');
    console.log(`   Model: ${WATSONX_MODEL_ID}`);
    console.log(`   Prompt: ${prompt.substring(0, 100)}...`);

    // For Watsonx.ai, use the API key directly in the Authorization header
    const response = await fetch(WATSONX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WATSONX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_id: WATSONX_MODEL_ID,
        input: prompt,
        parameters: {
          max_new_tokens: 256,
          temperature: 0.7,
          top_p: 0.9,
          repetition_penalty: 1.1
        },
        project_id: WATSONX_PROJECT_ID
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Watsonx.ai API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    if (!data.results || !data.results[0] || !data.results[0].generated_text) {
      throw new Error('Invalid response format from Watsonx.ai');
    }

    const generatedText = data.results[0].generated_text;
    console.log('✅ LLM response received successfully');
    console.log(`   Generated text length: ${generatedText.length} characters`);
    
    return generatedText;
  } catch (error) {
    console.error('❌ LLM call failed:', error.message);
    throw error;
  }
}

// Hello world endpoint with LLM-generated content
app.get('/hello', async (req, res) => {
  try {
    const prompt = `Generate a creative and friendly greeting message. Make it unique, warm, and about 2-3 sentences long. The message should feel personal and engaging.`;
    
    const generatedText = await generateTextWithLLM(prompt);
    
    res.json({ 
      message: 'Hello from Watsonx.ai LLM!',
      generatedText: generatedText,
      timestamp: new Date().toISOString(),
      model: WATSONX_MODEL_ID
    });
  } catch (error) {
    console.error('❌ Hello endpoint error:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate LLM content',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Watsonx.ai LLM Middleware Server',
    llmConfigured: !!(WATSONX_API_KEY && WATSONX_PROJECT_ID),
    model: WATSONX_MODEL_ID
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Watsonx.ai LLM integration: ${WATSONX_API_KEY && WATSONX_PROJECT_ID ? '✅ Configured (Direct API Key)' : '❌ Not configured'}`);
  console.log(`📝 Model: ${WATSONX_MODEL_ID}`);
  console.log(`📍 Hello endpoint: http://localhost:${PORT}/hello`);
  console.log(`🏥 Health endpoint: http://localhost:${PORT}/health`);
});

// Test the hello endpoint
async function testHelloEndpoint() {
  try {
    const response = await fetch('http://localhost:3001/hello');
    const data = await response.json();
    console.log('\n🧪 Hello endpoint test result:');
    console.log(`   Message: ${data.message}`);
    console.log(`   Generated Text: ${data.generatedText}`);
    console.log(`   Model: ${data.model}`);
    console.log(`   Timestamp: ${data.timestamp}`);
    return data;
  } catch (error) {
    console.error('❌ Failed to test hello endpoint:', error.message);
    return null;
  }
}

// Wait a moment for server to start, then test
setTimeout(() => {
  console.log('\n🧪 Testing hello endpoint with LLM...');
  testHelloEndpoint();
}, 2000); // Increased delay to allow LLM processing

module.exports = app;

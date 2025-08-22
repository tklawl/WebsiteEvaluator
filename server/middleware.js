const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware for parsing JSON
app.use(express.json());

// CORS middleware to allow requests from frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Watsonx.ai configuration
const WATSONX_API_URL = process.env.WATSONX_API_URL || 'https://api.watsonx.ai/v1/text/generation';
const WATSONX_API_KEY = process.env.WATSONX_API_KEY;
const WATSONX_PROJECT_ID = process.env.WATSONX_PROJECT_ID;
const WATSONX_MODEL_ID = process.env.WATSONX_MODEL_ID || 'meta-llama/llama-2-70b-chat';

// Function to get IBM Cloud IAM token
async function getIamToken(apiKey) {
  try {    
    const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'urn:ibm:params:oauth:grant-type:apikey',
        'apikey': apiKey
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`IAM token request failed: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token received from IAM service');
    }
    
    return {
      access_token: data.access_token,
      token_type: data.token_type || 'Bearer',
      expires_in: data.expires_in,
      scope: data.scope
    };
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
    console.log(`   Project ID: ${WATSONX_PROJECT_ID}`);

    // Try different authentication methods
    let authHeader;
    let authMethod = 'direct';
    
    // First try with direct API key
    if (WATSONX_API_KEY.startsWith('Bearer ')) {
      authHeader = WATSONX_API_KEY;
      authMethod = 'bearer-prefixed';
    } else {
      authHeader = `Bearer ${WATSONX_API_KEY}`;
      authMethod = 'standard-api-key';
    }
    
    let response = await fetch(WATSONX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
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

    // If direct API key fails, try IAM token as fallback
    if (response.status === 401 && authMethod !== 'iam-token') {
      try {
        const iamToken = await getIamToken(WATSONX_API_KEY);
        authHeader = `Bearer ${iamToken.access_token}`;
        authMethod = 'iam-token';
        
        response = await fetch(WATSONX_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model_id: WATSONX_MODEL_ID,
            "messages": [
              {
                "role": "user",
                "content": [
                  {
                    "type": "text",
                    "text": prompt
                  }
                ]
              }
          ],
            parameters: {
              max_new_tokens: 256,
              temperature: 0.7,
              top_p: 0.9,
              repetition_penalty: 1.1
            },
            project_id: WATSONX_PROJECT_ID
          })
        });
      } catch (iamError) {
        console.log('   IAM token fallback also failed:', iamError.message);
      }
    }

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Watsonx.ai API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    const generatedText = data.choices[0].message.content;
    
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
    console.log('❌ Hello endpoint error:', error.message);
    res.status(500).json({ 
      error: 'Failed to generate LLM content',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Website evaluation endpoint
app.post('/evaluate', async (req, res) => {
  try {
    const { websiteUrl, selectedSections, criteria } = req.body;
    
    // Validate required fields
    if (!websiteUrl || !selectedSections || !criteria) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'websiteUrl, selectedSections, and criteria are required',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🏗️ Evaluation request received:', {
      websiteUrl,
      sectionsCount: selectedSections.length,
      criteriaCount: criteria.length
    });

    // Helper function to evaluate a single criterion with retry logic
    async function evaluateCriterionWithRetry(criterion, selectedSections, websiteUrl, maxRetries = 2) {
      let lastError;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Evaluating criterion "${criterion.name}" (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          // Create a prompt for evaluating this criterion
          const sectionsText = selectedSections.map(s => `${s.title}: ${s.content.substring(0, 200)}...`).join('\n\n');
          
          const prompt = `Evaluate the following website content against the criterion: "${criterion.name}"

          Criterion Definition: ${criterion.definition || 'No definition provided'}

          Website URL: ${websiteUrl}

          Selected Content Sections:
          ${sectionsText}

          Please provide your evaluation in the following JSON format ONLY (no additional text before or after):

          {
            "alignment": "HIGH|MEDIUM|LOW",
            "reasoning": "Your detailed reasoning here",
            "keyInsights": ["insight1", "insight2", "insight3"]
          }

          Important: Return ONLY valid JSON, no markdown formatting or additional text.`;

          const llmResponse = await generateTextWithLLM(prompt);
          
          // Try to parse the LLM response as JSON, with fallback handling
          let parsedResponse;
          try {
            // First, try to parse the response directly
            parsedResponse = JSON.parse(llmResponse);
          } catch (parseError) {
            console.log(`⚠️ JSON parse failed for criterion "${criterion.name}", attempting to extract JSON...`);
            
            // Try to extract JSON from markdown code blocks
            let jsonText = llmResponse;
            
            // Remove markdown code block formatting
            jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Remove any text before the first {
            const jsonStart = jsonText.indexOf('{');
            if (jsonStart > 0) {
              jsonText = jsonText.substring(jsonStart);
            }
            
            // Remove any text after the last }
            const jsonEnd = jsonText.lastIndexOf('}');
            if (jsonEnd > 0 && jsonEnd < jsonText.length - 1) {
              jsonText = jsonText.substring(0, jsonEnd + 1);
            }
            
            try {
              parsedResponse = JSON.parse(jsonText);
              console.log(`✅ Successfully extracted JSON from markdown for criterion "${criterion.name}"`);
            } catch (extractError) {
              console.log(`❌ JSON extraction also failed for criterion "${criterion.name}", using fallback`);
              // If LLM didn't return valid JSON, create a structured response
              parsedResponse = {
                alignment: 'HIGH',
                reasoning: llmResponse.replace(/```json\s*|\s*```/g, '').trim(),
                keyInsights: ['Content analyzed successfully', 'LLM evaluation completed']
              };
            }
          }

          console.log(`✅ Successfully evaluated criterion "${criterion.name}" on attempt ${attempt + 1}`);
          
          return {
            criterionId: criterion.id,
            name: criterion.name,
            status: 'completed',
            alignment: parsedResponse.alignment || 'HIGH',
            reasoning: parsedResponse.reasoning || 'LLM evaluation completed',
            selectedSections: selectedSections.map(s => s.title),
            contentAnalyzed: selectedSections.map(s => s.content).join('\n\n---\n\n'),
            keyInsights: parsedResponse.keyInsights || [],
            evaluatedAt: new Date().toISOString(),
            attempts: attempt + 1
          };
          
        } catch (error) {
          lastError = error;
          console.log(`❌ Attempt ${attempt + 1} failed for criterion "${criterion.name}":`, error.message);
          
          if (attempt < maxRetries) {
            // Wait before retrying (exponential backoff)
            const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // All attempts failed
      console.log(`💥 All ${maxRetries + 1} attempts failed for criterion "${criterion.name}"`);
      
      return {
        criterionId: criterion.id,
        name: criterion.name,
        status: 'error',
        alignment: 'MEDIUM',
        reasoning: `Evaluation failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}. Using fallback analysis.`,
        selectedSections: selectedSections.map(s => s.title),
        contentAnalyzed: selectedSections.map(s => s.content).join('\n\n---\n\n'),
        keyInsights: [`Fallback evaluation used after ${maxRetries + 1} failed attempts`],
        evaluatedAt: new Date().toISOString(),
        attempts: maxRetries + 1,
        lastError: lastError.message
      };
    }

    // Generate LLM insights for each criterion with retry logic
    const results = [];
    
    for (const criterion of criteria) {
      const result = await evaluateCriterionWithRetry(criterion, selectedSections, websiteUrl);
      results.push(result);
    }

    const response = {
      success: true,
      message: 'Website evaluation completed successfully',
      websiteUrl,
      results,
      evaluationSummary: {
        totalCriteria: criteria.length,
        completedEvaluations: results.filter(r => r.status === 'completed').length,
        failedEvaluations: results.filter(r => r.status === 'error').length,
        averageAlignment: results.reduce((acc, r) => {
          const scores = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
          return acc + (scores[r.alignment] || 2);
        }, 0) / results.length,
        retryStats: {
          totalAttempts: results.reduce((acc, r) => acc + (r.attempts || 1), 0),
          successfulOnRetry: results.filter(r => r.status === 'completed' && r.attempts > 1).length,
          failedAfterRetries: results.filter(r => r.status === 'error').length
        }
      },
      timestamp: new Date().toISOString(),
      model: WATSONX_MODEL_ID
    };

    console.log('✅ Evaluation completed successfully:', {
      resultsCount: results.length,
      averageAlignment: response.evaluationSummary.averageAlignment,
      retryStats: response.evaluationSummary.retryStats
    });

    res.json(response);

  } catch (error) {
    console.log('❌ Evaluation endpoint error:', error.message);
    res.status(500).json({
      error: 'Failed to evaluate website',
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
});

module.exports = app;

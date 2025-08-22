# Website Evaluator LLM Middleware

This Node.js middleware server interfaces with Watsonx.ai to provide intelligent website evaluation using Large Language Models (LLMs).

## Features

- **LLM Integration**: Connects to Watsonx.ai API for intelligent evaluation
- **Iterative Evaluation**: Evaluates each criterion individually against website sections
- **Structured Prompts**: Generates comprehensive evaluation prompts for consistent results
- **Error Handling**: Robust error handling with fallback responses
- **Rate Limiting**: Built-in rate limiting to prevent API abuse
- **Logging**: Comprehensive logging with Winston
- **Validation**: Request validation and sanitization
- **Security**: Helmet.js security headers and CORS protection

## Prerequisites

- Node.js 18.0.0 or higher
- Watsonx.ai account with API access
- Project ID from Watsonx.ai

## Installation

1. **Navigate to the server directory:**
   ```bash
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Copy environment file:**
   ```bash
   cp ../env.example .env
   ```

4. **Configure environment variables:**
   Edit `.env` file with your Watsonx.ai credentials and preferences.

## Configuration

### Environment Variables

Copy `../env.example` to `.env` and fill in your configuration:

```bash
# Watsonx.ai Configuration
WATSONX_API_URL=https://api.watsonx.ai/v1/text/generation
WATSONX_API_KEY=your_actual_api_key_here
WATSONX_PROJECT_ID=your_actual_project_id_here
WATSONX_MODEL_ID=meta-llama/llama-2-70b-chat

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Watsonx.ai Advanced Configuration
WATSONX_MAX_TOKENS=4096
WATSONX_TEMPERATURE=0.1
WATSONX_TOP_P=0.9
WATSONX_REPETITION_PENALTY=1.1

# Evaluation Configuration
EVALUATION_TIMEOUT_MS=30000
MAX_SECTIONS_PER_REQUEST=10
MAX_CONTENT_LENGTH=50000
```

### Required Variables

- `WATSONX_API_KEY`: Your Watsonx.ai API key
- `WATSONX_PROJECT_ID`: Your Watsonx.ai project ID
- `WATSONX_MODEL_ID`: The LLM model to use (default: meta-llama/llama-2-70b-chat)

## Usage

### Start the Server

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

### API Endpoints

#### Health Check
```bash
GET /health
```

#### Website Evaluation
```bash
POST /api/evaluate
```

**Request Body:**
```json
{
  "websiteUrl": "https://example.com",
  "selectedSections": [
    {
      "selector": "main h1",
      "title": "Main Heading",
      "content": "Website content here..."
    }
  ],
  "criteria": [
    {
      "id": "accessibility",
      "name": "Accessibility",
      "definition": "Ensures website is accessible to users with disabilities"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "criterionId": "accessibility",
      "name": "Accessibility",
      "status": "na",
      "alignment": "HIGH",
      "reasoning": "Detailed evaluation reasoning...",
      "selectedSections": ["Main Heading"],
      "contentAnalyzed": "Website content here...",
      "definition": "Ensures website is accessible to users with disabilities",
      "keyFindings": ["Finding 1", "Finding 2"],
      "recommendations": ["Recommendation 1", "Recommendation 2"]
    }
  ],
  "metadata": {
    "processedAt": "2024-01-01T00:00:00.000Z",
    "sectionsAnalyzed": 1,
    "criteriaEvaluated": 1,
    "model": "meta-llama/llama-2-70b-chat"
  }
}
```

## How It Works

### 1. Request Processing
- Validates incoming request data
- Sanitizes input to prevent injection attacks
- Checks content length limits

### 2. LLM Evaluation
- Generates structured prompts for each criterion
- Calls Watsonx.ai API with optimized parameters
- Parses LLM responses (with fallback parsing)

### 3. Response Generation
- Formats results consistently
- Includes metadata and timing information
- Handles errors gracefully

### 4. Prompt Engineering
The system generates prompts like:
```
You are an expert website evaluator. Please evaluate the following website content against the criterion: "Accessibility".

Criterion Definition: Ensures website is accessible to users with disabilities

Website Content to Evaluate:
Section: Main Heading
Content: Website content here...
---

Please provide a comprehensive evaluation with the following structure:

1. ALIGNMENT: Rate the alignment as HIGH, MEDIUM, or LOW
2. REASONING: Provide detailed reasoning for your assessment
3. KEY_FINDINGS: List 2-3 key findings that support your rating
4. RECOMMENDATIONS: Suggest 1-2 specific improvements if applicable

Format your response as JSON:
{
  "alignment": "HIGH|MEDIUM|LOW",
  "reasoning": "Detailed explanation...",
  "keyFindings": ["Finding 1", "Finding 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
```

## Architecture

```
Client Request → Validation → Sanitization → LLM Service → Watsonx.ai API → Response Parsing → Client Response
```

### Components

- **middleware.js**: Main Express server and routing
- **llmService.js**: Watsonx.ai integration and evaluation logic
- **validation.js**: Request validation and sanitization
- **logger.js**: Winston logging configuration

## Error Handling

The middleware provides comprehensive error handling:

- **Validation Errors**: 400 Bad Request with detailed error messages
- **API Errors**: 500 Internal Server Error with fallback responses
- **Rate Limiting**: 429 Too Many Requests
- **Timeout Handling**: Configurable timeouts for LLM calls

## Logging

Logs are written to:
- `logs/combined.log`: All log levels
- `logs/error.log`: Error-level logs only
- Console: Development mode only

## Security Features

- **Helmet.js**: Security headers
- **CORS**: Configurable cross-origin requests
- **Rate Limiting**: Prevents API abuse
- **Input Validation**: Prevents injection attacks
- **Request Sanitization**: Cleans input data

## Performance

- **Concurrent Processing**: Evaluates criteria sequentially to avoid rate limits
- **Content Limits**: Configurable maximum content length
- **Timeout Protection**: Prevents hanging requests
- **Efficient Parsing**: Optimized response parsing

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Viewing Logs
```bash
npm run logs
```

## Troubleshooting

### Common Issues

1. **Missing API Key**: Ensure `WATSONX_API_KEY` is set in `.env`
2. **Invalid Project ID**: Verify `WATSONX_PROJECT_ID` is correct
3. **CORS Errors**: Check `CORS_ORIGIN` configuration
4. **Rate Limiting**: Adjust `RATE_LIMIT_MAX_REQUESTS` if needed

### Debug Mode

Set `LOG_LEVEL=debug` in `.env` for verbose logging.

## Integration with Frontend

To integrate with the React frontend:

1. Update the `mockApi.ts` to call this middleware instead of generating fake results
2. Change the API endpoint from mock to `http://localhost:3001/api/evaluate`
3. Handle the enhanced response format with `keyFindings` and `recommendations`

## License

MIT License - see LICENSE file for details.

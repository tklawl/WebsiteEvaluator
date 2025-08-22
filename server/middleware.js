const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
require('dotenv').config();

const { evaluateWebsiteWithLLM } = require('./llmService');
const { validateRequest, sanitizeInput } = require('./validation');
const { logger } = require('./logger');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Website Evaluator LLM Middleware'
  });
});

// Main evaluation endpoint
app.post('/api/evaluate', async (req, res) => {
  try {
    // Validate and sanitize request
    const validationResult = validateRequest(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({
        error: 'Invalid request',
        details: validationResult.errors
      });
    }

    const sanitizedData = sanitizeInput(req.body);
    
    logger.info('Evaluation request received', {
      websiteUrl: sanitizedData.websiteUrl,
      sectionsCount: sanitizedData.selectedSections.length,
      criteriaCount: sanitizedData.criteria.length
    });

    // Process evaluation with LLM
    const evaluationResults = await evaluateWebsiteWithLLM(sanitizedData);
    
    logger.info('Evaluation completed successfully', {
      resultsCount: evaluationResults.results.length,
      websiteUrl: sanitizedData.websiteUrl
    });

    res.status(200).json({
      success: true,
      results: evaluationResults.results,
      metadata: {
        processedAt: new Date().toISOString(),
        sectionsAnalyzed: sanitizedData.selectedSections.length,
        criteriaEvaluated: sanitizedData.criteria.length,
        model: process.env.WATSONX_MODEL_ID
      }
    });

  } catch (error) {
    logger.error('Evaluation failed', {
      error: error.message,
      stack: error.stack,
      requestBody: req.body
    });

    res.status(500).json({
      error: 'Evaluation failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`LLM Middleware server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`Watsonx.ai Model: ${process.env.WATSONX_MODEL_ID}`);
});

module.exports = app;

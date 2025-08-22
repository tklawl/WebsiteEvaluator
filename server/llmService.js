const axios = require('axios');
const { logger } = require('./logger');

class WatsonxService {
  constructor() {
    this.apiUrl = process.env.WATSONX_API_URL;
    this.apiKey = process.env.WATSONX_API_KEY;
    this.projectId = process.env.WATSONX_PROJECT_ID;
    this.modelId = process.env.WATSONX_MODEL_ID;
    
    if (!this.apiUrl || !this.apiKey || !this.projectId) {
      throw new Error('Missing required Watsonx.ai configuration');
    }
  }

  async generateEvaluationPrompt(criterion, sections) {
    const sectionsText = sections.map(section => 
      `Section: ${section.title}\nContent: ${section.content}\n---`
    ).join('\n\n');

    return `You are an expert website evaluator. Please evaluate the following website content against the criterion: "${criterion.name}".

Criterion Definition: ${criterion.definition || 'No specific definition provided'}

Website Content to Evaluate:
${sectionsText}

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

Focus on how well the content aligns with the specific criterion requirements. Be objective and evidence-based in your assessment.`;
  }

  async callWatsonxAPI(prompt) {
    try {
      const response = await axios.post(this.apiUrl, {
        model_id: this.modelId,
        input: prompt,
        parameters: {
          max_new_tokens: parseInt(process.env.WATSONX_MAX_TOKENS) || 2048,
          temperature: parseFloat(process.env.WATSONX_TEMPERATURE) || 0.1,
          top_p: parseFloat(process.env.WATSONX_TOP_P) || 0.9,
          repetition_penalty: parseFloat(process.env.WATSONX_REPETITION_PENALTY) || 1.1
        },
        project_id: this.projectId
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: parseInt(process.env.EVALUATION_TIMEOUT_MS) || 30000
      });

      return response.data;
    } catch (error) {
      logger.error('Watsonx.ai API call failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(`Watsonx.ai API call failed: ${error.message}`);
    }
  }

  async parseLLMResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.alignment || !parsed.reasoning) {
        throw new Error('Missing required fields in LLM response');
      }

      return {
        alignment: parsed.alignment.toUpperCase(),
        reasoning: parsed.reasoning,
        keyFindings: parsed.keyFindings || [],
        recommendations: parsed.recommendations || []
      };
    } catch (error) {
      logger.warn('Failed to parse LLM response as JSON, using fallback parsing', {
        error: error.message,
        responseText: responseText.substring(0, 200) + '...'
      });

      // Fallback parsing for non-JSON responses
      return this.fallbackResponseParsing(responseText);
    }
  }

  fallbackResponseParsing(responseText) {
    // Extract alignment from text
    const alignmentMatch = responseText.match(/ALIGNMENT:\s*(HIGH|MEDIUM|LOW)/i);
    const alignment = alignmentMatch ? alignmentMatch[1].toUpperCase() : 'MEDIUM';

    // Extract reasoning (everything after ALIGNMENT until the end or next section)
    const reasoningMatch = responseText.match(/REASONING:\s*([\s\S]*?)(?=KEY_FINDINGS|RECOMMENDATIONS|$)/i);
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : responseText.substring(0, 500) + '...';

    return {
      alignment,
      reasoning,
      keyFindings: [],
      recommendations: []
    };
  }

  async evaluateCriterion(criterion, sections) {
    try {
      logger.info(`Evaluating criterion: ${criterion.name}`, {
        criterionId: criterion.id,
        sectionsCount: sections.length
      });

      const prompt = await this.generateEvaluationPrompt(criterion, sections);
      const apiResponse = await this.callWatsonxAPI(prompt);
      
      if (!apiResponse.results || !apiResponse.results[0] || !apiResponse.results[0].generated_text) {
        throw new Error('Invalid response format from Watsonx.ai');
      }

      const responseText = apiResponse.results[0].generated_text;
      const parsedResponse = await this.parseLLMResponse(responseText);

      logger.info(`Criterion evaluation completed: ${criterion.name}`, {
        alignment: parsedResponse.alignment,
        responseLength: responseText.length
      });

      return parsedResponse;
    } catch (error) {
      logger.error(`Failed to evaluate criterion: ${criterion.name}`, {
        error: error.message,
        criterionId: criterion.id
      });
      
      // Return fallback evaluation
      return {
        alignment: 'MEDIUM',
        reasoning: `Evaluation failed for ${criterion.name}: ${error.message}. Please try again or contact support.`,
        keyFindings: [],
        recommendations: []
      };
    }
  }
}

async function evaluateWebsiteWithLLM(requestData) {
  const watsonxService = new WatsonxService();
  const { websiteUrl, selectedSections, criteria } = requestData;

  logger.info('Starting LLM evaluation', {
    websiteUrl,
    sectionsCount: selectedSections.length,
    criteriaCount: criteria.length
  });

  const results = [];

  // Evaluate each criterion individually
  for (const criterion of criteria) {
    try {
      const evaluation = await watsonxService.evaluateCriterion(criterion, selectedSections);
      
      results.push({
        criterionId: criterion.id,
        name: criterion.name,
        status: 'na',
        alignment: evaluation.alignment,
        reasoning: evaluation.reasoning,
        selectedSections: selectedSections.map(s => s.title),
        contentAnalyzed: selectedSections.map(s => s.content).join('\n\n---\n\n'),
        definition: criterion.definition,
        keyFindings: evaluation.keyFindings,
        recommendations: evaluation.recommendations
      });

      // Add small delay between API calls to avoid rate limiting
      if (criteria.indexOf(criterion) < criteria.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error(`Failed to evaluate criterion: ${criterion.name}`, {
        error: error.message,
        criterionId: criterion.id
      });

      // Add error result
      results.push({
        criterionId: criterion.id,
        name: criterion.name,
        status: 'na',
        alignment: 'MEDIUM',
        reasoning: `Evaluation failed: ${error.message}`,
        selectedSections: selectedSections.map(s => s.title),
        contentAnalyzed: selectedSections.map(s => s.content).join('\n\n---\n\n'),
        definition: criterion.definition,
        keyFindings: [],
        recommendations: []
      });
    }
  }

  logger.info('LLM evaluation completed', {
    resultsCount: results.length,
    websiteUrl
  });

  return { results };
}

module.exports = {
  evaluateWebsiteWithLLM,
  WatsonxService
};

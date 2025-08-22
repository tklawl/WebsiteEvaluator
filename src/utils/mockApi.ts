import { EvaluationCriterion, EvaluationResult, AlignmentLevel } from './model';

export interface EvaluationRequest {
	websiteUrl: string;
	selectedSections: Array<{
		selector: string;
		title: string;
		content: string;
	}>;
	criteria: EvaluationCriterion[];
}

export interface EvaluationResponse {
	results: EvaluationResult[];
}

// Mock API endpoint for website evaluation
export async function evaluateWebsiteSections(
	request: EvaluationRequest
): Promise<EvaluationResponse> {
	
	// Log the API request
	console.log('🚀 API Request Sent:', {
		url: request.websiteUrl,
		sectionsCount: request.selectedSections.length,
		criteriaCount: request.criteria.length,
		fullRequest: request
	});

	// Simulate API delay
	await new Promise(resolve => setTimeout(resolve, 1500));

	// Generate mock evaluation results
	const results: EvaluationResult[] = request.criteria.map(criterion => {
		// Create a mock evaluation summary based on the criterion
		const mockReasoning = `This website section has been evaluated against the "${criterion.name}" criterion. ${criterion.definition ? `Definition: ${criterion.definition} ` : ''}The content analysis shows ${request.selectedSections.length} selected sections with a total of approximately ${request.selectedSections.reduce((acc, section) => acc + section.content.length, 0)} characters of content. The evaluation considers factors such as content relevance, completeness, and alignment with the specified criteria. Based on this analysis, the website demonstrates HIGH alignment with the "${criterion.name}" requirements.`;

		const mockResult: EvaluationResult = {
			criterionId: criterion.id,
			name: criterion.name,
			status: 'na',
			alignment: 'HIGH' as AlignmentLevel,
			reasoning: mockReasoning,
			selectedSections: request.selectedSections.map(s => s.title),
			contentAnalyzed: request.selectedSections.map(s => s.content).join('\n\n---\n\n')
		};

		return mockResult;
	});

	const response: EvaluationResponse = { results };

	// Log the API response
	console.log('✅ API Response Received:', {
		resultsCount: response.results.length,
		results: response.results,
		fullResponse: response
	});

	return response;
}

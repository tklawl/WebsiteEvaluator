export type EvaluationStatus = 'pass' | 'fail' | 'na';
export type AlignmentLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface EvaluationCriterion {
	id: string;
	name: string;
	description?: string;
	definition?: string;
	selected?: boolean;
}

export interface EvaluationResult {
	criterionId: string;
	name: string;
	status: EvaluationStatus;
	notes?: string;
	// New fields for enhanced evaluation
	alignment?: AlignmentLevel;
	reasoning?: string;
	selectedSections?: string[];
	contentAnalyzed?: string;
	definition?: string; // Added: criterion definition from API response
}

export interface Evaluation {
	url: string;
	results: EvaluationResult[];
}

// New interfaces for multi-website support
export interface WebsiteEvaluation {
	criterionId: string;
	alignment: AlignmentLevel;
	reasoning: string;
	selectedSections: string[];
	contentAnalyzed: string;
	evaluatedAt: Date;
}

export interface Website {
	id: string;
	url: string;
	name: string;
	lastEvaluated?: Date;
	evaluations: WebsiteEvaluation[];
}

export const defaultCriteria: EvaluationCriterion[] = [
	{ id: 'accessibility', name: 'Accessibility', selected: true },
	{ id: 'performance', name: 'Performance', selected: true },
	{ id: 'security', name: 'Security headers', selected: true },
	{ id: 'metadata', name: 'Metadata', selected: true },
	{ id: 'content', name: 'Content quality', selected: false },
];

export function evaluateAgainstCriteria(url: string, criteria: EvaluationCriterion[]): Evaluation {
	// Placeholder client-side heuristics. In a real app you'd call a backend.
	const hostname = safeParseHostname(url);
	const results: EvaluationResult[] = criteria
		.filter(c => c.selected)
		.map((c): EvaluationResult => {
			switch (c.id) {
				case 'accessibility':
					return { criterionId: c.id, name: c.name, status: 'na', notes: 'Manual checks required (WCAG).'};
				case 'performance':
					return { criterionId: c.id, name: c.name, status: hostname.includes('gov') ? 'pass' : 'na', notes: hostname.includes('gov') ? 'Likely CDN-backed.' : 'Run Lighthouse for details.' };
				case 'security':
					return { criterionId: c.id, name: c.name, status: url.startsWith('https://') ? 'pass' : 'fail', notes: url.startsWith('https://') ? 'HTTPS detected.' : 'Use HTTPS.' };
				case 'metadata':
					return { criterionId: c.id, name: c.name, status: 'na', notes: 'View page source for meta tags.' };
				case 'content':
					return { criterionId: c.id, name: c.name, status: 'na', notes: 'Review content style and clarity.' };
				default:
					return { criterionId: c.id, name: c.name, status: 'na' };
			}
		});

	return { url, results };
}

function safeParseHostname(input: string): string {
	try {
		return new URL(input).hostname.toLowerCase();
	} catch {
		return input.toLowerCase();
	}
}


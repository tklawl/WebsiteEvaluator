import React, { useState } from 'react';
import { Website, WebsiteEvaluation, EvaluationCriterion } from '../utils/model';
import { scrapeWebsiteSections } from '../utils/scrape';

interface BatchEvaluatorProps {
	websites: Website[];
	criteria: EvaluationCriterion[];
	onWebsiteUpdated: (updatedWebsite: Website) => void;
	onComplete?: () => void;
}

interface BatchProgress {
	total: number;
	completed: number;
	currentWebsite: string;
	status: 'idle' | 'running' | 'completed' | 'error';
	error?: string;
}

export function BatchEvaluator({ websites, criteria, onWebsiteUpdated, onComplete }: BatchEvaluatorProps): JSX.Element {
	const [batchProgress, setBatchProgress] = useState<BatchProgress>({
		total: websites.length,
		completed: 0,
		currentWebsite: '',
		status: 'idle'
	});

	const [isRunning, setIsRunning] = useState(false);

	// AI section detection logic (same as in Evaluator)
	function shouldAutoSelectSection(section: any): boolean {
		const fullText = section.fullText || section.text || '';
		
		// Check for AI-related keywords in full text only
		const aiKeywords = ['AI', 'A.I.', 'Artificial Intelligence', 'artificial intelligence', 'Transparency'];
		
		// Count total occurrences across all fields
		let totalOccurrences = 0;
		
		aiKeywords.forEach(keyword => {
			// Count in full text
			const fullTextMatches = (fullText.match(new RegExp(keyword, 'g')) || []).length;
			totalOccurrences += fullTextMatches;
		});
		
		// Require at least 6 total mentions across all fields
		return totalOccurrences >= 6;
	}

	function autoSelectAISections(sections: any[]): Set<string> {
		const aiSections = new Set<string>();
		
		sections.forEach(section => {
			if (shouldAutoSelectSection(section)) {
				aiSections.add(section.selector);
			}
		});
		
		return aiSections;
	}

	async function evaluateWebsite(website: Website): Promise<Website> {
		try {
			// Step 1: Scrape the website
			setBatchProgress(prev => ({
				...prev,
				currentWebsite: `Scraping ${website.name}...`
			}));

			const sections = await scrapeWebsiteSections(website.url);
			
			// Step 2: Auto-select AI sections
			setBatchProgress(prev => ({
				...prev,
				currentWebsite: `Analyzing sections for ${website.name}...`
			}));

			const selectedSections = autoSelectAISections(sections);
			
			if (selectedSections.size === 0) {
				// No AI sections found, mark as evaluated but with no results
				const updatedWebsite: Website = {
					...website,
					lastEvaluated: new Date(),
					evaluations: []
				};
				return updatedWebsite;
			}

			// Step 3: Evaluate selected sections
			setBatchProgress(prev => ({
				...prev,
				currentWebsite: `Evaluating ${selectedSections.size} sections for ${website.name}...`
			}));

			// Prepare selected sections data
			const selectedSectionData = Array.from(selectedSections).map(selector => {
				const section = sections.find(s => s.selector === selector);
				return {
					selector: selector,
					title: section?.title || 'Unknown Section',
					content: section?.fullText || section?.text || ''
				};
			});

			// Create the API request
			const apiRequest = {
				websiteUrl: website.url,
				selectedSections: selectedSectionData,
				criteria: criteria
			};

			// Call the evaluation API
			const response = await fetch('https://handle-evaluation.1zdpzvcg5wea.us-south.codeengine.appdomain.cloud', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(apiRequest)
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.status} ${response.statusText}`);
			}

			const apiResponse = await response.json();

			// Convert API response to WebsiteEvaluation format
			const websiteEvaluations: WebsiteEvaluation[] = apiResponse.results.map((result: any) => ({
				criterionId: result.criterionId,
				alignment: result.alignment || 'HIGH',
				reasoning: result.reasoning || '',
				selectedSections: result.selectedSections || [],
				contentAnalysed: result.contentAnalysed || '',
				evaluatedAt: new Date()
			}));

			// Update the website with evaluation results
			const updatedWebsite: Website = {
				...website,
				lastEvaluated: new Date(),
				evaluations: websiteEvaluations
			};

			return updatedWebsite;

		} catch (error) {
			console.error(`Error evaluating website ${website.name}:`, error);
			throw error;
		}
	}

	async function runBatchEvaluation(): Promise<void> {
		if (isRunning) return;

		setIsRunning(true);
		setBatchProgress({
			total: websites.length,
			completed: 0,
			currentWebsite: '',
			status: 'running'
		});

		try {
			for (let i = 0; i < websites.length; i++) {
				const website = websites[i];
				
				setBatchProgress(prev => ({
					...prev,
					currentWebsite: `Processing ${website.name} (${i + 1}/${websites.length})...`
				}));

				try {
					const updatedWebsite = await evaluateWebsite(website);
					onWebsiteUpdated(updatedWebsite);
					
					setBatchProgress(prev => ({
						...prev,
						completed: prev.completed + 1
					}));

				} catch (error) {
					console.error(`Failed to evaluate ${website.name}:`, error);
					// Continue with next website instead of stopping the entire batch
				}
			}

			setBatchProgress(prev => ({
				...prev,
				status: 'completed',
				currentWebsite: 'Batch evaluation completed!'
			}));

			// Call onComplete callback if provided
			if (onComplete) {
				onComplete();
			}

		} catch (error) {
			console.error('Batch evaluation failed:', error);
			setBatchProgress(prev => ({
				...prev,
				status: 'error',
				error: error instanceof Error ? error.message : 'Unknown error occurred'
			}));
		} finally {
			setIsRunning(false);
		}
	}

	function resetBatchProgress(): void {
		setBatchProgress({
			total: websites.length,
			completed: 0,
			currentWebsite: '',
			status: 'idle'
		});
	}

	if (websites.length === 0) {
		return <></>;
	}

	return (
		<section className="batch-evaluator">
			<div className="batch-evaluator-header">
				<h3>Batch Evaluation</h3>
				<p className="muted">
					Evaluate all {websites.length} website{websites.length > 1 ? 's' : ''} automatically
				</p>
			</div>

			{batchProgress.status === 'idle' && (
				<div className="batch-evaluator-actions">
					<button 
						className="button primary" 
						onClick={runBatchEvaluation}
						disabled={isRunning}
					>
						🚀 Start Batch Evaluation
					</button>
					<p className="muted">
						This will scrape each website, auto-select AI-related sections, and evaluate them against all criteria.
					</p>
				</div>
			)}

			{batchProgress.status === 'running' && (
				<div className="batch-evaluator-progress">
					<div className="progress-header">
						<h4>Batch Evaluation in Progress</h4>
						<span className="progress-count">
							{batchProgress.completed} / {batchProgress.total} completed
						</span>
					</div>
					
					<div className="progress-bar">
						<div 
							className="progress-fill" 
							style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }}
						></div>
					</div>
					
					<p className="current-website">{batchProgress.currentWebsite}</p>
					
					<button 
						className="button danger" 
						onClick={resetBatchProgress}
						disabled={isRunning}
					>
						Cancel Batch
					</button>
				</div>
			)}

			{batchProgress.status === 'completed' && (
				<div className="batch-evaluator-complete">
					<div className="success-message">
						✅ Batch evaluation completed successfully!
					</div>
					<p>
						Processed {batchProgress.completed} website{batchProgress.completed > 1 ? 's' : ''} with AI section detection and evaluation.
					</p>
					<button 
						className="button" 
						onClick={resetBatchProgress}
					>
						Run Another Batch
					</button>
				</div>
			)}

			{batchProgress.status === 'error' && (
				<div className="batch-evaluator-error">
					<div className="error-message">
						❌ Batch evaluation failed
					</div>
					<p className="error-details">{batchProgress.error}</p>
					<button 
						className="button" 
						onClick={resetBatchProgress}
					>
						Try Again
					</button>
				</div>
			)}
		</section>
	);
}

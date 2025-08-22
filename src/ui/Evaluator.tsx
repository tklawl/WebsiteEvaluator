import React, { useState, useEffect } from 'react';
import { useLocalState } from '../utils/useLocalState';
import { defaultCriteria, Evaluation, EvaluationCriterion, EvaluationResult, Website, WebsiteEvaluation } from '../utils/model';
import { evaluateWebsite } from '../utils/api';
import { scrapeWebsiteSections } from '../utils/scrape';

function normalizeUrl(input: string): string {
	try {
		const url = new URL(input.startsWith('http') ? input : `https://${input}`);
		return url.toString();
	} catch {
		return input;
	}
}

interface WebsiteSection {
	selector: string;
	text: string;
	title: string;
	fullText: string;
}

interface EvaluatorProps {
	website: Website;
	onWebsiteUpdated: (updatedWebsite: Website) => void;
}

export function Evaluator({ website, onWebsiteUpdated }: EvaluatorProps): JSX.Element {
	const [criteria] = useLocalState<EvaluationCriterion[]>('criteria:v1', defaultCriteria);
	const [urlInput, setUrlInput] = useState<string>(website.url);
	const [currentUrl, setCurrentUrl] = useState<string>(website.url);
	const [isScraping, setIsScraping] = useState<boolean>(false);
	const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
	const [websiteSections, setWebsiteSections] = useState<WebsiteSection[]>([]);
	const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
	const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
	const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
	const [showDebug, setShowDebug] = useState<boolean>(false);
	const [showPreview, setShowPreview] = useState<boolean>(false);
	const [expandedSectionModal, setExpandedSectionModal] = useState<WebsiteSection | null>(null);
	const [evaluationModal, setEvaluationModal] = useState<any>(null);
	const [showAllSections, setShowAllSections] = useState<boolean>(false);
	const [criteriaChanged, setCriteriaChanged] = useState<boolean>(false);
	const [previousCriteriaHash, setPreviousCriteriaHash] = useState<string>('');
	const [showPreviousResults, setShowPreviousResults] = useState<boolean>(true);
	const [showSections, setShowSections] = useState<boolean>(true);
	const [evaluationAbortController, setEvaluationAbortController] = useState<AbortController | null>(null);
	const [evaluationProgress, setEvaluationProgress] = useState<string>('');

	// Load existing evaluation results when component mounts or website changes
	useEffect(() => {
		if (website.evaluations && website.evaluations.length > 0) {
			// Convert WebsiteEvaluation to Evaluation format for display
			const existingResults: EvaluationResult[] = website.evaluations.map(evaluation => ({
				criterionId: evaluation.criterionId,
				name: criteria.find(c => c.id === evaluation.criterionId)?.name || 'Unknown Criterion',
				status: 'na' as const,
				alignment: evaluation.alignment,
				reasoning: evaluation.reasoning,
				selectedSections: evaluation.selectedSections,
				contentAnalysed: evaluation.contentAnalysed,
			}));

			const existingEvaluation: Evaluation = {
				url: website.url,
				results: existingResults
			};

			setEvaluation(existingEvaluation);
			
			// Set the criteria hash to prevent "criteria changed" warning
			const currentCriteriaHash = criteria
				.filter(c => c.selected)
				.map(c => c.id)
				.sort()
				.join(',');
			setPreviousCriteriaHash(currentCriteriaHash);
			setCriteriaChanged(false);

			console.log('Loaded existing evaluation results:', existingEvaluation);
		}
	}, [website, criteria]);

	console.log('Evaluator component rendering, websiteSections:', websiteSections.length, 'isScraping:', isScraping);
	console.log('Available criteria:', criteria);
	console.log('Selected criteria:', criteria.filter(c => c.selected));
	console.log('Website evaluations:', website.evaluations);

	// Debug logging for state changes
	useEffect(() => {
		console.log('websiteSections state changed:', websiteSections);
	}, [websiteSections]);

	useEffect(() => {
		console.log('isScraping state changed:', isScraping);
	}, [isScraping]);

	useEffect(() => {
		console.log('=== CRITERIA STATE CHANGE ===');
		console.log('Full criteria array:', criteria);
		console.log('Selected criteria count:', criteria.filter(c => c.selected).length);
		console.log('Selected criteria details:', criteria.filter(c => c.selected).map(c => ({ id: c.id, name: c.name, selected: c.selected })));
		console.log('All criteria details:', criteria.map(c => ({ id: c.id, name: c.name, selected: c.selected })));
		
		// Create a hash of the current criteria selection state
		const currentCriteriaHash = criteria
			.filter(c => c.selected)
			.map(c => c.id)
			.sort()
			.join(',');
		
		console.log('Current criteria hash:', currentCriteriaHash);
		console.log('Previous criteria hash:', previousCriteriaHash);
		
		// Only mark as changed if criteria actually changed AND we had previous results
		if (evaluation && previousCriteriaHash && currentCriteriaHash !== previousCriteriaHash) {
			console.log('Criteria changed, marking for re-evaluation');
			setCriteriaChanged(true);
			// Don't clear evaluation results immediately - let user see the warning and choose when to re-evaluate
		}
		
		// Update the previous criteria hash
		setPreviousCriteriaHash(currentCriteriaHash);
	}, [criteria, evaluation, previousCriteriaHash]);

	async function handleScrape(): Promise<void> {
		console.log('Scrape button clicked for URL:', urlInput);
		const normalized = normalizeUrl(urlInput);
		console.log('Normalized URL:', normalized);
		setCurrentUrl(normalized);
		setIsScraping(true);
		setWebsiteSections([]);
		setSelectedSections(new Set());
		setExpandedSections(new Set());
		setExpandedSectionModal(null);
		setShowAllSections(false);
		setEvaluation(null); // Clear previous evaluation results when starting new scrape
		setCriteriaChanged(false); // Reset criteria changed flag
		setPreviousCriteriaHash(''); // Reset criteria hash for clean state
		setShowPreviousResults(true); // Reset previous results visibility
		setShowSections(true); // Reset sections visibility
		setShowPreviousResults(false); // Reset previous results visibility
		try {
			console.log('Calling scrapeWebsiteSections...');
			const sections = await scrapeWebsiteSections(normalized);
			console.log('Scraping completed, sections returned:', sections);
			setWebsiteSections(sections);
			console.log('Website sections state updated');
		} catch (error) {
			console.error('Failed to scrape website:', error);
			setWebsiteSections([]);
		} finally {
			setIsScraping(false);
			console.log('Scraping state set to false');
		}
	}

	async function handleEvaluate(): Promise<void> {
		if (selectedSections.size === 0) {
			alert('Please select at least one section to evaluate.');
			return;
		}

		const selected = criteria.filter(c => c.selected);
		if (selected.length === 0) {
			alert('Please select at least one evaluation criterion.');
			return;
		}

		// Create abort controller for cancellation
		const abortController = new AbortController();
		setEvaluationAbortController(abortController);
		setIsEvaluating(true);
		setEvaluationProgress('Preparing evaluation...');

		try {
			const normalized = normalizeUrl(currentUrl);
			
			// Prepare selected sections data
			const selectedSectionData = Array.from(selectedSections).map(selector => {
				const section = websiteSections.find(s => s.selector === selector);
				return {
					selector: selector,
					title: section?.title || 'Unknown Section',
					content: section?.fullText || section?.text || ''
				};
			});

			// Create the API request
			const apiRequest = {
				websiteUrl: normalized,
				selectedSections: selectedSectionData,
				criteria: selected
			};

			console.log('🚀 Sending evaluation request to API:', apiRequest);
			setEvaluationProgress('Sending request to AI service...');

			// Call the real API endpoint
			const response = await fetch('http://localhost:3001/evaluate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(apiRequest),
				signal: abortController.signal
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.status} ${response.statusText}`);
			}

			setEvaluationProgress('Processing AI analysis...');
			const apiResponse = await response.json();
			console.log('✅ API Response received:', apiResponse);
			console.log('📊 Evaluation Summary:', apiResponse.evaluationSummary);
			console.log('📝 Results Count:', apiResponse.results?.length);

			// Set the evaluation results from the API response
			setEvaluation({ 
				url: normalized, 
				results: apiResponse.results,
				evaluationSummary: apiResponse.evaluationSummary
			} as any);
			
			// Update the criteria hash after successful evaluation
			const currentCriteriaHash = criteria
				.filter(c => c.selected)
				.map(c => c.id)
				.sort()
				.join(',');
			setPreviousCriteriaHash(currentCriteriaHash);

			// Save the evaluation results to the website
			const websiteEvaluations: WebsiteEvaluation[] = apiResponse.results.map((result: any) => ({
				criterionId: result.criterionId,
				alignment: result.alignment || 'HIGH',
				reasoning: result.reasoning || '',
				selectedSections: result.selectedSections || [],
				contentAnalysed: result.contentAnalysed || '',
				evaluatedAt: new Date()
			}));

			const updatedWebsite: Website = {
				...website,
				url: normalized,
				lastEvaluated: new Date(),
				evaluations: websiteEvaluations
			};

			// Call the callback to update the website
			onWebsiteUpdated(updatedWebsite);

		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				console.log('Evaluation was cancelled by user');
				// Don't show error alert for cancellation
			} else {
				console.error('Failed to evaluate website:', error);
				// Show error message to user
				alert('Evaluation failed. Please try again.');
			}
		} finally {
			setIsEvaluating(false);
			setEvaluationAbortController(null);
			setEvaluationProgress('');
		}
	}

	function toggleSectionSelection(selector: string): void {
		const newSelected = new Set(selectedSections);
		if (newSelected.has(selector)) {
			newSelected.delete(selector);
		} else {
			newSelected.add(selector);
		}
		setSelectedSections(newSelected);
	}

	function openSectionModal(section: WebsiteSection): void {
		setExpandedSectionModal(section);
	}

	function closeSectionModal(): void {
		setExpandedSectionModal(null);
	}

	function openEvaluationModal(evaluation: any): void {
		setEvaluationModal(evaluation);
	}

	function closeEvaluationModal(): void {
		setEvaluationModal(null);
	}

	function cancelEvaluation(): void {
		if (evaluationAbortController) {
			evaluationAbortController.abort();
		}
	}

	// Get full text for a section (this would need to be stored in the section data)
	function getFullText(section: WebsiteSection): string {
		return section.fullText || section.text;
	}

	// Get sections to display (first 6 or all)
	const displayedSections = showAllSections ? websiteSections : websiteSections.slice(0, 8);
	const hasMoreSections = websiteSections.length > 8;

	return (
		<>
			{/* Full-screen loading overlay */}
			{isEvaluating && (
				<div className="evaluation-loading-overlay">
					<div className="evaluation-loading-content">
						<div className="loading-spinner"></div>
						<h3>Evaluating Website Sections</h3>
						<p>This may take a few moments as we analyze your content with AI...</p>
						{evaluationProgress && (
							<div className="evaluation-progress">
								<p>{evaluationProgress}</p>
							</div>
						)}
						<button 
							className="button danger" 
							onClick={cancelEvaluation}
						>
							Cancel Evaluation
						</button>
					</div>
				</div>
			)}

			<section className="topbar panel">
				<form className="url-input" onSubmit={(e) => { e.preventDefault(); handleScrape(); }}>
					<input
						placeholder="Enter website URL (e.g. www.example.gov.au)"
						value={urlInput}
						onChange={e => setUrlInput(e.target.value)}
						inputMode="url"
						aria-label="Website URL"
					/>
					<button 
						className="button primary" 
						type="submit" 
						disabled={isScraping}
					>
						{isScraping ? 'Scraping...' : 'Scrape'}
					</button>
				</form>
			</section>

			<section className="panel">
				<div className="section-header-toggle">
					<h3 style={{margin: '4px 0 12px'}}>Website Preview</h3>
					<button
						className="toggle-button"
						onClick={() => setShowPreview(!showPreview)}
						title={showPreview ? 'Hide Preview' : 'Show Preview'}
					>
						{showPreview ? '−' : '+'}
					</button>
				</div>
				{showPreview && (
					<>
						<iframe 
							className="preview" 
							src={currentUrl} 
							title="Website preview" 
							sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
							onError={() => console.log('Iframe failed to load')}
						/>
						<p className="muted">
							If the site blocks embedding (like YouTube, Google, etc.), open in a new tab: 
							<a href={currentUrl} target="_blank" rel="noreferrer">{currentUrl}</a>
						</p>
						<p className="muted" style={{color: '#666', fontSize: '11px'}}>
							Note: Iframe preview issues don't affect scraping functionality
						</p>
					</>
				)}
			</section>

			{/* Show existing evaluation results if available */}
			{website.evaluations && website.evaluations.length > 0 && (
				<section className="panel existing-results">
					<div className="section-header-toggle">
						<h3 style={{margin: '4px 0 12px'}}>Previous Evaluation Results</h3>
						<button
							className="toggle-button"
							onClick={() => setShowPreviousResults(!showPreviousResults)}
							title={showPreviousResults ? 'Hide Previous Results' : 'Show Previous Results'}
						>
							{showPreviousResults ? '−' : '+'}
						</button>
					</div>
					{showPreviousResults && (
						<>
							<p className="muted">
								This website was previously evaluated on {new Date(website.lastEvaluated || Date.now()).toLocaleDateString()}. 
								You can view the results below or re-evaluate with new sections.
							</p>
							<div className="evaluation-results-grid">
								{website.evaluations.map((evaluation) => {
									const criterion = criteria.find(c => c.id === evaluation.criterionId);
									return (
										<div 
											className="evaluation-result-card" 
											key={evaluation.criterionId}
											onClick={() => openEvaluationModal({
												...evaluation,
												name: criterion?.name || 'Unknown Criterion',
												definition: criterion?.definition || ''
											})}
										>
											<div className="result-header">
												<strong>{criterion?.name || 'Unknown Criterion'}</strong>
												<div className="result-status">
													{evaluation.alignment && (
														<span className={`tag alignment-${evaluation.alignment.toLowerCase()}`}>
															{evaluation.alignment}
														</span>
													)}
												</div>
											</div>
											{evaluation.reasoning && (
												<div className="result-preview">
													<p>{evaluation.reasoning.split(' ').slice(0, 30).join(' ')}...</p>
												</div>
											)}
											{evaluation.selectedSections && evaluation.selectedSections.length > 0 && (
												<div className="result-sections">
													<small><strong>Sections:</strong> {evaluation.selectedSections.length} analysed</small>
												</div>
											)}
											<div className="result-click-hint">
												<small>Click to view details</small>
											</div>
										</div>
									);
								})}
							</div>
						</>
					)}
				</section>
			)}

			{/* Website Sections - only show if we have scraped sections */}
			{websiteSections.length > 0 && (
				<section className="panel">
					<div className="section-header-toggle">
						<h3 style={{margin: '4px 0 12px'}}>Website Sections</h3>
						<button
							className="toggle-button"
							onClick={() => setShowSections(!showSections)}
							title={showSections ? 'Hide Sections' : 'Show Sections'}
						>
							{showSections ? '−' : '+'}
						</button>
					</div>
					{showSections && (
						<>
							<p className="muted">Select one or more sections to evaluate:</p>
							
							{/* Show selected criteria */}
							{criteria.filter(c => c.selected).length > 0 ? (
								<div className="selected-criteria-info">
									<p className="muted">
										<strong>Evaluation Criteria:</strong> {criteria.filter(c => c.selected).map(c => c.name).join(', ')}
									</p>
									{criteriaChanged && (
										<p style={{color: '#856404', marginTop: '8px', fontSize: '12px'}}>
											⚠️ <strong>Criteria changed.</strong> Please re-evaluate sections to see updated results.
										</p>
									)}
								</div>
							) : (
								<div className="selected-criteria-info" style={{background: '#fff3cd', borderColor: '#ffeaa7'}}>
									<p style={{color: '#856404'}}>
										⚠️ <strong>No criteria selected.</strong> Please select evaluation criteria in the sidebar before evaluating sections.
									</p>
								</div>
							)}
							
							<div className="sections-grid">
								{displayedSections.map((section) => (
									<div 
										key={section.selector} 
										className={`section-card ${selectedSections.has(section.selector) ? 'selected' : ''}`}
										onClick={() => toggleSectionSelection(section.selector)}
									>
										<div className="section-header">
											<input
												type="checkbox"
												checked={selectedSections.has(section.selector)}
												onChange={() => toggleSectionSelection(section.selector)}
												onClick={(e) => e.stopPropagation()}
											/>
											<h4>{section.title}</h4>
											<button
												className="expand-button"
												onClick={(e) => {
													e.stopPropagation();
													openSectionModal(section);
												}}
												title="View Full Content"
											>
												👁️
											</button>
										</div>
										<div className="section-content">
											<p className="section-text">
												{section.text}
											</p>
											{section.text.length > 200 && (
												<button
													className="expand-text-button"
													onClick={(e) => {
														e.stopPropagation();
														openSectionModal(section);
													}}
												>
													Read Full Content
												</button>
											)}
										</div>
										<small className="section-selector">{section.selector}</small>
									</div>
								))}
							</div>
							
							{hasMoreSections && (
								<div className="sections-expand">
									<button 
										className="button ghost" 
										onClick={() => setShowAllSections(!showAllSections)}
									>
										{showAllSections ? `Show Less (${8})` : `Show More (${websiteSections.length - 8})`}
									</button>
								</div>
							)}
							
							{selectedSections.size > 0 && (
								<div className="evaluate-actions">
									{criteria.filter(c => c.selected).length > 0 ? (
										<button 
											className="button primary" 
											onClick={handleEvaluate}
											disabled={isEvaluating}
										>
											{isEvaluating ? 'Evaluating...' : `Evaluate ${selectedSections.size} Selected Section${selectedSections.size > 1 ? 's' : ''}`}
										</button>
									) : (
										<div className="evaluate-warning">
											<p className="muted">Select evaluation criteria in the sidebar to enable evaluation.</p>
										</div>
									)}
								</div>
							)}
						</>
					)}
				</section>
			)}

			{isScraping && (
				<section className="panel" style={{background: '#fff3cd', border: '1px solid #ffeaa7'}}>
					<h3 style={{margin: '4px 0 12px'}}>Scraping in Progress...</h3>
					<p>Attempting to scrape <strong>{currentUrl}</strong></p>
					<p className="muted">
						This may take a few seconds. The app is trying multiple methods to access the website content.
					</p>
					<div style={{marginTop: '12px'}}>
						<div style={{width: '100%', height: '4px', background: '#e9ecef', borderRadius: '2px'}}>
							<div style={{width: '100%', height: '100%', background: '#007bff', borderRadius: '2px', animation: 'pulse 1.5s ease-in-out infinite'}}></div>
						</div>
					</div>
				</section>
			)}

			{!isScraping && websiteSections.length === 0 && (
				<section className="panel" style={{background: '#f8f9fa', border: '1px solid #dee2e6'}}>
					<h3 style={{margin: '4px 0 12px'}}>Ready to Scrape</h3>
					<p>Enter a website URL above and click "Scrape" to analyse the website content.</p>
					<p className="muted">
						<strong>Note:</strong> Some websites may block scraping due to CORS restrictions. 
						If scraping fails, try the "Test Scraping" button to verify the app is working.
					</p>
				</section>
			)}

			{/* Evaluation Results - only show if we have new evaluation results */}
			{evaluation && evaluation.results.length > 0 && websiteSections.length > 0 && (
				<section className="panel">
					<div className="evaluation-header">
						<h3>Evaluation Results</h3>
						{criteriaChanged && (
							<div className="criteria-changed-warning">
								⚠️ Criteria changed. Please re-evaluate sections to see updated results.
							</div>
						)}
					</div>
					
					{/* Show selected criteria info */}
					{criteria && criteria.filter(c => c.selected).length > 0 && (
						<div className="selected-criteria-info">
							<p><strong>Evaluation Criteria:</strong> {criteria.filter(c => c.selected).map(c => c.name).join(', ')}</p>
						</div>
					)}

					{/* Show evaluation summary if available */}
					{(evaluation as any).evaluationSummary && (
						<div className="evaluation-summary">
							<div className="summary-stats">
								<div className="stat-item">
									<strong>{(evaluation as any).evaluationSummary.totalCriteria}</strong>
									<small>Total Criteria</small>
								</div>
								<div className="stat-item">
									<strong>{(evaluation as any).evaluationSummary.completedEvaluations}</strong>
									<small>Completed</small>
								</div>
								<div className="stat-item">
									<strong>{(evaluation as any).evaluationSummary.failedEvaluations}</strong>
									<small>Failed</small>
								</div>
								<div className="stat-item">
									<strong>{(evaluation as any).evaluationSummary.averageAlignment?.toFixed(1) || 'N/A'}</strong>
									<small>Avg Alignment</small>
								</div>
							</div>
						</div>
					)}

					<div className="evaluation-results-grid">
						{evaluation.results.map((r: any) => (
							<div 
								className="evaluation-result-card" 
								key={r.criterionId}
								onClick={() => openEvaluationModal(r)}
							>
								<div className="result-header">
									<strong>{r.name}</strong>
									<div className="result-status">
										{r.alignment && (
											<span className={`tag alignment-${r.alignment.toLowerCase()}`}>
												{r.alignment}
											</span>
										)}
										{r.status && (
											<span className={`tag status-${r.status}`}>
												{r.status}
											</span>
										)}
									</div>
								</div>
								{r.reasoning && (
									<div className="result-preview">
										<p>{r.reasoning.split(' ').slice(0, 30).join(' ')}...</p>
									</div>
								)}
								{r.selectedSections && r.selectedSections.length > 0 && (
									<div className="result-sections">
										<small><strong>Sections:</strong> {r.selectedSections.length} analysed</small>
									</div>
								)}
								<div className="result-click-hint">
									<small>Click to view details</small>
								</div>
							</div>
						))}
					</div>
				</section>
			)}

			{/* Section Content Modal */}
			{expandedSectionModal && (
				<div className="section-modal" onClick={closeSectionModal}>
					<div className="section-modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="section-modal-header">
							<h2>{expandedSectionModal.title}</h2>
							<button className="section-modal-close" onClick={closeSectionModal}>×</button>
						</div>
						<div className="section-modal-body">
							<div className="section-modal-info">
								<p><strong>Selector:</strong> <code>{expandedSectionModal.selector}</code></p>
							</div>
							<div className="section-modal-text">
								{expandedSectionModal.fullText.split('\n').map((paragraph, index) => (
									paragraph.trim() && <p key={index}>{paragraph.trim()}</p>
								))}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Evaluation Result Modal */}
			{evaluationModal && (
				<div className="evaluation-modal" onClick={closeEvaluationModal}>
					<div className="evaluation-modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="evaluation-modal-header">
							<h2>{evaluationModal.name}</h2>
							<button className="evaluation-modal-close" onClick={closeEvaluationModal}>×</button>
						</div>
						<div className="evaluation-modal-body">
							<div className="evaluation-modal-status">
								{evaluationModal.alignment && (
									<span className={`tag alignment-${evaluationModal.alignment.toLowerCase()}`}>
										{evaluationModal.alignment}
									</span>
								)}
								{evaluationModal.status && (
									<span className={`tag status-${evaluationModal.status}`}>
										{evaluationModal.status}
									</span>
								)}
							</div>
							
							{evaluationModal.reasoning && (
								<div className="evaluation-modal-section">
									<h4>Detailed Analysis</h4>
									<p>{evaluationModal.reasoning}</p>
								</div>
							)}
							
							{evaluationModal.keyInsights && evaluationModal.keyInsights.length > 0 && (
								<div className="evaluation-modal-section">
									<h4>Key Insights</h4>
									<ul>
										{evaluationModal.keyInsights.map((insight: string, index: number) => (
											<li key={index}>{insight}</li>
										))}
									</ul>
								</div>
							)}
							
							{evaluationModal.selectedSections && evaluationModal.selectedSections.length > 0 && (
								<div className="evaluation-modal-section">
									<h4>Sections Analysed</h4>
									<ul>
										{evaluationModal.selectedSections.map((section: string, index: number) => (
											<li key={index}>{section}</li>
										))}
									</ul>
								</div>
							)}
							
							{evaluationModal.evaluatedAt && (
								<div className="evaluation-modal-section">
									<h4>Evaluation Details</h4>
									<p><strong>Evaluated:</strong> {new Date(evaluationModal.evaluatedAt).toLocaleString()}</p>
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</>
	);
}


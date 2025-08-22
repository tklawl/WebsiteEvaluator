import React, { useState, useEffect } from 'react';
import { useLocalState } from '../utils/useLocalState';
import { defaultCriteria, Evaluation, EvaluationCriterion } from '../utils/model';
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
}

export function Evaluator(): JSX.Element {
	const [criteria] = useLocalState<EvaluationCriterion[]>('criteria:v1', defaultCriteria);
	const [urlInput, setUrlInput] = useLocalState<string>('url:v1', 'https://www.dta.gov.au/');
	const [currentUrl, setCurrentUrl] = useState<string>(normalizeUrl(urlInput));
	const [isScraping, setIsScraping] = useState<boolean>(false);
	const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
	const [websiteSections, setWebsiteSections] = useState<WebsiteSection[]>([]);
	const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
	const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

	console.log('Evaluator component rendering, websiteSections:', websiteSections.length, 'isScraping:', isScraping);

	// Debug logging for state changes
	useEffect(() => {
		console.log('websiteSections state changed:', websiteSections);
	}, [websiteSections]);

	useEffect(() => {
		console.log('isScraping state changed:', isScraping);
	}, [isScraping]);

	async function handleScrape(): Promise<void> {
		console.log('Scrape button clicked for URL:', urlInput);
		const normalized = normalizeUrl(urlInput);
		console.log('Normalized URL:', normalized);
		setCurrentUrl(normalized);
		setIsScraping(true);
		setWebsiteSections([]);
		setSelectedSections(new Set());
		setEvaluation(null);

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
		if (selectedSections.size === 0) return;

		const normalized = normalizeUrl(urlInput);
		setIsEvaluating(true);

		try {
			const selected: EvaluationCriterion[] = (criteria || []).filter(c => !!c.selected);
			if (selected.length === 0) {
				setEvaluation({ url: normalized, results: [] });
				return;
			}

			// Get the selected section texts
			const selectedSectionTexts = websiteSections
				.filter(section => selectedSections.has(section.selector))
				.map(section => section.text)
				.join('\n\n');

			// Evaluate the selected sections
			const summaries = await Promise.all(
				selected.map(c => evaluateWebsite({ 
					url: normalized, 
					name: c.name, 
					description: selectedSectionTexts || (c.definition ?? c.description ?? '') 
				}))
			);

			const results = selected.map((c, idx) => ({
				criterionId: c.id,
				name: c.name,
				status: 'na' as const,
				notes: summaries[idx],
			}));

			setEvaluation({ url: normalized, results });
		} catch (error) {
			console.error('Failed to evaluate website:', error);
		} finally {
			setIsEvaluating(false);
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

	return (
		<>
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
						className="button" 
						type="submit" 
						disabled={isScraping}
					>
						{isScraping ? 'Scraping...' : 'Scrape'}
					</button>
				</form>
				<button 
					className="button ghost" 
					onClick={() => {
						setUrlInput('https://test.example.com');
						setTimeout(() => handleScrape(), 100);
					}}
					style={{ marginLeft: '8px' }}
				>
					Test Scraping
				</button>
			</section>

			{websiteSections.length > 0 && (
				<section className="panel">
					<h3 style={{margin: '4px 0 12px'}}>Website Sections</h3>
					<p className="muted">Select one or more sections to evaluate:</p>
					<div className="sections-grid">
						{websiteSections.map((section) => (
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
								</div>
								<p className="section-text">{section.text}</p>
								<small className="section-selector">{section.selector}</small>
							</div>
						))}
					</div>
					{selectedSections.size > 0 && (
						<div className="evaluate-actions">
							<button 
								className="button primary" 
								onClick={handleEvaluate}
								disabled={isEvaluating}
							>
								{isEvaluating ? 'Evaluating...' : `Evaluate ${selectedSections.size} Selected Section${selectedSections.size > 1 ? 's' : ''}`}
							</button>
						</div>
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
					<p>Enter a website URL above and click "Scrape" to analyze the website content.</p>
					<p className="muted">
						<strong>Note:</strong> Some websites may block scraping due to CORS restrictions. 
						If scraping fails, try the "Test Scraping" button to verify the app is working.
					</p>
				</section>
			)}

			{/* Debug info - remove this in production */}
			<section className="panel" style={{background: '#f0f8ff', border: '1px solid #ccc'}}>
				<h3 style={{margin: '4px 0 12px'}}>Debug Info</h3>
				<p><strong>Is Scraping:</strong> {isScraping ? 'Yes' : 'No'}</p>
				<p><strong>Sections Found:</strong> {websiteSections.length}</p>
				<p><strong>Selected Sections:</strong> {selectedSections.size}</p>
				<p><strong>Current URL:</strong> {currentUrl}</p>
				{websiteSections.length > 0 && (
					<div>
						<p><strong>Section Titles:</strong></p>
						<ul>
							{websiteSections.map((section, index) => (
								<li key={index}>{section.title} ({section.selector})</li>
							))}
						</ul>
					</div>
				)}
			</section>

			<section className="panel">
				<h3 style={{margin: '4px 0 12px'}}>Website Preview</h3>
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
			</section>

			{evaluation && (
				<section className="panel">
					<h3 style={{margin: '4px 0 12px'}}>Evaluation Results</h3>
					<div className="summary">
						{evaluation.results.map((r) => (
							<div className="summary-item" key={r.criterionId}>
								<strong>{r.name}</strong>
								<span className={`tag ${r.status}`}>{r.status.toUpperCase()}</span>
								{r.notes && <span className="muted">{r.notes}</span>}
							</div>
						))}
					</div>
				</section>
			)}
		</>
	);
}


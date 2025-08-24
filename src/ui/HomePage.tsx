import React, { useState } from 'react';
import { useLocalState } from '../utils/useLocalState';
import { EvaluationCriterion, WebsiteEvaluation } from '../utils/model';

interface Website {
	id: string;
	url: string;
	name: string;
	lastEvaluated?: Date;
	evaluations: WebsiteEvaluation[];
}

export function HomePage(): JSX.Element {
	const [websites, setWebsites] = useLocalState<Website[]>('websites:v1', []);
	const [criteria] = useLocalState<EvaluationCriterion[]>('criteria:v1', []);
	const [showAddForm, setShowAddForm] = useState<boolean>(false);
	const [websiteEntries, setWebsiteEntries] = useState<Array<{ id: string; url: string; name: string }>>([
		{ id: '1', url: '', name: '' }
	]);
	const [llmResponse, setLlmResponse] = useState<any>(null);
	const [isCallingLlm, setIsCallingLlm] = useState<boolean>(false);

	function addWebsiteRow(): void {
		const newId = (websiteEntries.length + 1).toString();
		setWebsiteEntries(prev => [...prev, { id: newId, url: '', name: '' }]);
	}

	function removeWebsiteRow(id: string): void {
		if (websiteEntries.length > 1) {
			setWebsiteEntries(prev => prev.filter(entry => entry.id !== id));
		}
	}

	function updateWebsiteEntry(id: string, field: 'url' | 'name', value: string): void {
		setWebsiteEntries(prev => prev.map(entry => 
			entry.id === id ? { ...entry, [field]: value } : entry
		));
	}

	function addWebsites(): void {
		const validEntries = websiteEntries.filter(entry => 
			entry.url.trim() && entry.name.trim()
		);

		if (validEntries.length === 0) return;

		const newWebsites: Website[] = validEntries.map(entry => ({
			id: `website-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			url: entry.url.trim(),
			name: entry.name.trim(),
			evaluations: []
		}));

		setWebsites(prev => [...prev, ...newWebsites]);
		setWebsiteEntries([{ id: '1', url: '', name: '' }]);
		setShowAddForm(false);
	}

	function cancelAddWebsites(): void {
		setWebsiteEntries([{ id: '1', url: '', name: '' }]);
		setShowAddForm(false);
	}

	function removeWebsite(id: string): void {
		if (window.confirm('Are you sure you want to remove this website?')) {
			setWebsites(prev => prev.filter(w => w.id !== id));
		}
	}

	function getEvaluationStatus(website: Website, criterionId: string): string {
		const evaluation = website.evaluations.find(e => e.criterionId === criterionId);
		if (!evaluation) return 'Not Evaluated';
		return evaluation.alignment || 'Unknown';
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'HIGH': return '#1c7a43';
			case 'MEDIUM': return '#856404';
			case 'LOW': return '#721c24';
			case 'Not Evaluated': return '#6c757d';
			default: return '#6c757d';
		}
	}

	function calculateAverageScore(website: Website): number {
		if (!website.evaluations || website.evaluations.length === 0) {
			return 0;
		}

		const scores = { 'HIGH': 100, 'MEDIUM': 66, 'LOW': 33 };
		const totalScore = website.evaluations.reduce((acc, evaluation) => {
			return acc + (scores[evaluation.alignment as keyof typeof scores] || 0);
		}, 0);

		return totalScore / website.evaluations.length;
	}

	function getRowBackgroundColor(website: Website): string {
		const averageScore = calculateAverageScore(website);
		
		if (averageScore === 0) {
			return 'transparent'; // No evaluations
		} else if (averageScore >= 83) {
			return 'rgba(28, 122, 67, 0.1)'; // High compliance - light green
		} else if (averageScore >= 50) {
			return 'rgba(133, 100, 4, 0.1)'; // Medium compliance - light yellow
		} else {
			return 'rgba(114, 28, 36, 0.1)'; // Low compliance - light red
		}
	}

	function getRowBorderColor(website: Website): string {
		const averageScore = calculateAverageScore(website);
		
		if (averageScore === 0) {
			return 'var(--border)'; // No evaluations
		} else if (averageScore >= 83) {
			return '#1c7a43'; // High compliance - green border
		} else if (averageScore >= 50) {
			return '#856404'; // Medium compliance - yellow border
		} else {
			return '#721c24'; // Low compliance - red border
		}
	}

	function navigateToEvaluator(websiteId: string): void {
		// Store the selected website ID and navigate
		localStorage.setItem('selectedWebsiteId', websiteId);
		// Trigger navigation by updating a shared state
		window.dispatchEvent(new CustomEvent('navigate-to-evaluator', { detail: { websiteId } }));
	}

	async function callHelloEndpoint(): Promise<void> {
		setIsCallingLlm(true);
		try {
			const response = await fetch('http://localhost:3001/hello');
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			setLlmResponse(data);
		} catch (error) {
			console.error('Failed to call hello endpoint:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
			setLlmResponse({ error: errorMessage });
		} finally {
			setIsCallingLlm(false);
		}
	}

	return (
		<div className="homepage">
			<header className="homepage-header">
				<h1>AI Transparency Statement Evaluator Dashboard</h1>
				<p className="muted">Manage and evaluate multiple websites against your criteria</p>
			</header>

			<section className="dashboard-controls">
				<button 
					className="button primary" 
					onClick={() => setShowAddForm(true)}
				>
					+ Add Website
				</button>
			</section>

			{showAddForm && (
				<section className="add-website-form panel">
					<h3>Add New Websites</h3>
					<div className="add-website-rows">
						{websiteEntries.map(entry => (
							<div key={entry.id} className="add-website-row">
								<div className="form-field">
									<label htmlFor={`website-name-${entry.id}`}>Website Name</label>
									<input
										id={`website-name-${entry.id}`}
										type="text"
										placeholder="Enter website name"
										value={entry.name}
										onChange={(e) => updateWebsiteEntry(entry.id, 'name', e.target.value)}
									/>
								</div>
								<div className="form-field">
									<label htmlFor={`website-url-${entry.id}`}>Website URL</label>
									<input
										id={`website-url-${entry.id}`}
										type="url"
										placeholder="https://example.com"
										value={entry.url}
										onChange={(e) => updateWebsiteEntry(entry.id, 'url', e.target.value)}
									/>
								</div>
								{websiteEntries.length > 1 && (
									<button 
										className="button small danger" 
										onClick={() => removeWebsiteRow(entry.id)}
										title="Remove website row"
									>
										🗑️
									</button>
								)}
							</div>
						))}
					</div>
					<div className="form-actions">
						<button className="button small" onClick={addWebsiteRow}>+ Add Another Website</button>
						<button className="button" onClick={addWebsites}>Add All Websites</button>
						<button className="button ghost" onClick={cancelAddWebsites}>Cancel</button>
					</div>
				</section>
			)}

			<section className="websites-table-container">
				{websites.length > 0 && (
					<div className="color-legend">
						<div className="legend-item">
							<div className="legend-color high"></div>
							<span>High Compliance (≥83%)</span>
						</div>
						<div className="legend-item">
							<div className="legend-color medium"></div>
							<span>Medium Compliance (50-82%)</span>
						</div>
						<div className="legend-item">
							<div className="legend-color low"></div>
							<span>Low Compliance (&lt;50%)</span>
						</div>
					</div>
				)}
				{websites.length === 0 ? (
					<div className="empty-state panel">
						<h3>No Websites Added</h3>
						<p>Start by adding your first website to evaluate against your criteria.</p>
						<button className="button primary" onClick={() => setShowAddForm(true)}>
							Add Your First Website
						</button>
					</div>
				) : (
					<div className="websites-table-wrapper">
						<table className="websites-table">
							<thead>
								<tr>
									<th className="website-column">Website</th>
									{criteria.map(criterion => (
										<th key={criterion.id} className="criterion-column">
											{criterion.name}
										</th>
									))}
									<th className="actions-column">Actions</th>
								</tr>
							</thead>
							<tbody>
								{websites.map(website => (
									<tr 
										key={website.id}
										className="website-row"
										style={{
											backgroundColor: getRowBackgroundColor(website),
											borderLeft: `3px solid ${getRowBorderColor(website)}`
										}}
									>
										<td className="website-cell" onClick={() => navigateToEvaluator(website.id)}>
											<div className="website-info">
												<div className="website-header">
													<strong>{website.name}</strong>
													{website.evaluations && website.evaluations.length > 0 && (
														<span className="average-score">
															{Math.round(calculateAverageScore(website))}%
														</span>
													)}
												</div>
												<small>{website.url}</small>
												{website.lastEvaluated && (
													<small className="last-evaluated">
														Last evaluated: {new Date(website.lastEvaluated).toLocaleDateString()}
													</small>
												)}
											</div>
										</td>
										{criteria.map(criterion => {
											const status = getEvaluationStatus(website, criterion.id);
											return (
												<td key={criterion.id} className="status-cell">
													<span 
														className="status-indicator"
														style={{ backgroundColor: getStatusColor(status) }}
													>
														{status}
													</span>
												</td>
											);
										})}
										<td className="actions-cell">
											<button 
												className="button small danger" 
												onClick={() => removeWebsite(website.id)}
												title="Remove website"
											>
												🗑️
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</div>
	);
}

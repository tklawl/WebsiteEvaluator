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
	const [newWebsite, setNewWebsite] = useState<{ url: string; name: string }>({ url: '', name: '' });
	const [llmResponse, setLlmResponse] = useState<any>(null);
	const [isCallingLlm, setIsCallingLlm] = useState<boolean>(false);

	function addWebsite(): void {
		if (!newWebsite.url.trim() || !newWebsite.name.trim()) return;

		const website: Website = {
			id: `website-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			url: newWebsite.url.trim(),
			name: newWebsite.name.trim(),
			evaluations: []
		};

		setWebsites(prev => [...prev, website]);
		setNewWebsite({ url: '', name: '' });
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
				<h1>Website Evaluator Dashboard</h1>
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
					<h3>Add New Website</h3>
					<div className="form-row">
						<div className="form-field">
							<label htmlFor="website-name">Website Name</label>
							<input
								id="website-name"
								type="text"
								placeholder="Enter website name"
								value={newWebsite.name}
								onChange={(e) => setNewWebsite(prev => ({ ...prev, name: e.target.value }))}
							/>
						</div>
						<div className="form-field">
							<label htmlFor="website-url">Website URL</label>
							<input
								id="website-url"
								type="url"
								placeholder="https://example.com"
								value={newWebsite.url}
								onChange={(e) => setNewWebsite(prev => ({ ...prev, url: e.target.value }))}
							/>
						</div>
						<div className="form-actions">
							<button className="button" onClick={addWebsite}>Add Website</button>
							<button className="button ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
						</div>
					</div>
				</section>
			)}

			<section className="websites-table-container">
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
									<tr key={website.id}>
										<td className="website-cell" onClick={() => navigateToEvaluator(website.id)}>
											<div className="website-info">
												<strong>{website.name}</strong>
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

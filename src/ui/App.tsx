import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CriteriaSidebar } from './CriteriaSidebar';
import { Evaluator } from './Evaluator';
import { HomePage } from './HomePage';
import { useLocalState } from '../utils/useLocalState';
import { Website } from '../utils/model';

type View = 'home' | 'evaluator';

export function App(): JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [sidebarWidth, setSidebarWidth] = useLocalState<number>('ui:sidebarWidth:v1', 300);
	const [isResizing, setIsResizing] = useState<boolean>(false);
	const [currentView, setCurrentView] = useState<View>('home');
	const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);

	const onMouseMove = useCallback((e: MouseEvent) => {
		if (!containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const raw = e.clientX - rect.left;
		const min = 220;
		const max = Math.min(600, Math.max(min, window.innerWidth - 360));
		const next = Math.max(min, Math.min(max, raw));
		setSidebarWidth(next);
	}, [setSidebarWidth]);

	const stopResizing = useCallback(() => {
		setIsResizing(false);
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', stopResizing);
	}, [onMouseMove]);

	const startResizing = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setIsResizing(true);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', stopResizing);
	}, [onMouseMove, stopResizing]);

	useEffect(() => () => {
		window.removeEventListener('mousemove', onMouseMove);
		window.removeEventListener('mouseup', stopResizing);
	}, [onMouseMove, stopResizing]);

	// Listen for navigation events
	useEffect(() => {
		const handleNavigateToEvaluator = (event: CustomEvent) => {
			const websiteId = event.detail.websiteId;
			// Get the website data from localStorage
			const websites = JSON.parse(localStorage.getItem('websites:v1') || '[]');
			const website = websites.find((w: Website) => w.id === websiteId);
			if (website) {
				setSelectedWebsite(website);
				setCurrentView('evaluator');
			}
		};

		window.addEventListener('navigate-to-evaluator', handleNavigateToEvaluator as EventListener);
		
		return () => {
			window.removeEventListener('navigate-to-evaluator', handleNavigateToEvaluator as EventListener);
		};
	}, []);

	function navigateToHome(): void {
		setCurrentView('home');
		setSelectedWebsite(null);
	}

	function handleWebsiteUpdated(updatedWebsite: Website): void {
		// Update the website in localStorage
		const websites = JSON.parse(localStorage.getItem('websites:v1') || '[]');
		const updatedWebsites = websites.map((w: Website) => 
			w.id === updatedWebsite.id ? updatedWebsite : w
		);
		localStorage.setItem('websites:v1', JSON.stringify(updatedWebsites));
		
		// Navigate back to home
		navigateToHome();
	}

	return (
		<div
			ref={containerRef}
			className={`app-shell${isResizing ? ' resizing' : ''}`}
			style={{ gridTemplateColumns: `${Math.round(sidebarWidth)}px 1fr` }}
		>
			<aside className="sidebar">
				<a className="brand" href="https://www.dta.gov.au/" target="_blank" rel="noreferrer" aria-label="Digital Transformation Agency">
					<img src="https://www.dta.gov.au/themes/custom/dta-gov-au/images/dta-wordmark-white.svg?v=4bffd53f" alt="Digital Transformation Agency" />
				</a>
				<h1>AI Transparency Statement Evaluator</h1>
				<p className="muted">Select criteria to assess</p>
				<CriteriaSidebar />
				<div className="resizer" onMouseDown={startResizing} role="separator" aria-orientation="vertical" aria-label="Resize sidebar" />
			</aside>
			<main className="content">
				{currentView === 'home' ? (
					<HomePage />
				) : (
					<div className="evaluator-container">
						<div className="evaluator-header">
							<button className="button ghost" onClick={navigateToHome}>
								← Back to Dashboard
							</button>
							<h2>Evaluating: {selectedWebsite?.name}</h2>
						</div>
						<Evaluator 
							website={selectedWebsite!}
							onWebsiteUpdated={handleWebsiteUpdated}
						/>
					</div>
				)}
			</main>
		</div>
	);
}


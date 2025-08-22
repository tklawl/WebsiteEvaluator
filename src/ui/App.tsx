import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CriteriaSidebar } from './CriteriaSidebar';
import { Evaluator } from './Evaluator';
import { useLocalState } from '../utils/useLocalState';

export function App(): JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [sidebarWidth, setSidebarWidth] = useLocalState<number>('ui:sidebarWidth:v1', 300);
	const [isResizing, setIsResizing] = useState<boolean>(false);

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
				<h1>Website Evaluator</h1>
				<p className="muted">Select criteria to assess</p>
				<CriteriaSidebar />
				<div className="resizer" onMouseDown={startResizing} role="separator" aria-orientation="vertical" aria-label="Resize sidebar" />
			</aside>
			<main className="content">
				<Evaluator />
			</main>
		</div>
	);
}


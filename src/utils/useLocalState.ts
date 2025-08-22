import { useCallback, useEffect, useState } from 'react';

// Custom event system for localStorage changes
const storageEvent = new EventTarget();

function notifyStorageChange(key: string, value: any) {
	storageEvent.dispatchEvent(new CustomEvent('storage-change', { 
		detail: { key, value } 
	}));
}

export function useLocalState<T>(key: string, initial: T) {
	const [state, setState] = useState<T>(() => {
		try {
			const raw = localStorage.getItem(key);
			return raw ? (JSON.parse(raw) as T) : initial;
		} catch {
			return initial;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(key, JSON.stringify(state));
			// Notify other components of the change
			notifyStorageChange(key, state);
		} catch {
			// ignore write errors
		}
	}, [key, state]);

	// Listen for changes from other components
	useEffect(() => {
		const handleStorageChange = (event: CustomEvent) => {
			if (event.detail.key === key) {
				setState(event.detail.value);
			}
		};

		storageEvent.addEventListener('storage-change', handleStorageChange as EventListener);
		
		return () => {
			storageEvent.removeEventListener('storage-change', handleStorageChange as EventListener);
		};
	}, [key]);

	const set = useCallback((updater: T | ((prev: T) => T)) => {
		setState(prev => (typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater));
	}, []);

	return [state, set] as const;
}



import { useCallback, useEffect, useState } from 'react';

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
		} catch {
			// ignore write errors
		}
	}, [key, state]);

	const set = useCallback((updater: T | ((prev: T) => T)) => {
		setState(prev => (typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater));
	}, []);

	return [state, set] as const;
}



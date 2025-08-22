export interface EvaluateRequest {
	url: string;
	name: string;
	description: string;
}

export async function evaluateWebsite(req: EvaluateRequest): Promise<string> {
	const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
	const endpoint = baseUrl ? `${baseUrl.replace(/\/$/, '')}/evaluateWebsite/` : undefined;

	if (!endpoint) {
		// Fallback: mock response
		return `${req.name} - Fake Summary`;
	}

	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(req)
		});
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		const data = (await res.json()) as { summary?: string } | string;
		if (typeof data === 'string') return data;
		return data.summary ?? `${req.name} - Fake Summary`;
	} catch {
		return `${req.name} - Fake Summary`;
	}
}



import React, { useMemo, useState } from 'react';
import { useLocalState } from '../utils/useLocalState';
import { defaultCriteria, EvaluationCriterion } from '../utils/model';

export function CriteriaSidebar(): JSX.Element {
	const [criteria, setCriteria] = useLocalState<EvaluationCriterion[]>(
		'criteria:v1',
		defaultCriteria
	);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [draft, setDraft] = useState<{ name: string; definition: string } | null>(null);

	const criteriaById = useMemo(() => (
		criteria.reduce<Record<string, EvaluationCriterion>>((acc, item) => {
			acc[item.id] = item;
			return acc;
		}, {})
	), [criteria]);

	function generateId(): string {
		return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	}

	function toggleCriterion(id: string): void {
		setCriteria((prev: EvaluationCriterion[]) => prev.map((c: EvaluationCriterion) => c.id === id ? { ...c, selected: !c.selected } : c));
	}


	function onEditClick(id: string): void {
		setExpandedId(prev => {
			if (prev === id) {
				setDraft(null);
				return null;
			}
			const current = criteriaById[id];
			setDraft({ name: current?.name ?? '', definition: current?.definition ?? '' });
			return id;
		});
	}

	function onDraftChange(field: 'name' | 'definition', value: string): void {
		setDraft(prev => (prev ? { ...prev, [field]: value } : prev));
	}

	function onSave(id: string): void {
		if (!draft) return;
		setCriteria((prev: EvaluationCriterion[]) => prev.map((c: EvaluationCriterion) => c.id === id ? { ...c, name: draft.name, definition: draft.definition } : c));
		setExpandedId(null);
		setDraft(null);
	}

	function onCancel(): void {
		setExpandedId(null);
		setDraft(null);
	}

	function onAdd(): void {
		const id = generateId();
		const newCriterion: EvaluationCriterion = {
			id,
			name: 'New criterion',
			definition: '',
			selected: false,
		};
		setCriteria((prev: EvaluationCriterion[]) => [newCriterion, ...prev]);
		setExpandedId(id);
		setDraft({ name: newCriterion.name, definition: newCriterion.definition ?? '' });
	}

	function onRemove(id: string): void {
		const toRemove = criteriaById[id];
		if (!toRemove) return;
		const ok = window.confirm(`Remove criterion "${toRemove.name}"?`);
		if (!ok) return;
		setCriteria((prev: EvaluationCriterion[]) => prev.filter((c: EvaluationCriterion) => c.id !== id));
		if (expandedId === id) {
			setExpandedId(null);
			setDraft(null);
		}
	}

	return (
		<>
		<div className="criteria-toolbar">
			<button type="button" className="button" onClick={onAdd}>Add criterion</button>
		</div>
		<div className="criteria-list">
			{criteria.map((criterion: EvaluationCriterion) => (
				<div key={criterion.id} className="criterion-row">
					<label className="criterion">
						<input
							type="checkbox"
							checked={!!criterion.selected}
							onChange={() => toggleCriterion(criterion.id)}
						/>
						<span className="criterion-name">{criterion.name}</span>
					</label>
					<button className="icon-button" aria-label={`Edit ${criterion.name}`} onClick={() => onEditClick(criterion.id)}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" fill="#d8e2ee"/>
							<path d="M20.71 7.04a1.003 1.003 0 0 0 0-1.42L18.37 3.29a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z" fill="#d8e2ee"/>
						</svg>
					</button>
					<button className="icon-button danger" aria-label={`Remove ${criterion.name}`} onClick={() => onRemove(criterion.id)}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="#ffb3b3"/>
						</svg>
					</button>
					{expandedId === criterion.id && (
						<div className="criterion-editor">
							<div className="field">
								<label htmlFor={`name-${criterion.id}`}>Name</label>
								<input
									id={`name-${criterion.id}`}
									className="text-input"
									value={draft?.name ?? ''}
									onChange={e => onDraftChange('name', e.target.value)}
									placeholder="Criterion name"
								/>
							</div>
							<div className="field">
								<label htmlFor={`def-${criterion.id}`}>Definition</label>
								<textarea
									id={`def-${criterion.id}`}
									className="text-area"
									value={draft?.definition ?? ''}
									onChange={e => onDraftChange('definition', e.target.value)}
									placeholder="Define the criterion..."
									rows={3}
								/>
							</div>
							<div className="actions">
								<button type="button" className="button" onClick={() => onSave(criterion.id)}>Save</button>
								<button type="button" className="button ghost" onClick={onCancel}>Cancel</button>
							</div>
						</div>
					)}
				</div>
			))}
		</div>
		</>
	);
}


import React, { useMemo, useState } from 'react';
import { useLocalState } from '../utils/useLocalState';
import { defaultCriteria, EvaluationCriterion } from '../utils/model';

interface ImportExportModalProps {
	isOpen: boolean;
	onClose: () => void;
	mode: 'import' | 'export' | 'add' | 'edit';
	criteria: EvaluationCriterion[];
	onImport: (criteria: EvaluationCriterion[]) => void;
	addCriterionDraft?: { name: string; definition: string };
	onAddCriterionDraftChange?: (field: 'name' | 'definition', value: string) => void;
	onSaveNewCriterion?: () => void;
	editCriterionDraft?: { id: string; name: string; definition: string } | null;
	onEditCriterionDraftChange?: (field: 'name' | 'definition', value: string) => void;
	onSaveEditCriterion?: () => void;
}

function ImportExportModal({ 
	isOpen, 
	onClose, 
	mode, 
	criteria, 
	onImport, 
	addCriterionDraft,
	onAddCriterionDraftChange,
	onSaveNewCriterion,
	editCriterionDraft,
	onEditCriterionDraftChange,
	onSaveEditCriterion
}: ImportExportModalProps): JSX.Element | null {
	const [jsonInput, setJsonInput] = useState('');
	const [error, setError] = useState<string | null>(null);

	if (!isOpen) return null;

	const handleExport = () => {
		const jsonString = JSON.stringify(criteria, null, 2);
		navigator.clipboard.writeText(jsonString).then(() => {
			// Could show a success message here
		}).catch(() => {
			// Fallback for older browsers
			const textArea = document.createElement('textarea');
			textArea.value = jsonString;
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand('copy');
			document.body.removeChild(textArea);
		});
	};

	const handleImport = () => {
		try {
			const parsed = JSON.parse(jsonInput);
			if (!Array.isArray(parsed)) {
				setError('Invalid format: must be an array of criteria');
				return;
			}
			
			// Validate the structure
			const isValid = parsed.every(item => 
				item && 
				typeof item === 'object' && 
				typeof item.id === 'string' && 
				typeof item.name === 'string'
			);
			
			if (!isValid) {
				setError('Invalid format: each criterion must have id and name fields');
				return;
			}

			// Ensure each criterion has required fields
			const validatedCriteria: EvaluationCriterion[] = parsed.map(item => ({
				id: item.id,
				name: item.name,
				description: item.description || '',
				definition: item.definition || '',
			}));

			onImport(validatedCriteria);
			setError(null);
			setJsonInput('');
			onClose();
		} catch (err) {
			setError('Invalid JSON format');
		}
	};

	const handleClose = () => {
		setError(null);
		setJsonInput('');
		onClose();
	};

	return (
		<div className="import-export-modal">
			<div className="import-export-modal-content">
				<div className="import-export-modal-header">
					<h3>{mode === 'export' ? 'Export Criteria' : mode === 'import' ? 'Import Criteria' : mode === 'add' ? 'Add New Criterion' : 'Edit Criterion'}</h3>
					<button className="import-export-modal-close" onClick={handleClose}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"/>
						</svg>
					</button>
				</div>
				<div className="import-export-modal-body">
					{mode === 'export' ? (
						<div>
							<p>Click the button below to copy all criteria to your clipboard as JSON:</p>
							<div className="export-actions">
								<button type="button" className="button" onClick={handleExport}>
									Copy to Clipboard
								</button>
							</div>
							<div className="json-preview">
								<label htmlFor="json-preview">Preview:</label>
								<textarea
									id="json-preview"
									className="json-textarea"
									value={JSON.stringify(criteria, null, 2)}
									readOnly
									rows={10}
								/>
							</div>
						</div>
					) : mode === 'import' ? (
						<div>
							<p>Paste JSON criteria data below to import:</p>
							<div className="json-input">
								<label htmlFor="json-input">JSON Data:</label>
								<textarea
									id="json-input"
									className="json-textarea"
									value={jsonInput}
									onChange={(e) => setJsonInput(e.target.value)}
									placeholder="Paste JSON criteria here..."
									rows={10}
								/>
							</div>
							{error && <div className="error-message">{error}</div>}
							<div className="import-actions">
								<button type="button" className="button" onClick={handleImport}>
									Import Criteria
								</button>
								<button type="button" className="button ghost" onClick={handleClose}>
									Cancel
								</button>
							</div>
						</div>
					) : mode === 'add' ? (
						<div>
							<div className="field">
								<label htmlFor="criterion-name">Name</label>
								<input
									id="criterion-name"
									className="text-input"
									value={addCriterionDraft?.name ?? ''}
									onChange={e => onAddCriterionDraftChange?.('name', e.target.value)}
									placeholder="Enter criterion name"
								/>
							</div>
							<div className="field">
								<label htmlFor="criterion-definition">Definition</label>
								<textarea
									id="criterion-definition"
									className="text-area"
									value={addCriterionDraft?.definition ?? ''}
									onChange={e => onAddCriterionDraftChange?.('definition', e.target.value)}
									placeholder="Define the criterion..."
									rows={5}
								/>
							</div>
							<div className="import-actions">
								<button 
									type="button" 
									className="button primary" 
									onClick={onSaveNewCriterion}
									disabled={!addCriterionDraft?.name.trim()}
								>
									Save Criterion
								</button>
								<button type="button" className="button" onClick={handleClose}>
									Cancel
								</button>
							</div>
						</div>
					) : (
						<div>
							<div className="field">
								<label htmlFor="edit-criterion-name">Name</label>
								<input
									id="edit-criterion-name"
									className="text-input"
									value={editCriterionDraft?.name ?? ''}
									onChange={e => onEditCriterionDraftChange?.('name', e.target.value)}
									placeholder="Enter criterion name"
								/>
							</div>
							<div className="field">
								<label htmlFor="edit-criterion-definition">Definition</label>
								<textarea
									id="edit-criterion-definition"
									className="text-area"
									value={editCriterionDraft?.definition ?? ''}
									onChange={e => onEditCriterionDraftChange?.('definition', e.target.value)}
									placeholder="Define the criterion..."
									rows={5}
								/>
							</div>
							<div className="import-actions">
								<button 
									type="button" 
									className="button primary" 
									onClick={onSaveEditCriterion}
									disabled={!editCriterionDraft?.name.trim()}
								>
									Save Changes
								</button>
								<button type="button" className="button" onClick={handleClose}>
									Cancel
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export function CriteriaSidebar(): JSX.Element {
	const [criteria, setCriteria] = useLocalState<EvaluationCriterion[]>(
		'criteria:v1',
		defaultCriteria
	);

	const [modalState, setModalState] = useState<{ isOpen: boolean; mode: 'import' | 'export' | 'add' | 'edit' }>({
		isOpen: false,
		mode: 'export'
	});
	const [addCriterionDraft, setAddCriterionDraft] = useState<{ name: string; definition: string }>({
		name: '',
		definition: ''
	});
	const [editCriterionDraft, setEditCriterionDraft] = useState<{ id: string; name: string; definition: string } | null>(null);

	const criteriaById = useMemo(() => (
		criteria.reduce<Record<string, EvaluationCriterion>>((acc, item) => {
			acc[item.id] = item;
			return acc;
		}, {})
	), [criteria]);

	function generateId(): string {
		return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	}

	function onEditClick(id: string): void {
		const current = criteriaById[id];
		if (current) {
			setEditCriterionDraft({
				id: current.id,
				name: current.name,
				definition: current.definition ?? ''
			});
			openModal('edit');
		}
	}



	function onAdd(): void {
		setAddCriterionDraft({ name: '', definition: '' });
		openModal('add');
	}

	function onRemove(id: string): void {
		const toRemove = criteriaById[id];
		if (!toRemove) return;
		const ok = window.confirm(`Remove criterion "${toRemove.name}"?`);
		if (!ok) return;
		setCriteria((prev: EvaluationCriterion[]) => prev.filter((c: EvaluationCriterion) => c.id !== id));
	}

	function handleImport(criteria: EvaluationCriterion[]): void {
		setCriteria(criteria);
	}

	function openModal(mode: 'import' | 'export' | 'add' | 'edit'): void {
		setModalState({ isOpen: true, mode });
	}

	function closeModal(): void {
		setModalState({ isOpen: false, mode: 'export' });
	}

	function onAddCriterionDraftChange(field: 'name' | 'definition', value: string): void {
		setAddCriterionDraft(prev => ({ ...prev, [field]: value }));
	}

	function onSaveNewCriterion(): void {
		if (!addCriterionDraft.name.trim()) return;

		const newCriterion: EvaluationCriterion = {
			id: generateId(),
			name: addCriterionDraft.name.trim(),
			definition: addCriterionDraft.definition.trim(),
		};

		setCriteria((prev: EvaluationCriterion[]) => [newCriterion, ...prev]);
		setAddCriterionDraft({ name: '', definition: '' });
		closeModal();
	}

	function onEditCriterionDraftChange(field: 'name' | 'definition', value: string): void {
		setEditCriterionDraft(prev => prev ? { ...prev, [field]: value } : null);
	}

	function onSaveEditCriterion(): void {
		if (!editCriterionDraft || !editCriterionDraft.name.trim()) return;

		setCriteria((prev: EvaluationCriterion[]) => prev.map((c: EvaluationCriterion) => 
			c.id === editCriterionDraft.id 
				? { ...c, name: editCriterionDraft.name.trim(), definition: editCriterionDraft.definition.trim() }
				: c
		));

		setEditCriterionDraft(null);
		closeModal();
	}

	return (
		<>
		<div className="criteria-toolbar">
			<div className="toolbar-left">
				<button type="button" className="button" onClick={() => openModal('export')}>Export</button>
				<button type="button" className="button" onClick={() => openModal('import')}>Import</button>
			</div>
			<div className="toolbar-right">
				<button type="button" className="button" onClick={onAdd}>+</button>
			</div>
		</div>
		<div className="criteria-list">
			{criteria.map((criterion: EvaluationCriterion) => (
				<div key={criterion.id} className="criterion-row">
					<div className="criterion">
						<span className="criterion-name">{criterion.name}</span>
					</div>
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
				</div>
			))}
		</div>
		<ImportExportModal
			isOpen={modalState.isOpen}
			onClose={closeModal}
			mode={modalState.mode}
			criteria={criteria}
			onImport={handleImport}
			addCriterionDraft={addCriterionDraft}
			onAddCriterionDraftChange={onAddCriterionDraftChange}
			onSaveNewCriterion={onSaveNewCriterion}
			editCriterionDraft={editCriterionDraft}
			onEditCriterionDraftChange={onEditCriterionDraftChange}
			onSaveEditCriterion={onSaveEditCriterion}
		/>
		</>
	);
}


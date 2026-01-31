// Import Army Code Modal Component
import { X } from 'lucide-react';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    importCode: string;
    setImportCode: (code: string) => void;
    importError: string;
    onImport: () => void;
}

export function ImportModal({
    isOpen,
    onClose,
    importCode,
    setImportCode,
    importError,
    onImport
}: ImportModalProps) {
    if (!isOpen) return null;

    return (
        <div className="import-modal-overlay" onClick={onClose}>
            <div className="import-modal" onClick={e => e.stopPropagation()}>
                <div className="import-modal-header">
                    <h3>Import Army Code</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="import-modal-body">
                    <p>Paste an army code from the official Infinity Army builder:</p>
                    <textarea
                        value={importCode}
                        onChange={e => setImportCode(e.target.value)}
                        placeholder="Paste army code here..."
                        rows={4}
                    />
                    {importError && <div className="import-error">{importError}</div>}
                </div>
                <div className="import-modal-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        className="import-confirm-btn"
                        onClick={onImport}
                        disabled={!importCode.trim()}
                    >
                        Import List
                    </button>
                </div>
            </div>
        </div>
    );
}

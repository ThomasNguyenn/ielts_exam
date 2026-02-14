
import React from 'react';

export default function ConfirmationModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className={`modal-content premium-modal ${isDanger ? 'modal-danger' : ''}`}>
                <div className="modal-header">
                    <h3 className="modal-title">{title}</h3>
                </div>
                <div className="modal-body">
                    <p className="modal-message">{message}</p>
                </div>
                <div className="modal-actions">
                    <button className="btn btn-ghost" onClick={onClose}>
                        {cancelText}
                    </button>
                    <button
                        className={`btn ${isDanger ? 'btn-manage-add' : 'btn-primary'}`}
                        style={isDanger ? { background: '#ef4444' } : {}}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

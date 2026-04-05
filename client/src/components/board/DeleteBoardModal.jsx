import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

/**
 * DeleteBoardModal — confirmation dialog for deleting a board.
 * Warns the user that tasks + comments under the board will also be removed.
 */
const DeleteBoardModal = ({ isOpen, board, onClose, onConfirm }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await onConfirm(board);
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || 'Something went wrong';
      setError(msg);
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    onClose?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Delete Board"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Deleting…' : 'Delete Board'}
          </Button>
        </>
      }
    >
      <p
        className="font-body"
        style={{ fontSize: 14, color: 'var(--color-text-primary)' }}
      >
        Are you sure you want to delete{' '}
        <span className="font-semibold">{board?.name}</span>?
      </p>
      <p
        className="mt-2 font-body"
        style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}
      >
        All task groups, tasks, and comments under this board will be
        permanently removed. This action cannot be undone.
      </p>

      {error && (
        <p
          className="mt-3 font-body text-xs"
          style={{ color: 'var(--color-status-stuck)' }}
        >
          {error}
        </p>
      )}
    </Modal>
  );
};

export default DeleteBoardModal;

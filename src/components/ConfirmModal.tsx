import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';
import { t } from '../lang';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  variant = 'danger',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>{cancelLabel ?? t('common.cancel')}</Button>
          <Button
            variant={variant}
            disabled={submitting}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{body}</div>
    </Modal>
  );
}

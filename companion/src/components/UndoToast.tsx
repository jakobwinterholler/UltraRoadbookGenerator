interface UndoToastProps {
  stopName: string;
  message?: string;
  onUndo: () => void;
}

export default function UndoToast({ stopName, message = "updated", onUndo }: UndoToastProps) {
  return (
    <div className="undo-toast" role="status" aria-live="polite">
      <span className="undo-toast__text">
        {stopName} {message}
      </span>
      <button type="button" className="undo-toast__action" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

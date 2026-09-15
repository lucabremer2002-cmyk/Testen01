import { useUI } from '../state/store';

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <button
          type="button"
          key={t.id}
          className={`toast ${t.kind}`}
          onClick={() => dismiss(t.id)}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'nls.help.seen';

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Die Stadt lebt ohne dich',
    body:
      'Jeder Punkt auf der Karte ist ein Mensch mit eigener Persönlichkeit, eigenen Zielen und eigenem Tagesablauf. ' +
      'Niemand folgt einem Drehbuch – was passiert, ergibt sich aus ihren Entscheidungen.',
  },
  {
    title: 'Beobachten',
    body:
      'Klicke eine Person an, um ihr Leben zu sehen: Bedürfnisse, Gefühle, Beziehungen, Karriere, Lebenslinie. ' +
      'Ein Doppelklick markiert sie mit ★ und du findest sie jederzeit unter „Verfolgt“ wieder.',
  },
  {
    title: 'Zeit beschleunigen',
    body:
      'Mit den Stufen oben (bis 500×) vergehen in wenigen Minuten ganze Jahre. Beziehungen entstehen, ' +
      'Karrieren kippen, Kinder werden geboren. Unter „Geschichten“ erzählt das Spiel, was dabei herauskam.',
  },
  {
    title: 'Eingreifen',
    body:
      'Im Detailfenster öffnet „✦ Eingreifen“ den Gott-Modus: Geld schenken, Jobs vergeben, Menschen ' +
      'verkuppeln oder trennen, Gerüchte streuen, das Wetter drehen. Jeder Eingriff hat echte Folgen.',
  },
];

/** First-run introduction. Shown once, then remembered locally. */
export function HelpOverlay({ force, onClose }: { force?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (force) {
      setStep(0);
      setOpen(true);
      return;
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      // Private browsing without storage - simply show it every time.
      setOpen(true);
    }
  }, [force]);

  if (!open) return null;

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Not being able to remember this is not worth an error.
    }
    setOpen(false);
    onClose?.();
  };

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div className="help-backdrop" onClick={close}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <div className="help-progress">
          {STEPS.map((_, i) => (
            <span key={i} className={i === step ? 'active' : ''} />
          ))}
        </div>
        <h3>{current.title}</h3>
        <p>{current.body}</p>
        <div className="help-actions">
          <button type="button" className="btn" onClick={close}>
            Überspringen
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              Zurück
            </button>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={() => (last ? close() : setStep(step + 1))}
          >
            {last ? 'Los geht’s' : 'Weiter'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { errorMessage } from '../lib/errors';

interface ToastApi {
  show(msg: string, undo?: () => unknown): void;
  error(e: unknown): void;
}
const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ msg: string; undo?: () => unknown } | null>(null);
  const timer = useRef<number>();
  const show = useCallback((msg: string, undo?: () => unknown) => {
    window.clearTimeout(timer.current);
    setState({ msg, undo });
    timer.current = window.setTimeout(() => setState(null), undo ? 6000 : 3500);
  }, []);
  const error = useCallback((e: unknown) => show(errorMessage(e)), [show]);
  return (
    <Ctx.Provider value={{ show, error }}>
      {children}
      <div className="toast" role="status" aria-live="polite" hidden={!state}>
        <span>{state?.msg}</span>
        {state?.undo && (
          <button type="button" onClick={() => { const u = state.undo; setState(null); Promise.resolve().then(u).catch(error); }}>Batal</button>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}

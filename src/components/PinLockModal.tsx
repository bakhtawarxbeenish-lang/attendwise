import React, { useState } from 'react';
import { Lock, Delete } from 'lucide-react';

interface PinLockModalProps {
  expectedPin: string;
  onUnlock: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({ expectedPin, onUnlock }) => {
  const [entered, setEntered] = useState('');
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    if (entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    setError(false);

    if (next.length === 4) {
      if (next === expectedPin) {
        onUnlock();
      } else {
        setError(true);
        setTimeout(() => setEntered(''), 450);
      }
    }
  };

  const handleBackspace = () => {
    setEntered((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4">
      <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center shadow-2xl">
        <div className="w-12 h-12 rounded-2xl accent-soft-bg accent-text flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">AttendEase Locked</h2>
        <p className="mt-1 text-xs text-slate-400">
          Enter your 4-digit teacher PIN to continue
        </p>

        <div className="my-6 flex items-center justify-center gap-3">
          {[0, 1, 2, 3].map((idx) => {
            const filled = entered.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  error
                    ? 'bg-rose-500 scale-110'
                    : filled
                    ? 'accent-bg scale-110'
                    : 'bg-slate-700'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-rose-400 mb-3">Incorrect PIN. Try again.</p>
        )}

        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              onClick={() => handleDigit(d)}
              className="h-13 rounded-xl bg-slate-800/80 hover:bg-slate-800 active:scale-95 text-lg font-mono font-semibold text-white transition-all cursor-pointer"
            >
              {d}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleDigit('0')}
            className="h-13 rounded-xl bg-slate-800/80 hover:bg-slate-800 active:scale-95 text-lg font-mono font-semibold text-white transition-all cursor-pointer"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            aria-label="Backspace"
            className="h-13 rounded-xl bg-slate-800/50 hover:bg-slate-800 active:scale-95 flex items-center justify-center text-slate-300 transition-all cursor-pointer"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

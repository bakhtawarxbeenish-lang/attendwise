import React, { useState } from 'react';
import { Layers, Plus, Edit3, Trash2, Check, X } from 'lucide-react';
import { Student } from '../types';

interface ClassManagerModalProps {
  open: boolean;
  classes: string[];
  students: Student[];
  onClose: () => void;
  onAddClass: (className: string) => void;
  onRenameClass: (oldName: string, newName: string) => void;
  onDeleteClass: (className: string) => void;
}

export const ClassManagerModal: React.FC<ClassManagerModalProps> = ({
  open,
  classes,
  students,
  onClose,
  onAddClass,
  onRenameClass,
  onDeleteClass,
}) => {
  const [newClassName, setNewClassName] = useState('');
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) return;
    if (classes.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setError('This class already exists.');
      return;
    }
    setError('');
    onAddClass(trimmed);
    setNewClassName('');
  };

  const startEditing = (cls: string) => {
    setEditingClass(cls);
    setEditingValue(cls);
    setError('');
  };

  const saveEdit = (oldName: string) => {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setError('Class name cannot be empty.');
      return;
    }
    if (
      trimmed.toLowerCase() !== oldName.toLowerCase() &&
      classes.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      setError('Another class with this name already exists.');
      return;
    }
    setError('');
    onRenameClass(oldName, trimmed);
    setEditingClass(null);
    setEditingValue('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl accent-soft-bg accent-text flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Manage Classes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add, rename, or remove classes & sections
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add New Class Form */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => {
              setNewClassName(e.target.value);
              setError('');
            }}
            placeholder="Enter class name (e.g. Class 10-A, BSCS)"
            className="flex-1 h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          />
          <button
            type="submit"
            className="px-4 h-10 rounded-xl accent-bg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs hover:opacity-95 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>

        {error && (
          <p className="text-xs text-rose-500 bg-rose-500/10 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        {/* Existing Classes List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-64 overflow-y-auto pr-1">
          {classes.length === 0 ? (
            <div className="py-8 text-center space-y-1">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                No classes created yet
              </p>
              <p className="text-[11px] text-slate-400">
                Type a class name above and tap Add to begin.
              </p>
            </div>
          ) : (
            classes.map((cls) => {
              const count = students.filter((s) => s.className === cls).length;
              const isEditing = editingClass === cls;

              return (
                <div
                  key={cls}
                  className="py-2.5 flex items-center justify-between gap-2"
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(cls);
                          if (e.key === 'Escape') setEditingClass(null);
                        }}
                        className="flex-1 h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs text-slate-800 dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(cls)}
                        className="p-2 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
                        title="Save class name"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingClass(null)}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {cls}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {count} {count === 1 ? 'student' : 'students'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(cls)}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                          title="Edit / Rename class"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteClass(cls)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Delete class"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

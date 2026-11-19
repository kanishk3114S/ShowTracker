import React, { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { createLibraryGroup, updateLibraryGroup, deleteLibraryGroup, toApiError } from '../../services/api';
import { GROUP_COLORS, groupStyle } from './groupStyles';

const fieldClass =
  'w-full rounded-xl border border-ink-edge bg-ink-raised px-4 py-2.5 text-[15px] text-fg placeholder-fg-subtle outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20';

function GroupForm({ group, onClose, onSaved, onDeleted }) {
  const editing = Boolean(group);
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [color, setColor] = useState(group?.color ?? 'amber');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);

  const trimmed = name.trim();
  const dirty = !editing || trimmed !== group.name || description.trim() !== (group.description ?? '') || color !== group.color;

  const run = async (task) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      const api = toApiError(err);
      const detail = api?.fieldErrors?.[0]?.message ?? null;
      setError(detail || api?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!trimmed || busy) return;
    const payload = { name: trimmed, description: description.trim() || null, color };
    run(async () => {
      const saved = editing ? await updateLibraryGroup(group.id, payload) : await createLibraryGroup(payload);
      onSaved(saved);
      onClose();
    });
  };

  const remove = () =>
    run(async () => {
      await deleteLibraryGroup(group.id);
      onDeleted?.(group);
      onClose();
    });

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="group-name" className="mb-1.5 block text-sm font-medium text-fg">
          Name
        </label>
        <input
          id="group-name"
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Watched in 2026"
          className={fieldClass}
          autoComplete="off"
        />
      </div>
      <div>
        <label htmlFor="group-description" className="mb-1.5 block text-sm font-medium text-fg">
          Description <span className="font-normal text-fg-subtle">(optional)</span>
        </label>
        <textarea
          id="group-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="What belongs on this shelf?"
          className={`${fieldClass} resize-none`}
        />
        <p className="mt-1 text-right font-mono text-xs tabular-nums text-fg-subtle">{description.length} / 200</p>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-fg">Colour</legend>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Group colour">
          {GROUP_COLORS.map((c) => {
            const style = groupStyle(c);
            const selected = c === color;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`flex h-8 w-8 items-center justify-center rounded-full ${style.dot} transition ${
                  selected ? `ring-2 ring-offset-2 ring-offset-ink-surface ${style.ring}` : 'opacity-70 hover:opacity-100'
                }`}
              >
                {selected && <Check className="h-4 w-4 text-ink-base" strokeWidth={3} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-[#ff9b9b]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-fg-muted">Delete this group? Your titles stay in the library.</span>
              <Button size="sm" variant="destructive" loading={busy} onClick={remove}>
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" leftIcon={Trash2} onClick={() => setConfirmDelete(true)} className="hover:!text-[#ff9b9b]">
              Delete group
            </Button>
          )
        ) : (
          <span />
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!trimmed || !dirty}>
            {editing ? 'Save' : 'Create group'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Create / rename / recolour / delete a custom group (frosted-glass dialog). */
export default function GroupModal({ open, group, onClose, onSaved, onDeleted }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={group ? 'Edit group' : 'New group'}
      description="Groups are private shelves. A title can be on as many as you like."
    >
      {/* remount per open so the form always starts from the current group */}
      {open && <GroupForm key={group?.id ?? 'new'} group={group} onClose={onClose} onSaved={onSaved} onDeleted={onDeleted} />}
    </Modal>
  );
}

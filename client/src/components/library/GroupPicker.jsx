import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Plus } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Skeleton } from '../ui/Skeleton';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';
import { addToLibraryGroup, createLibraryGroup, removeFromLibraryGroup, toApiError } from '../../services/api';
import { groupStyle } from './groupStyles';

const inputClass =
  'h-10 min-w-0 flex-1 rounded-xl border border-ink-edge bg-ink-raised px-3 text-sm text-fg placeholder-fg-subtle outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20';

function PickerBody({ entry, onChanged }) {
  const { toast } = useToast();
  const groups = useResource(R.groups());
  const memberships = useResource(R.entryGroups(entry.id));
  const [override, setOverride] = useState({}); // groupId -> boolean, instant UI before the server confirms
  const [pending, setPending] = useState(() => new Set());
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const serverIds = new Set(memberships.data?.groupIds ?? []);
  const isMember = (id) => override[id] ?? serverIds.has(id);

  const setBusy = (id, on) =>
    setPending((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggle = async (group) => {
    if (pending.has(group.id)) return;
    const next = !isMember(group.id);
    setOverride((prev) => ({ ...prev, [group.id]: next })); // optimistic
    setBusy(group.id, true);
    try {
      if (next) await addToLibraryGroup(group.id, entry.id);
      else await removeFromLibraryGroup(group.id, entry.id);
      groups.reload();
      onChanged?.();
    } catch (err) {
      setOverride((prev) => ({ ...prev, [group.id]: !next })); // roll back
      toast(`${toApiError(err)?.message ?? 'Could not update the group.'} Your change was undone.`);
    } finally {
      setBusy(group.id, false);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const group = await createLibraryGroup({ name });
      await addToLibraryGroup(group.id, entry.id);
      setOverride((prev) => ({ ...prev, [group.id]: true }));
      setNewName('');
      groups.reload();
      onChanged?.();
    } catch (err) {
      const api = toApiError(err);
      toast(api?.fieldErrors?.[0]?.message ?? api?.message ?? 'Could not create the group.');
    } finally {
      setCreating(false);
    }
  };

  const list = groups.data;
  return (
    <div>
      {(groups.loading && !list) || (memberships.loading && !memberships.data && !memberships.error) ? (
        <div role="status" aria-label="Loading groups" className="space-y-2">
          <Skeleton className="h-11 rounded-xl" />
          <Skeleton className="h-11 rounded-xl" />
        </div>
      ) : groups.error && !list ? (
        <p role="alert" className="text-sm text-[#ff9b9b]">
          {groups.error.message}
        </p>
      ) : list?.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-edge px-4 py-5 text-center text-sm text-fg-muted">
          You have no groups yet. Create your first one below.
        </p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1" aria-label="Your groups">
          {list.map((group) => {
            const style = groupStyle(group.color);
            const checked = isMember(group.id);
            return (
              <li key={group.id}>
                <motion.button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(group)}
                  whileTap={{ scale: 0.98 }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    checked ? style.active : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      checked ? `${style.dot} border-transparent text-ink-base` : 'border-white/25 text-transparent'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{group.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-fg-subtle">{group.itemCount}</span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={create} className="mt-4 flex gap-2 border-t border-ink-line pt-4">
        <label htmlFor="new-group-name" className="sr-only">
          New group name
        </label>
        <input
          id="new-group-name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={60}
          placeholder="New group…"
          autoComplete="off"
          className={inputClass}
        />
        <Button type="submit" variant="secondary" leftIcon={Plus} loading={creating} disabled={!newName.trim()}>
          Create
        </Button>
      </form>
    </div>
  );
}

/**
 * "Add to group": one checkbox per custom group; toggling adds/removes this library entry at once
 * (optimistic, rolled back with a toast if the server refuses). A title can be on many groups.
 */
export default function GroupPicker({ open, entry, onClose, onChanged }) {
  return (
    <Modal open={open && Boolean(entry)} onClose={onClose} size="sm" title="Add to group" description={entry?.media?.title ?? entry?.title}>
      {open && entry && <PickerBody key={entry.id} entry={entry} onChanged={onChanged} />}
    </Modal>
  );
}

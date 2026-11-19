import { AppError } from '../../middleware/errorHandler.js';
import { MAX_GROUPS_PER_USER } from './groups.validation.js';

/**
 * Custom library groups (shelves). Every function takes a `client` that is ALREADY
 * inside withUserTransaction(userId, ...), so Row Level Security sees the right user.
 * Queries also filter by user_id explicitly (defense in depth).
 *
 * A group never owns titles: it only links to the user's own library entries, so
 * deleting a group leaves the library untouched.
 */

const GROUP_SELECT = `
  SELECT g.id, g.name, g.description, g.color, g.created_at, g.updated_at,
         COUNT(i.library_entry_id)::int AS item_count
    FROM public.library_groups g
    LEFT JOIN public.library_group_items i ON i.group_id = g.id
`;

export const mapGroup = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  color: row.color,
  itemCount: row.item_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const groupNotFound = () => new AppError('Group not found.', 404, 'GROUP_NOT_FOUND');
const entryNotFound = () => new AppError('Library entry not found.', 404, 'LIBRARY_ENTRY_NOT_FOUND');
const nameTaken = () => new AppError('You already have a group with that name.', 409, 'GROUP_NAME_TAKEN');

const isUniqueViolation = (err) => err?.code === '23505';

async function fetchGroup(client, userId, groupId) {
  const { rows } = await client.query(`${GROUP_SELECT} WHERE g.id = $1 AND g.user_id = $2 GROUP BY g.id`, [
    groupId,
    userId
  ]);
  if (rows.length === 0) throw groupNotFound();
  return mapGroup(rows[0]);
}

export async function listGroups(client, userId) {
  const { rows } = await client.query(
    `${GROUP_SELECT} WHERE g.user_id = $1 GROUP BY g.id ORDER BY g.created_at ASC, g.name ASC`,
    [userId]
  );
  return rows.map(mapGroup);
}

export async function createGroup(client, userId, { name, description, color }) {
  const count = await client.query('SELECT COUNT(*)::int AS n FROM public.library_groups WHERE user_id = $1', [userId]);
  if (count.rows[0].n >= MAX_GROUPS_PER_USER) {
    throw new AppError(`You can have at most ${MAX_GROUPS_PER_USER} groups.`, 409, 'GROUP_LIMIT_REACHED');
  }
  let id;
  try {
    const { rows } = await client.query(
      `INSERT INTO public.library_groups (user_id, name, description, color)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, name, description ?? null, color ?? 'amber']
    );
    id = rows[0].id;
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken();
    throw err;
  }
  return fetchGroup(client, userId, id);
}

export async function updateGroup(client, userId, groupId, patch) {
  const sets = [];
  const params = [groupId, userId];
  for (const [column, value] of [
    ['name', patch.name],
    ['description', patch.description],
    ['color', patch.color]
  ]) {
    if (value !== undefined) {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
  }
  let rowCount;
  try {
    ({ rowCount } = await client.query(
      `UPDATE public.library_groups SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2`,
      params
    ));
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken();
    throw err;
  }
  if (rowCount === 0) throw groupNotFound();
  return fetchGroup(client, userId, groupId);
}

export async function deleteGroup(client, userId, groupId) {
  const { rowCount } = await client.query('DELETE FROM public.library_groups WHERE id = $1 AND user_id = $2', [
    groupId,
    userId
  ]);
  if (rowCount === 0) throw groupNotFound();
  return { id: groupId, removed: true };
}

async function assertOwnsEntry(client, userId, entryId) {
  const { rows } = await client.query('SELECT 1 FROM public.user_library WHERE id = $1 AND user_id = $2', [
    entryId,
    userId
  ]);
  if (rows.length === 0) throw entryNotFound();
}

export async function addItem(client, userId, groupId, libraryEntryId) {
  await fetchGroup(client, userId, groupId); // 404 for someone else's group
  await assertOwnsEntry(client, userId, libraryEntryId); // 404 for someone else's entry
  const { rowCount } = await client.query(
    `INSERT INTO public.library_group_items (group_id, library_entry_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [groupId, libraryEntryId]
  );
  return { group: await fetchGroup(client, userId, groupId), libraryEntryId, added: rowCount > 0 };
}

export async function removeItem(client, userId, groupId, libraryEntryId) {
  await fetchGroup(client, userId, groupId);
  const { rowCount } = await client.query(
    'DELETE FROM public.library_group_items WHERE group_id = $1 AND library_entry_id = $2',
    [groupId, libraryEntryId]
  );
  return { group: await fetchGroup(client, userId, groupId), libraryEntryId, removed: rowCount > 0 };
}

/** The ids of the groups one library title belongs to. */
export async function getEntryGroupIds(client, userId, libraryEntryId) {
  await assertOwnsEntry(client, userId, libraryEntryId);
  const { rows } = await client.query(
    `SELECT i.group_id
       FROM public.library_group_items i
       JOIN public.library_groups g ON g.id = i.group_id
      WHERE i.library_entry_id = $1 AND g.user_id = $2
      ORDER BY g.created_at ASC`,
    [libraryEntryId, userId]
  );
  return { libraryEntryId, groupIds: rows.map((r) => r.group_id) };
}

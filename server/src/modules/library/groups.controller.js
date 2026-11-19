import { handler, parse } from './library.controller.js';
import * as service from './groups.service.js';
import {
  createGroupSchema,
  updateGroupSchema,
  groupParamsSchema,
  groupItemBodySchema,
  groupItemParamsSchema,
  entryGroupsParamsSchema
} from './groups.validation.js';

export const list = handler((client, req) => service.listGroups(client, req.user.id), 200, { readOnly: true });

export const create = handler(
  (client, req) => service.createGroup(client, req.user.id, parse(createGroupSchema, req.body, 'Invalid group.')),
  201
);

export const update = handler((client, req) =>
  service.updateGroup(
    client,
    req.user.id,
    parse(groupParamsSchema, req.params).id,
    parse(updateGroupSchema, req.body, 'Invalid group.')
  )
);

export const remove = handler((client, req) =>
  service.deleteGroup(client, req.user.id, parse(groupParamsSchema, req.params).id)
);

export const addItem = handler(
  (client, req) =>
    service.addItem(
      client,
      req.user.id,
      parse(groupParamsSchema, req.params).id,
      parse(groupItemBodySchema, req.body).libraryEntryId
    ),
  201
);

export const removeItem = handler((client, req) => {
  const { id, libraryEntryId } = parse(groupItemParamsSchema, req.params);
  return service.removeItem(client, req.user.id, id, libraryEntryId);
});

export const entryGroups = handler(
  (client, req) => service.getEntryGroupIds(client, req.user.id, parse(entryGroupsParamsSchema, req.params).libraryEntryId),
  200,
  { readOnly: true }
);

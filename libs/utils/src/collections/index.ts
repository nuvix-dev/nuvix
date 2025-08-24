import { authCollections } from './common.js';
import { consoleCollections } from './console';
import { bucketCollections, dbCollections } from './misc';
import { projectCollections } from './project';

const collections = {
  auth: authCollections('project'),
  project: projectCollections,
  console: consoleCollections,
  bucket: bucketCollections,
  database: dbCollections,
};

export default collections;

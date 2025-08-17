import { consoleCollections } from './console';
import { bucketCollections, dbCollections } from './misc';
import { projectCollections } from './project';

const collections = {
  project: projectCollections,
  console: consoleCollections,
  bucket: bucketCollections,
  database: dbCollections,
};

export default collections;

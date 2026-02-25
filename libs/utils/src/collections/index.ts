import { authCollections, commonCollections } from './common.js'
import { internalCollections } from './internal.js'
import { bucketCollections, dbCollections } from './misc'
import { projectCollections } from './project'

const collections = {
  auth: authCollections,
  project: projectCollections,
  internal: internalCollections,
  bucket: bucketCollections,
  database: dbCollections,
  common: commonCollections,
}

export default collections

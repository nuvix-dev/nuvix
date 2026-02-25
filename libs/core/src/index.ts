export * from './core.module'
export * from './core.service.js'

export {
  DeleteRoute as Delete,
  GetRoute as Get,
  PatchRoute as Patch,
  PostRoute as Post,
  PutRoute as Put,
  Route,
  type RouteOptions,
} from './decorators/route.decorator'

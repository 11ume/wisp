import regexparam from 'regexparam'
import { Context, Handler, Payload } from 'wezi-types'
import composer, { composerSingleHandler } from 'wezi-composer'
import { getUrlParams } from './extractors'

export interface Params<T = any> {
    params: T
}

export interface ParamsWildcard {
    params?: {
        wild: string
    }
}

export type RouteEntity = {
    path: string
    single: boolean
    method: string
    handler: Handler
    handlers: Handler[]
    namespace: string
    keys: Array<string>
    params: boolean
    pattern: RegExp
}

const isHead = (context: Context) => context.req.method === 'HEAD'

const replyHead = (context: Context) => {
    context.res.writeHead(200, {
        'Content-Length': '0'
    })
    context.res.end(null, null, null)
}

const dispatchRoute = (context: Context, payload: Payload<Params>, entity: RouteEntity, match: RegExpExecArray) => {
    if (isHead(context)) {
        replyHead(context)
        return
    }

    const params = getUrlParams(entity, match)
    if (entity.single) {
        const dispatch = composerSingleHandler(entity.handler)
        dispatch(context, {
            params
            , ...payload
        })
        return
    }

    const dispatch = composer(false, ...entity.handlers)
    dispatch(context, {
        params
        , ...payload
    })
}

const findRouteMatch = (routerEntities: RouteEntity[]) => function routerMatch(context: Context, payload: Payload<Params>) {
    for (const entity of routerEntities) {
        if (context.req.method !== entity.method) continue
        const match = entity.pattern.exec(context.req.url)
        if (match) {
            dispatchRoute(context, payload, entity, match)
            return
        }
    }

    context.next(payload)
}

const haveParams = (keys: string[]) => keys.length > 0

const creteRouteEntity = (entity: RouteEntity, namespace: string) => {
    const namespaceMerge = `${namespace}${entity.namespace}`
    const { keys, pattern } = regexparam(`${namespaceMerge}${entity.path}`)
    const params = haveParams(keys)
    return {
        ...entity
        , keys
        , params
        , pattern
        , namespace
    }
}

const prepareRouteStack = (entities: RouteEntity[], namespace = ''): RouteEntity[] => entities.map((entity) => creteRouteEntity(entity, namespace))

const prepareRoutes = (entities: RouteEntity[]) => {
    const stack = prepareRouteStack(entities)
    return findRouteMatch(stack)
}

const prepareRoutesWhitNamespace = (entities: RouteEntity[], namespace?: string) => {
    const stack = prepareRouteStack(entities, namespace)
    return findRouteMatch(stack)
}

const inSingleHandler = (handlers: Handler[]) => handlers.length === 1

const createRouteEntity = (method: string) => (path: string, ...handlers: Handler[]): RouteEntity => {
    const single = inSingleHandler(handlers)
    const handler = handlers[0] ?? null
    const namespace = ''

    return {
        path
        , keys: null
        , pattern: null
        , params: false
        , single
        , method
        , handler
        , handlers
        , namespace
    }
}

export const createRouter = (namespace?: string) => (...entities: RouteEntity[] | RouteEntity[][]) => {
    const flat = [].concat(...entities)
    if (namespace) return prepareRoutesWhitNamespace(flat, namespace)
    return prepareRoutes(flat)
}

export const routes = (namespace?: string) => (...entities: RouteEntity[]) => {
    if (namespace) {
        return entities.map((entity) => {
            entity.namespace = namespace
            return entity
        })
    }

    return entities
}

export const get = createRouteEntity('GET')
export const post = createRouteEntity('POST')
export const put = createRouteEntity('PUT')
export const del = createRouteEntity('DELETE')
export const head = createRouteEntity('HEAD')
export const patch = createRouteEntity('PATCH')
export const options = createRouteEntity('OPTIONS')

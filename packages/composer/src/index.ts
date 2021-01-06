import { send, empty, json } from 'wezi-send'
import { createError, InternalError } from 'wezi-error'
import {
    Context
    , Dispatch
    , Handler
    , Next
    , Panic
} from 'wezi-types'
import { createContext, isWritableEnded, isProduction } from './utils'

const endHandler = (context: Context) => {
    context.res.statusCode = 404
    context.res.end()
}

const errorHandler = (context: Context, error: InternalError) => {
    const status = error.statusCode ?? 500
    const message = error.message || 'unknown'
    const payload = {
        message
    }
    if (isProduction()) {
        empty(context, status)
        return
    }
    json(context, payload, status)
}

const executeHandler = async (context: Context, handler: Handler, payload: unknown): Promise<void> => {
    if (isWritableEnded(context)) return
    try {
        const val = await handler(context, payload)
        if (val === null) {
            send(context, 204, val)
            return
        }

        if (val !== undefined) {
            send(context, context.res.statusCode, val)
        }
    } catch (err) {
        context.panic(err)
    }
}

const createNext = (context: Context, dispatch: Dispatch, inc: number): Next => {
    return function next(payload?: unknown): void {
        if (payload === undefined) {
            setImmediate(dispatch, context, inc)
            return
        }

        setImmediate(dispatch, context, inc, payload)
    }
}

const createPanic = (context: Context): Panic => {
    return function panic(error?: Error): void {
        if (error instanceof Error) {
            errorHandler(context, error)
            return
        }

        errorHandler(context, createError(500, 'panic error param, must be instance of Error'))
    }
}

export const composer = (main: boolean, ...handlers: Handler[]): Dispatch => {
    const len = handlers.length
    return function dispatch(context: Context, inc = 0, payload?: unknown): void {
        if (inc < len) {
            const handler = handlers[inc]
            const newContext = createContext(context, {
                next: createNext(context, dispatch, inc + 1)
                , panic: createPanic(context)
            })

            executeHandler(newContext, handler, payload)
            return
        }

        // end response if all higher-order handlers are executed, and none of them has ended the response.
        main && setImmediate(endHandler, context)
    }
}

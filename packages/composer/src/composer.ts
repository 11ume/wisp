import { createError } from 'wezi-error'
import {
    Next
    , Panic
    , Context
    , Handler
    , Dispatch
} from 'wezi-types'

export type Composer = (main: boolean, handlers: Handler[]) => Dispatch
export type ComposerSingle = (handler: Handler) => Dispatch

export type EndHandler = (context: Context, errorHandler: ErrorHandler) => void
export type ErrorHandler = (context: Context, error: Error) => void
export type ExecuteHandler = (context: Context, handler: Handler, payload: unknown | Promise<unknown>) => void

const createContext = (context: Context, dispatch: Dispatch, errorHandler: ErrorHandler) => {
    return {
        ...context
        , next: createNext(context, dispatch)
        , panic: createPanic(context, errorHandler)
    }
}

const createNext = (context: Context, dispatch: Dispatch): Next => {
    return function next(payload?: unknown): void {
        if (payload === undefined) {
            dispatch(context)
            return
        }

        dispatch(context, payload)
    }
}

const createPanic = (context: Context, errorHandler: ErrorHandler): Panic => {
    return function panic(error?: Error): void {
        if (error instanceof Error) {
            errorHandler(context, error)
            return
        }

        errorHandler(context, createError(500, 'panic error param, must be instance of Error'))
    }
}

const composer = (endHandler: EndHandler, errorHandler: ErrorHandler, executeHandler: ExecuteHandler): Composer => (main: boolean, handlers: Handler[]): Dispatch => {
    const len = handlers.length
    let inc = 0
    return function dispatch(context: Context, payload?: unknown): void {
        if (inc < len) {
            const handler = handlers[inc++]
            const newContext = createContext(context, dispatch, errorHandler)
            setImmediate(executeHandler, newContext, handler, payload)
            return
        }

        main && setImmediate(endHandler, context, errorHandler)
    }
}

const composerSingle = (errorHandler: ErrorHandler, executeHandler: ExecuteHandler): ComposerSingle => (handler: Handler): Dispatch => {
    return function dispatch(context: Context, payload?: unknown): void {
        const newContext = createContext(context, dispatch, errorHandler)
        setImmediate(executeHandler, newContext, handler, payload)
    }
}

export const create = (endHandler: EndHandler, errorHandler: ErrorHandler, executeHandler: ExecuteHandler) => {
    return composer(endHandler, errorHandler, executeHandler)
}

export const createSigle = (errorHandler: ErrorHandler, executeHandler: ExecuteHandler) => {
    return composerSingle(errorHandler, executeHandler)
}
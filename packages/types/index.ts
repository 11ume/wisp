import { IncomingMessage, ServerResponse } from 'http'

export type ErrorHandler = (context: Context, error: Error) => void
export interface Context {
    readonly req: IncomingMessage
    readonly res: ServerResponse
    readonly next: Next
    readonly errorHandler: ErrorHandler
}

export type Next = <T>(payload?: T) => void
export type Handler = (context: Context, payload?: any) => any

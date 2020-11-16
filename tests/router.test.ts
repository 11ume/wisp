import test from 'ava'
import fetch from 'node-fetch'
import createError from '../packages/error'
import * as receive from '../packages/receive'
import router, {
    ContextRoute
    , ContextRouteWild
    , routes
    , get
    , head
    , post
    , put
    , del
} from '../packages/router'
import { server } from './helpers'

test('base path', async (t) => {
    const greet = () => 'hello'
    const r = router(get('/', greet))
    const url = await server(r())
    const res = await fetch(url)
    const body = await res.text()

    t.is(body, 'hello')
})

test('not found', async (t) => {
    const foo = () => 'foo'
    const bar = () => 'bar'
    const notFound = (c: ContextRoute) => c.next(createError(404))
    const r = router(get('/foo', foo), get('/bar', bar))
    const url = await server(r(), notFound)
    const res = await fetch(url)
    const body: { message: string } = await res.json()

    t.is(body.message, 'Not Found')
    t.is(res.status, 404)
})

test('pattern match /(.*)', async (t) => {
    const greet = () => 'hello'
    const r = router(get('*', greet))
    const url = await server(r())
    const res = await fetch(url)
    const resTwo = await fetch(url)
    const body = await res.text()
    const bodyTwo = await resTwo.text()

    t.is(res.status, 200)
    t.is(body, 'hello')
    t.is(resTwo.status, 200)
    t.is(bodyTwo, 'hello')
})

test('different routes whit static paths diferent methods (CRUD)', async (t) => {
    type User = {
        id: string
    }

    const responses = {
        getAll: [1, 2, 3]
        , create: {
            action: 'create'
        }
        , update: {
            action: 'update'
        }
        , delete: {
            action: 'delete'
        }
    }

    const r = router(
        get('/users', () => responses.getAll)
        , get('/users/:id', (context: ContextRoute<User>) => context.params.id)
        , post('/users', () => responses.create)
        , put('/users', () => responses.update)
        , del('/users', () => responses.delete)
    )

    const url = await server(r())
    const getAll = await fetch(`${url}/users`)
    const getById = await fetch(`${url}/users/1`)
    const create = await fetch(`${url}/users`, {
        method: 'post'
    })
    const update = await fetch(`${url}/users`, {
        method: 'put'
    })
    const daleteOne = await fetch(`${url}/users`, {
        method: 'delete'
    })

    const bAll = await getAll.json()
    const bById = await getById.text()
    const bCreaste = await create.json()
    const bUpdate = await update.json()
    const bDelete = await daleteOne.json()

    t.deepEqual(bAll, responses.getAll)
    t.is(bById, '1')
    t.deepEqual(bCreaste, responses.create)
    t.deepEqual(bUpdate, responses.update)
    t.deepEqual(bDelete, responses.delete)
})

test('different routes whit static paths, method get', async (t) => {
    const r = router(
        get('/foo', () => ({
            name: 'foo'
        }))
        , get('/bar', () => ({
            name: 'bar'
        }))
    )

    const url = await server(r())
    const fooGet = await fetch(`${url}/foo`)
    const barGet = await fetch(`${url}/bar`)

    const bodyFoo = await fooGet.json()
    const bodyBar = await barGet.json()

    t.is(bodyFoo.name, 'foo')
    t.is(bodyBar.name, 'bar')
})

test('different routes whit return null', async (t) => {
    const r = router(
        get('/foo', () => null)
    )

    const url = await server(r())
    const res = await fetch(`${url}/foo`)
    const body = await res.text()

    t.is(res.status, 204)
    t.falsy(body)
})

test('routes with params and query', async (t) => {
    const greet = (context: ContextRoute<{ msg: string }, { time: number }>) => `Hello ${context.params.msg} ${context.query.time}`
    const r = router(get('/hello/:msg', greet))
    const url = await server(r())
    const res = await fetch(`${url}/hello/world?time=now`)
    const body = await res.text()

    t.is(body, 'Hello world now')
})

test('routes with multi params', async (t) => {
    const greet = (context: ContextRoute<{ foo: string, bar: string }>) => `${context.params.foo} ${context.params.bar}`
    const r = router(get('/hello/:foo/:bar', greet))
    const url = await server(r())
    const res = await fetch(`${url}/hello/foo/bar`)
    const body = await res.text()

    t.is(body, 'foo bar')
})

test('routes with matching optional param', async (t) => {
    const greet = (context: ContextRoute<{ msg: string }>) => `Hello ${context.params.msg ?? ''}`
    const r = router(get('/path/:msg?', greet))
    const url = await server(r())
    const res = await fetch(`${url}/path`)
    const resOptional = await fetch(`${url}/path/world`)
    const body = await res.text()
    const bodyOptional = await resOptional.text()

    t.is(body, 'Hello ')
    t.is(bodyOptional, 'Hello world')
})

test('routes with matching double optional params', async (t) => {
    const hello = (context: ContextRoute<{ foo?: string, bar?: string }>) => {
        if (context.params.foo && context.params.bar) return `Hello ${context.params.foo} ${context.params.bar}`
        else if (context.params.foo) return `Hello ${context.params.foo}`
        else return 'Hello'
    }

    const r = router(get('/path/:foo?/:bar?', hello))
    const url = await server(r())
    const res = await fetch(`${url}/path`)
    const resOptional = await fetch(`${url}/path/john`)
    const resOptionalWhitTwo = await fetch(`${url}/path/john/connor`)

    const body = await res.text()
    const bodyOptional = await resOptional.text()
    const bodyOptionalWhitTwo = await resOptionalWhitTwo.text()

    t.is(body, 'Hello')
    t.is(bodyOptional, 'Hello john')
    t.is(bodyOptionalWhitTwo, 'Hello john connor')
})

test('routes with matching params last optional only', async (t) => {
    const hello = (context: ContextRoute<{ foo: string, bar?: string }>) => {
        if (context.params.bar) return `Hello ${context.params.foo} ${context.params.bar}`
        else return `Hello ${context.params.foo}`
    }

    const r = router(get('/path/:foo/:bar?', hello))
    const url = await server(r())
    const resOptional = await fetch(`${url}/path/john`)
    const resOptionalWhitLast = await fetch(`${url}/path/john/connor`)

    const bodyOptional = await resOptional.text()
    const bodyOptionalWhitLast = await resOptionalWhitLast.text()

    t.is(bodyOptional, 'Hello john')
    t.is(bodyOptionalWhitLast, 'Hello john connor')
})

test('routes with matching params first optional only', async (t) => {
    const hello = (context: ContextRoute<{ foo?: string, bar: string }>) => {
        if (context.params.foo) return `Hello ${context.params.foo} ${context.params.bar}`
        else return `Hello ${context.params.bar}`
    }

    const r = router(get('/path/:foo?/:bar', hello))
    const url = await server(r())
    const resOptional = await fetch(`${url}/path/john`)
    const resOptionalFirst = await fetch(`${url}/path/connor`)
    const resOptionalAll = await fetch(`${url}/path/john/connor`)

    const bodyOptional = await resOptional.text()
    const bodyOptionalAll = await resOptionalAll.text()
    const bodyOptionalFirst = await resOptionalFirst.text()

    t.is(bodyOptional, 'Hello john')
    t.is(bodyOptionalAll, 'Hello john connor')
    t.is(bodyOptionalFirst, 'Hello connor')
})

test('multiple matching routes', async (t) => {
    const withPath = () => 'Hello world'
    const withParam = () => t.fail('Clashing route should not have been called')

    const r = router(get('/path', withPath), get('/:param', withParam))
    const url = await server(r())
    const res = await fetch(`${url}/path`)
    const body = await res.text()

    t.is(body, 'Hello world')
})

test('routes with namespace', async (t) => {
    const v1 = routes(get('/test', () => 'foo'))
    const v2 = routes(get('/test', () => 'bar'))

    const r1 = router(v1)
    const r2 = router(v2)

    const url = await server(r1('/v1'), r2('/v2'))
    const fooGet = await fetch(`${url}/v1/test`)
    const barGet = await fetch(`${url}/v2/test`)
    const bodyFoo = await fooGet.text()
    const bodyBar = await barGet.text()

    t.is(bodyFoo, 'foo')
    t.is(bodyBar, 'bar')
})

test('match head, match route and return empty body', async (t) => {
    const ping = () => 'hello'
    const r = router(head('/hello', ping))
    const url = await server(r())
    const res = await fetch(`${url}/hello`, {
        method: 'head'
    })
    const body = await res.blob()

    t.is(body.size, 0)
    t.is(res.status, 200)
})

test('multiple matching routes match whit wildcards', async (t) => {
    const getChar = (context: ContextRouteWild) => context.params.wild
    const r = router(get('/character/*', getChar))
    const url = await server(r())
    const res = await fetch(`${url}/character/john/connor`)
    const body = await res.text()

    t.is(body, 'john/connor')
})

test('multiple routes handlers', async (t) => {
    const checkChar = (context: ContextRoute<{ name: string }>) => {
        if (context.params.name !== 'john') throw createError(400, 'Bad request')
        context.next()
    }
    const getChar = (context: ContextRoute<{ name: string }>) => context.params.name
    const r = router(get('/character/:name', checkChar, getChar))
    const url = await server(r())
    const res = await fetch(`${url}/character/john`)
    const body = await res.text()

    t.is(body, 'john')
})

test('multiple routes handlers fail next', async (t) => {
    const checkChar = async (context: ContextRoute) => {
        const char = await receive.json<{ name?: string, power?: string }>(context)
        if (char.name && char.power) context.next()
        else throw createError(400, 'Bad request')
    }
    const getChar = () => null
    const r = router(post('/character', checkChar, getChar))
    const url = await server(r())
    const res = await fetch(`${url}/character`, {
        method: 'post'
        , body: JSON.stringify({
            name: 't800'
        })
    })
    t.is(res.status, 400)
})

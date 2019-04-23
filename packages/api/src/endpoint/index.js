import { Router } from 'express'
import schema from './schema.json'
import Ajv from 'ajv'
import uuid from 'uuid/v4'
import { generateStreamKey } from '../util'

const ajv = new Ajv()
const validate = ajv.compile(schema)

const router = Router()

router.get('/', async (req, res) => {
  const output = await req.store.list()
  res.status(200)
  res.json(output)
})

router.get('/:id', async (req, res) => {
  const { id } = req.params
  let data
  try {
    data = await req.store.get(id)
  } catch (err) {
    if (err.type === 'NotFoundError') {
      res.status(404)
      return res.json({ errors: ['Not found'] })
    }
    throw err
  }
  res.status(200)
  res.json(data)
})

router.post('/', async (req, res) => {
  const { body } = req

  if (body.id || body.streamKey || body.key) {
    res.status(422)
    return res.json({
      errors: ['id, key, and streamKey are generated by the server'],
    })
  }

  const id = uuid()
  const key = await generateStreamKey()

  const data = {
    id,
    key,
    streamKey: `${id}?key=${key}`,
    ...body,
  }

  const valid = validate(data)
  if (!valid) {
    res.status(422)
    return res.json({
      errors: validate.errors.map(({ message }) => message),
    })
  }

  await req.store.create(data.id, data)

  res.status(201)
  res.json(data)
})

router.put('/:id', async (req, res) => {
  const data = req.body

  if (data.id !== req.params.id) {
    res.status(409)
    return res.json({ errors: ['id in URL and body must match'] })
  }

  const valid = validate(data)
  if (!valid) {
    res.status(422)
    return res.json({
      errors: validate.errors.map(({ message }) => message),
    })
  }

  try {
    await req.store.replace(data.id, data)
  } catch (err) {
    if (err.type === 'NotFoundError') {
      res.status(404)
      return res.json({ errors: ['Not found'] })
    }
    throw err
  }
  res.status(200)
  res.json(data)
})

router.delete('/:id', async (req, res) => {
  try {
    await req.store.delete(req.params.id)
  } catch (err) {
    if (err.type === 'NotFoundError') {
      res.status(404)
      return res.json({ errors: ['Not found'] })
    }
    throw err
  }
  res.sendStatus(204)
})

export default router

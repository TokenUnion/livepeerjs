import { parse as parseUrl } from 'url'
import { Parser } from 'm3u8-parser'
import path from 'path'

// TODO HACK: This is an on-purpose memory leak. Let's figure out how to scope this, hmm?
const cachedSizes = new Map()

/**
 * Rather hacky function to download all segments of a stream and return their bitrates. Powers
 * the bitrate chart on the demo page.
 */
export default async function scrapeStream(url) {
  const { playlists } = await fetchManifest(url)

  const output = playlists.map(playlist => ({
    resolution: playlist.attributes.RESOLUTION,
    segments: [],
  }))

  const manifests = await Promise.all(
    playlists.map(p => resolvePath(url, p.uri)).map(fetchManifest),
  )

  for (const [i, manifest] of Object.entries(manifests)) {
    for (const { uri, duration } of manifest.segments) {
      const size = await getResponseSize(resolvePath(url, uri))
      output[i].segments.push({ uri, size, duration })
    }
  }

  // Sort biggest to smallest resolutions
  return output.sort(
    (a, b) =>
      b.resolution.width * b.resolution.height -
      a.resolution.width * a.resolution.height,
  )
}

// Takes the start url and relative path, returns the correct absolute URL
export const resolvePath = (startUrl, newPath) => {
  const { protocol, host, pathname } = parseUrl(startUrl)
  const finalPath = path.resolve(pathname, '..', newPath)
  return `${protocol}//${host}${finalPath}`
}

// Wrapper around m3u8-parser's verbose-ass interface
export const fetchManifest = async url => {
  const res = await fetch(url)
  const text = await res.text()
  const parser = new Parser()
  parser.push(text)
  parser.end()
  return parser.manifest
}

// Get the size of a file. Streams the file in to save memory.
async function getResponseSize(url) {
  if (cachedSizes.has(url)) {
    return cachedSizes.get(url)
  }
  const response = await fetch(url)
  const reader = response.body.getReader()
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    total += value.length
  }
  cachedSizes.set(url, total)
  return total
}
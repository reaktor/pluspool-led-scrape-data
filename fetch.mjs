import { ENDPOINTS, STREAMS } from './constants.mjs'
import { get } from 'datagarrison'

const parseJson = (response) => {
  if (response.ok) return response.json()
  throw new Error(`Request rejected with status ${response.status}`)
}

const throwJsonErrors = (json) => {
  if (json.error && json.error.message) throw new Error(json.error.message)
  return json
}

const mapTimeDataToGMT = (json) => ({
  ...json,
  source,
  data: json.data?.map(datum => ({ ...datum, t: `${datum.t} GMT` }))
})

export const fetchNoaaData = () => {
  console.log('Fetching NOAA data')
  const { url, query } = ENDPOINTS.noaaCurrent
  const source = new URL(url)
  url.search = new URLSearchParams(query)

  return fetch(source, { method: 'GET' })
    .then(parseJson)
    .then(throwJsonErrors)
    .then(mapTimeDataToGMT)
}

export const fetchPier17Data = () => {
  console.log('Fetching Pier 17 data')
  return get(STREAMS.pier17)
}

export const fetchCentralParkData = () => {
  console.log('Fetching Central Park data')
  return get(STREAMS.centralPark)
}

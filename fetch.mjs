import { ENDPOINTS, STREAMS } from './constants.mjs'
import fetch from 'isomorphic-unfetch'
import { get } from 'datagarrison'
import { encode } from 'querystring'

export const fetchNoaaData = () => {
  console.log('Fetching NOAA data')
  const { url, query } = ENDPOINTS.noaaCurrent
  const source = `${url}?${encode(query)}`

  return fetch(source, { method: 'GET' })
    .then(response => {
      if (response.ok) return response.json()
      throw new Error(`Request rejected with status ${response.status}`)
    })
    .then(json => {
      if (json.error && json.error.message) throw new Error(json.error.message)
      return json
    })
    .then(json => ({
      ...json,
      source,
      data: json.data?.map(datum => ({ ...datum, t: `${datum.t} GMT` }))
    }))
}

export const fetchPier17Data = () => {
  console.log('Fetching Pier 17 data')
  return get(STREAMS.pier17)
}

export const fetchCentralParkData = () => {
  console.log('Fetching Central Park data')
  return get(STREAMS.centralPark)
}

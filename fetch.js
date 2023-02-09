const { ENDPOINTS, STREAMS } = require('./constants')
const fetch = require('isomorphic-unfetch')
const { get } = require('datagarrison')
const { encode } = require('querystring')

const fetchNoaaData = () => {
  console.log('Fetching NOAA data')
  const { url, query } = ENDPOINTS.noaaCurrent
  const source = `${url}?${encode(query)}`

  return fetch(source, {
    method: 'GET'
  }).then(response => {
    if (response.ok) {
      return response.json()
    }
    throw new Error(`Request rejected with status ${response.status}`)
  })
    .then(json => ({
      ...json,
      source,
      data: json.data?.map(datum => ({ ...datum, t: `${datum.t} GMT` }))
    }))
}

const fetchPier17Data = () => {
  console.log('Fetching Pier 17 data')
  return get(STREAMS.pier17)
}

const fetchCentralParkData = () => {
  console.log('Fetching Central Park data')
  return get(STREAMS.centralPark)
}

module.exports = {
  fetchNoaaData,
  fetchPier17Data,
  fetchCentralParkData
}

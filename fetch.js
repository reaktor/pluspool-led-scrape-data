const { ENDPOINTS, STREAMS } = require('./constants')
const fetch = require('isomorphic-unfetch')
const { get } = require('datagarrison')

const fetchNoaaData = () => {
  const source = ENDPOINTS.noaaCurrent
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
      data: json.data.map(datum => ({ ...datum, t: `${datum.t} GMT` }))
    }))
}

module.exports = {
  fetchNoaaData,
  fetchPier17Data: () => get(STREAMS.pier17),
  fetchCentralParkData: () => get(STREAMS.centralPark)
}

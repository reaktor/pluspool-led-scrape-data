const { ENDPOINTS, STREAMS } = require('./constants')
const fetch = require('isomorphic-unfetch')
const { get } = require('datagarrison')

const fetchNoaaData = () => {
  return fetch(ENDPOINTS.noaaCurrent, {
    method: 'GET'
  }).then(response => {
    if (response.ok) {
      return response.json()
    }
    throw new Error(`Request rejected with status ${response.status}`)
  })
}

module.exports = {
  fetchNoaaData,
  fetchPier17Data: () => get(STREAMS.pier17),
  fetchCentralParkData: () => get(STREAMS.centralPark)
}

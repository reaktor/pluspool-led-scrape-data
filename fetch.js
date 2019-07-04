const { ENDPOINTS } = require('./constants')
const fetch = require('isomorphic-unfetch')

const fetchStationData = () => {
  return fetch(ENDPOINTS.datagarrison).then(response => {
    if (response.ok) {
      return response.text()
    }
    throw new Error(`Request rejected with status ${response.status}`)
  })
}

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
  fetchStationData,
  fetchNoaaData
}

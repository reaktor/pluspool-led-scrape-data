const ENDPOINTS = {
  noaaCurrent: 'https://tidesandcurrents.noaa.gov/api/datagetter?range=2400&station=n03020&product=currents&units=english&time_zone=gmt&&format=json'
}

const STREAMS = {
  pier17: {
    user: 1105898,
    stream: 351579054854805
  },
  centralPark: {
    user: 1105898,
    stream: 356136071740874
  }
}
module.exports = {
  ENDPOINTS,
  STREAMS
}

const ENDPOINTS = {
  googleSheetId: '1DX2KE8NHpdEEO7ZwBEAjCc7BK1M43VoA',
  noaaCurrent: {
    url: 'https://tidesandcurrents.noaa.gov/api/prod/datagetter',
    query: {
      range: '2400',
      station: 'n06010',
      product: 'currents',
      units: 'english',
      time_zone: 'gmt',
      format: 'json',
    },
  },
};

const STREAMS = {
  pier17: {
    user: 1105898,
    stream: 351579054854409
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

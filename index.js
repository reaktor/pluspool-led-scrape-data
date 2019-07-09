const fs = require('fs')
const { fetchNoaaData, fetchPier17Data, fetchCentralParkData } = require('./fetch')
const { getSamples } = require('./data')

(async () => {
  const samples = await Promise.all([
    Promise.resolve(fetchNoaaData()),
    Promise.resolve(fetchPier17Data()),
    Promise.resolve(fetchCentralParkData())
  ])
    .then(([rawNoaaData, pier17Data, centralParkData]) => {
      return getSamples({ pier17Data, centralParkData, noaaData: rawNoaaData.data})
    })

  fs.writeFileSync('samples.json', JSON.stringify(samples, null, 2))
})()

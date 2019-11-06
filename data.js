/**
 * getSamples returns an array of samples
 * @param {Object} noaaData - raw noaaData
 * @param {Object} pier17Data - raw pier17Data
 * @param {Object} stationData - raw stationData
 *
 * @returns {Object} Array of samples
 */

const pkg = require('./package.json')
const rainToBacteria = require('@jedahan/predicted-mpn')
const Database = require('better-sqlite3')
const moment = require('moment')
const db = new Database('database.db', {
  // verbose: console.log
})

const maps = {
  noaaData: {
    noaaTime: 't',
    speed: 's',
    direction: 'd'
  },
  pier17Data: {
    pier17Time: 'Date_Time',
    oxygen: 'oxygen_conc_SDI_0_11_mg/L',
    salinity: 'Salinity_SDI_0_4_ppt',
    turbidity: 'Turbidity_SDI_0_8_NTU',
    ph: 'pH_SDI_0_6_H+',
    depth: 'depth_SDI_0_5_m',
    temperature: 'water temperature_SDI_0_2_F'
  },
  centralParkData: {
    centralParkTime: 'Date_Time',
    rain: 'Rain_10680977_in'
  },
  columbia: {
    bacteria: 'bacteria'
  }
}

const units = {
  noaaTime: 'unix',
  speed: 'KN',
  direction: 'degrees',
  pier17Time: 'unix',
  oxygen: 'mg/L',
  salinity: 'PPT',
  turbidity: 'NTU',
  ph: 'H+',
  depth: 'm',
  temperature: 'F',
  centralParkTime: 'unix',
  rain: 'in',
  bacteria: 'MPN'
}

const setupDb = () => {
  db.prepare(`CREATE TABLE IF NOT EXISTS noaaData(${Object.keys(maps.noaaData).join(' NUMERIC, ')})`).run()
  db.prepare(`CREATE TABLE IF NOT EXISTS pier17Data(${Object.keys(maps.pier17Data).join(' NUMERIC, ')})`).run()
  db.prepare(`CREATE TABLE IF NOT EXISTS centralParkData(${Object.keys(maps.centralParkData).join(' NUMERIC, ')})`).run()
}

const storeData = (tableName, data) => {
  const keys = Object.keys(maps[tableName])
  const lastEntry = db.prepare(`SELECT * FROM "${tableName}" ORDER BY "${keys[0]}" DESC`).get()
  const insert = db.prepare(`INSERT INTO "${tableName}"(${keys.join(', ')}) VALUES(@${keys.join(',@')})`)
  const insertMany = db.transaction((entries) => {
    for (const entry of entries) insert.run(entry)
  })
  insertMany(data.filter(row => lastEntry == null || Date.parse(row[keys[0]]) > lastEntry[keys[0]]))
}

const getSource = (key, sourcemap) => {
  if (key === 'bacteria') return 'https://www.ldeo.columbia.edu/user/mcgillis'

  for (const [sourcename, map] of Object.entries(maps)) {
    if (Object.keys(map).includes(key)) return sourcemap[sourcename]
  }

  return null
}

// Select and rename an object with a map from another object
const select = (source, map) => Object.assign(...Object.entries(map).map(([to, name]) => ({
  [to]: parseFloat(source[name])
})))

const storeRawData = (sources) => {
  setupDb()
  console.log('store data to DB')

  const noaaData = sources.noaaData.data
    .map(sample => select(sample, maps.noaaData))
    .map(entry => {
      entry.noaaTime = Date.parse(entry.noaaTime)
      return entry
    })
  storeData('noaaData', noaaData)

  const pier17Data = sources.pier17Data.samples
    .map(sample => {
      var s = {}
      sources.pier17Data.header.map((header, i) => {
        s[header] = sample[i]
      })
      return select(s, maps.pier17Data)
    })
    .slice(0, -1)

  storeData('pier17Data', pier17Data)

  const centralParkData = sources.centralParkData.samples
    .map(sample => {
      var s = {}
      sources.centralParkData.header.map((header, i) => {
        s[header] = sample[i]
      })
      return select(s, maps.centralParkData)
    })
    .slice(0, -1) // removal of invalid source entry

  storeData('centralParkData', centralParkData)
}

const getDataSets = (versions = 'all') => {
  return getYear()
}

const getYear = () => {
  // 240 samples per day if stored data points are every 6 minutes
  // so average every 120 entries to get 2 samples per day evenly spaced
  // pier17Data is at an interval of 15 minutes
  const nthEntry = 120

  const results = db.prepare('SELECT * FROM  "noaaData" WHERE "noaaTime" > ? ORDER BY "noaaTime" DESC').all(`${moment().subtract(1, 'years').unix()}`)
  const sampleCount = results.length / nthEntry
  console.log(sampleCount)
}

const getSamples = ({
  noaaData,
  pier17Data,
  centralParkData
}) => {
  console.log('Converting fetched data to samples')
  const sourcemap = {
    noaaData: 'https://tidesandcurrents.noaa.gov/cdata/DataPlot?id=n03020&bin=0&unit=1&timeZone=UTC&view=data',
    pier17Data: pier17Data.source,
    centralParkData: centralParkData.source,
    columbia: 'https://www.ldeo.columbia.edu/user/mcgillis'
  }

  const start = Math.max(
    Date.parse(noaaData.data[0].t),
    pier17Data.samples[0][0],
    centralParkData.samples[0][0]
  )
  const end = Math.min(
    Date.parse(noaaData.data[noaaData.data.length - 1].t),
    pier17Data.samples[pier17Data.samples.length - 2][0],
    centralParkData.samples[centralParkData.samples.length - 2][0]
  )

  const startIndex = noaaData.data.findIndex(sample => Date.parse(sample.t) >= start)
  const reverseNoaaData = noaaData.data.slice().reverse()
  const endIndex = reverseNoaaData.length - reverseNoaaData.findIndex(sample => Date.parse(sample.t) <= end)

  const samples = noaaData.data.slice(startIndex, endIndex)
    .map(sample => {
      const noaaSample = sample
      return {
        ...select(noaaSample, maps.noaaData),
        noaaTime: Date.parse(noaaSample.t)
      }
    })
    .map(sample => {
      const pier17Sample = deriveSample({
        stationData: pier17Data,
        timestamp: sample.noaaTime
      })
      return {
        ...sample,
        ...select(pier17Sample, maps.pier17Data),
        pier17Time: parseInt(pier17Sample.Date_Time)
      }
    })
    .map(sample => {
      const centralParkSample = deriveSample({
        stationData: centralParkData,
        timestamp: sample.noaaTime
      })

      return {
        ...sample,
        ...select(centralParkSample, maps.centralParkData),
        centralParkTime: parseInt(centralParkSample.Date_Time)
      }
    })

  const bacteria = rainToBacteria(samples.map(({
    rain
  }) => rain))
  const samplesWithBacteria = samples.map((sample, index) => ({
    ...sample,
    bacteria: bacteria[index]
  }))

  const allKeys = [...new Set(...samplesWithBacteria.map(Object.keys))]
  const sources = Object.assign({}, ...allKeys.map(key => ({
    [key]: getSource(key, sourcemap)
  })))

  console.log('Converting samples complete')

  return {
    version: pkg.version,
    date: new Date(),
    envName: process.env.ENV_NAME || 'undefined',
    sources: sources,
    units: units,
    samples: samplesWithBacteria
  }
}

/**
 *
 * @param {Object} stationData - Data retrieved from the Datagarrison weather station.
 * @param {Array} stationData.header - A list of labels for each column of data.
 * @param {Array} stationData.samples - The data samples.
 * @param {Date} timestamp - timestamp to get data
 * @returns {Object} A sample of data.
 */
const deriveSample = ({
  stationData,
  timestamp
}) => {
  if (!timestamp || !stationData || !stationData.samples) return {}

  const index = stationData.samples.findIndex(
    sample => sample[0] > timestamp
  ) - 1

  const sample = stationData.samples[index]

  if (!sample) return {}

  return stationData.header.reduce((acc, column, i) => {
    acc[column] = sample[i]
    return acc
  }, {})
}

module.exports = {
  storeRawData,
  getDataSets,
  getSamples,
  maps
}

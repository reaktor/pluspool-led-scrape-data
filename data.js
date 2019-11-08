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
const R = require('ramda')
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
  db.prepare('CREATE TABLE IF NOT EXISTS noaa(timestamp NUMERIC, speed NUMERIC, direction NUMERIC)').run()
  db.prepare('CREATE TABLE IF NOT EXISTS pier17(timestamp NUMERIC, oxygen NUMERIC, salinity NUMERIC, turbidity NUMERIC, ph NUMERIC, depth NUMERIC, temperature NUMERIC)').run()
  db.prepare('CREATE TABLE IF NOT EXISTS centralPark(timestamp NUMERIC, rain NUMERIC)').run()
}

const storeData = (tableName, data) => {
  const keys = Object.keys(maps[`${tableName}Data`])
  const keysFiltered = Object.keys(maps[`${tableName}Data`]).filter(key => !['noaaTime', 'pier17Time', 'centralParkTime'].includes(key))
  const lastEntry = db.prepare(`SELECT * FROM "${tableName}" ORDER BY "timestamp" DESC`).get()
  const insert = db.prepare(`INSERT INTO "${tableName}"(timestamp, ${keysFiltered.join(', ')}) VALUES(@${keys.join(',@')})`)
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
    .map(entry => {
      return {
        noaaTime: Date.parse(entry.t),
        speed: entry.s,
        direction: entry.d
      }
    })
  storeData('noaa', noaaData)

  const pier17Data = sources.pier17Data.samples
    .map(sample => {
      var s = {}
      sources.pier17Data.header.map((header, i) => {
        s[header] = sample[i]
      })
      return select(s, maps.pier17Data)
    })
    .slice(0, -1)

  storeData('pier17', pier17Data)

  const centralParkData = sources.centralParkData.samples
    .map(sample => {
      var s = {}
      sources.centralParkData.header.map((header, i) => {
        s[header] = sample[i]
      })
      return select(s, maps.centralParkData)
    })
    .slice(0, -1) // removal of invalid source entry

  storeData('centralPark', centralParkData)
}

const getDataSets = () => {
  return {
    year: getSampleRange({
      tables: ['noaa', 'pier17', 'centralPark'],
      samplesPerDay: 2,
      days: 365
    }),
    month: getSampleRange({
      tables: ['noaa', 'pier17', 'centralPark'],
      samplesPerDay: 4,
      days: 30
    }),
    day: getSampleRange({
      tables: ['noaa', 'pier17', 'centralPark'],
      samplesPerDay: 1,
      days: 2
    }),
    units: units
  }
}
const getSampleRange = ({
  tables,
  ...other
}) => {
  const samples = {}
  tables.forEach(table => {
    const downsampledData = getDownsampledData({
      tableName: table,
      ...other
    })
    samples[`${table}Samples`] = downsampledData
    if (table === 'centralPark') {
      const bacteria = rainToBacteria(downsampledData.map(({
        rain
      }) => rain))
      samples[`${table}Samples`].map((sample, i) => {
        sample.bacteria = bacteria[i]
        return sample
      })
    }
  })
  return samples
}

const getDownsampledData = ({
  tableName,
  samplesPerDay,
  days
}) => {
  let downsampled = []
  R.range(1, days).reverse().map(day => {
    const results = db.prepare(`SELECT * FROM  "${tableName}" WHERE "timestamp" > ? ORDER BY "timestamp" DESC`).all(`${moment().subtract(day, 'days').unix()}`)
    const samplesPerDayIndex = Math.floor(results.length / samplesPerDay)
    const splittedResults = R.splitEvery(samplesPerDayIndex, results)
    const averagedResults = splittedResults.map(samples => {
      const averagedResult = {}
      Object.keys(samples[0]).forEach(key => {
        averagedResult[key] = R.mean(samples.map(R.prop(key)))
      })
      return averagedResult
    })
    downsampled = downsampled.concat(averagedResults)
  })
  return downsampled
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

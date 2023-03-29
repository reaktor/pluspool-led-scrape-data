/**
 * getSamples returns an array of samples
 * @param {Object} noaaData - raw noaaData
 * @param {Object} pier17Data - raw pier17Data
 * @param {Object} stationData - raw stationData
 *
 * @returns {Object} Array of samples
 */

import packageJson from './package.json' assert { type: "json" }
const { version } = packageJson

import rainToBacteria from '@reaktor/predicted-mpn'

import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

import moment from 'moment'
import { range, splitEvery, mean, prop } from 'ramda'

const db = await open({ filename: ':memory:', driver: sqlite3.Database })

export const maps = {
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
    rain: 'Rain_10680977_in',
    bacteria: 'bacteria'
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

const createTables = async () => {
  const create = [{
    table: 'CREATE TABLE IF NOT EXISTS noaa(timestamp NUMERIC, speed NUMERIC, direction NUMERIC)',
    index: 'CREATE INDEX IF NOT EXISTS "noaa_timestamp" ON noaa(timestamp)'
  }, {
    table: 'CREATE TABLE IF NOT EXISTS pier17(timestamp NUMERIC, oxygen NUMERIC, salinity NUMERIC, turbidity NUMERIC, ph NUMERIC, depth NUMERIC, temperature NUMERIC)',
    index: 'CREATE INDEX IF NOT EXISTS "pier17_timestamp" ON pier17(timestamp)'
  }, {
    table: 'CREATE TABLE IF NOT EXISTS centralPark(timestamp NUMERIC, rain NUMERIC, bacteria NUMERIC)',
    index: 'CREATE INDEX IF NOT EXISTS "centralPark_timestamp" ON centralPark(timestamp)',
  }]

  await Promise.all(create.map(({ table, index }) => db.run(table).then(() => db.run(index))))
}

const storeData = async (tableName, data) => {
  const keys = Object.keys(maps[`${tableName}Data`])
  const keyIsNotTimestamp = key => !['noaaTime', 'pier17Time', 'centralParkTime'].includes(key)

  const keysWithoutTimestamp = keys.filter(keyIsNotTimestamp)

  const lastEntry = await db.get(`SELECT * FROM ? ORDER BY "timestamp" DESC`, tableName)

  const insert = await db.prepare(
    `INSERT INTO ?(timestamp, ?}) VALUES(@?)`,
    tableName,
    keysWithoutTimestamp.join(', '),
    keys.join(',@'),
  )

  // TODO: batch insert
  const entries = data.filter(row => lastEntry == null || Date.parse(row[keys[0]]) > lastEntry.timestamp)

  entries.forEach(entry => insert.run(entry))

}

const getSource = (key, sourcemap) => {
  if (key === 'bacteria') return 'https://scholar.google.com/citations?hl=en&user=POJ0vZ8AAAAJ&view_op=list_works&sortby=pubdate'

  for (const [sourcename, map] of Object.entries(maps)) {
    if (Object.keys(map).includes(key)) return sourcemap[sourcename]
  }

  return null
}

// Select and rename an object with a map from another object
const select = (source, map) =>
  Object.assign(
    ...Object.entries(map).map(([to, name]) => ({
      [to]: parseFloat(source[name])
    }))
  )

export const storeRawData = async sources => {
  await createTables()

  const noaaData = sources.noaaData.data?.map(entry => {
    return {
      noaaTime: Date.parse(entry.t) / 1000,
      speed: entry.s,
      direction: entry.d
    }
  })
  storeData('noaa', noaaData)

  const pier17Data = sources.pier17Data.samples
    .map(sample => {
      const s = {}
      sources.pier17Data.header.forEach((header, i) => {
        s[header] = header === 'Date_Time' ? sample[i] / 1000 : sample[i]
      })
      return select(s, maps.pier17Data)
    })
    .slice(0, -1)

  storeData('pier17', pier17Data)

  const centralParkData = sources.centralParkData.samples
    .map(sample => {
      const s = {}
      sources.centralParkData.header.forEach((header, i) => {
        s[header] = header === 'Date_Time' ? sample[i] / 1000 : sample[i]
      })
      return select(s, maps.centralParkData)
    })
    .slice(0, -1) // removal of invalid source entry

  const bacteria = rainToBacteria(centralParkData.map(({ rain }) => rain))
  centralParkData.map((sample, i) => {
    sample.bacteria = bacteria[i]
    return sample
  })
  storeData('centralPark', centralParkData)
}

export const getDataSets = async () => {
  return {
    year: await getSampleRange({
      name: 'year',
      tables: ['noaa', 'pier17', 'centralPark'],
      samplesPerDay: 2,
      days: 365
    }),
    month: await getSampleRange({
      name: 'month',
      tables: ['noaa', 'pier17', 'centralPark'],
      samplesPerDay: 4,
      days: 30
    }),
    week: await getSampleRange({
      name: 'week',
      tables: ['noaa', 'pier17', 'centralPark'],
      samplesPerDay: 8,
      days: 7
    }),
    day: await getSampleRange({
      name: 'day',
      tables: ['noaa', 'pier17', 'centralPark'],
      samplesPerDay: 96,
      days: 1
    })
  }
}

const getSampleRange = async ({ tables, name, ...other }) => {
  const samples = {
    units,
    name
  }

  for (const tableName of tables) {
    const downsampledData = await getDownsampledData({
      tableName,
      ...other
    })
    samples[`${tableName}Samples`] = downsampledData
  }
  return samples
}

const getDownsampledData = async ({ tableName, samplesPerDay, days }) => {
  let downsampled = []

  const query = 'SELECT * FROM $tableName WHERE timestamp > $startDay AND timestamp < $endDay ORDER BY timestamp DESC;'

  for (const day of range(0, days).reverse()) {
    const $startDay = moment().subtract(day + 1, 'days').unix()
    const $endDay = moment().subtract(day, 'days').unix()
    console.log({query})
    const results = await db.all(query, {$tableName: tableName, $startDay, $endDay})
    console.log({result})

    if (results.length === 0) return // skip if ther is no data for that day
    const samplesPerDayIndex = Math.floor(results.length / samplesPerDay)
    if (samplesPerDayIndex === 0) { // not enough samples for the desired sample rate
      downsampled = downsampled.concat(results) // could also try a lower sample rate if this seems to be too much
    }
    const splittedResults = samplesPerDayIndex > 0 ? splitEvery(samplesPerDayIndex, results) : [results]
    const averagedResults = splittedResults.map(samples => {
      const averagedResult = {}
      Object.keys(samples[0]).forEach(key => {
        averagedResult[key] = mean(samples.map(prop(key)))
      })
      averagedResult.timestamp = samples[0].timestamp
      return averagedResult
    })
    downsampled = downsampled.concat(averagedResults)
  }

  return downsampled
}

export const getSamples = ({ noaaData, pier17Data, centralParkData }) => {
  console.log('Converting fetched data to samples')
  const sourcemap = {
    noaaData:
      'https://tidesandcurrents.noaa.gov/cdata/DataPlot?id=n03020&bin=0&unit=1&timeZone=UTC&view=data',
    pier17Data: pier17Data.source,
    centralParkData: centralParkData.source,
    columbia: 'https://www.ldeo.columbia.edu/user/mcgillis'
  }

  const start = Math.max(
    Date.parse(noaaData.data?.[0].t),
    pier17Data.samples[0][0],
    centralParkData.samples[0][0]
  )
  const end = Math.min(
    Date.parse(noaaData.data?.[noaaData.data.length - 1].t),
    pier17Data.samples[pier17Data.samples.length - 2][0],
    centralParkData.samples[centralParkData.samples.length - 2][0]
  )

  const startIndex = noaaData.data?.findIndex(
    sample => Date.parse(sample.t) >= start
  )
  const reverseNoaaData = noaaData.data.slice().reverse()
  const endIndex =
    reverseNoaaData.length -
    reverseNoaaData.findIndex(sample => Date.parse(sample.t) <= end)

  const samples = noaaData.data
    .slice(startIndex, endIndex)
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

  const bacteria = rainToBacteria(samples.map(({ rain }) => rain))
  const samplesWithBacteria = samples.map((sample, index) => ({
    ...sample,
    bacteria: bacteria[index]
  }))

  const allKeys = [...new Set(...samplesWithBacteria.map(Object.keys))]
  const sources = Object.assign(
    {},
    ...allKeys.map(key => ({
      [key]: getSource(key, sourcemap)
    }))
  )

  console.log('Converting samples complete')

  return {
    version,
    date: new Date(),
    sources,
    units,
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
const deriveSample = ({ stationData, timestamp }) => {
  if (!timestamp || !stationData || !stationData.samples) return {}

  const index =
    stationData.samples.findIndex(sample => sample[0] > timestamp) - 1

  const sample = stationData.samples[index]

  if (!sample) return {}

  return stationData.header.reduce((acc, column, i) => {
    acc[column] = sample[i]
    return acc
  }, {})
}

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

const maps = {
  noaaData: {
    noaaTime: 't',
    speed: 's',
    direction: 'd'
  },
  pier17Data: {
    pier17Time: 'Date_Time',
    oxygen: 'oxygen_%_SDI_0_10_%',
    salinity: 'Salinity_SDI_0_4_ppt',
    turbidity: 'Turbidity_SDI_0_8_NTU',
    ph: 'pH_SDI_0_6_H+',
    depth: 'depth_SDI_0_5_m',
    temperature: 'water temperature_SDI_0_2_F'
  },
  centralParkData: {
    centralParkTime: 'Date_Time',
    rain: 'Rain_10680977_in'
  }
}

const units = {
  noaaData: {
    noaaTime: 'unix',
    speed: 'm/s',
    direction: 'degrees'
  },
  pier17Data: {
    pier17Time: 'unix',
    oxygen: '%',
    salinity: 'PPT',
    turbidity: 'NTU',
    ph: 'H+',
    depth: 'm',
    temperature: 'F'
  },
  centralParkData: {
    centralParkTime: 'unix',
    rain: 'in'
  }
}

const getSource = (key, sourcemap) => {
  const defaultSource = 'somewhere out there...'

  if (!key) return defaultSource

  for (let [sourcename, map] of Object.entries(maps)) {
    if (Object.keys(map).includes(key)) return sourcemap[sourcename]
  }

  return defaultSource
}

// Select and rename an object with a map from another object
const select = (source, map) => Object.assign(...Object.entries(map).map(([to, name]) => ({ [to]: parseFloat(source[name]) })))

const getSamples = ({ noaaData, pier17Data, centralParkData }) => {
  const sourcemap = {
    noaaData: noaaData.source,
    pier17Data: pier17Data.source,
    centralParkData: centralParkData.source
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
        noaaTime: parseFloat(Date.parse(noaaSample['t']))
      }
    })
    .map(sample => {
      const pier17Sample = deriveSample({ stationData: pier17Data, timestamp: sample.noaaTime })
      return {
        ...sample,
        ...select(pier17Sample, maps.pier17Data),
        pier17Time: parseInt(pier17Sample['Date_Time'])
      }
    })
    .map(sample => {
      const centralParkSample = deriveSample({ stationData: centralParkData, timestamp: sample.noaaTime })

      return {
        ...sample,
        ...select(centralParkSample, maps.centralParkData),
        centralParkTime: parseInt(centralParkSample['Date_Time'])
      }
    })

  const bacteria = rainToBacteria(samples.map(({ rain }) => rain))
  const samplesWithBacteria = samples.map((sample, index) => ({ ...sample, bacteria: bacteria[index] }))

  const allKeys = [...new Set(...samplesWithBacteria.map(Object.keys))]
  const sources = Object.assign({}, ...allKeys.map(key => ({ [key]: getSource(key, sourcemap) })))

  return {
    version: pkg.version,
    date: new Date(),
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
 * @param {string} stationData.timezone - Timezone for data
 * @param {Date} timestamp - timestamp to get data
 * @returns {Object} A sample of data.
 */
const deriveSample = ({ stationData, timestamp }) => {
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
  getSamples,
  maps
}

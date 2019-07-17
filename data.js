/**
 * getSamples returns an array of samples
 * @param {Object} noaaData - raw noaaData
 * @param {Object} stationData - raw stationData
 *
 * @returns {Object} Array of samples
 */

const rainToBacteria = require('@jedahan/predicted-mpn')

const maps = {
  noaaData: {
    speed: 's',
    direction: 'd'
  },
  pier17Data: {
    oxygen: 'oxygen_%_SDI_0_10_%',
    salinity: 'Salinity_SDI_0_4_ppt',
    turbidity: 'Turbidity_SDI_0_8_NTU',
    ph: 'pH_SDI_0_6_H+',
    depth: 'depth_SDI_0_5_m'
  },
  centralParkData: {
    rain: 'Rain_10680977_in'
  }
}

const getSource = (key, sourcemap) => {
  if (!key) return 'somewhere out there...'

  return maps.entries((sourcename, map) => {
    if (map.keys().includes(key)) return sourcemap[sourcename]
  })
}

// Select and rename an object with a map from another object
const select = (source, map) => map.entries().map((to, name) => ({ [to]: parseFloat(source[name]) }))

const getSamples = ({ noaaData, pier17Data, centralParkData }) => {
  const sourcemap = [noaaData, pier17Data, centralParkData].map(({ source }) => source)

  const start = Math.max(
    Date.parse(noaaData[0].t),
    pier17Data.samples[0][0],
    centralParkData.samples[0][0]
  )
  const end = Math.min(
    Date.parse(noaaData[noaaData.length - 1].t),
    pier17Data.samples[pier17Data.samples.length - 2][0],
    centralParkData.samples[centralParkData.samples.length - 2][0]
  )

  const startIndex = noaaData.findIndex(sample => Date.parse(sample.t) >= start)
  const reverseNoaaData = noaaData.slice().reverse()
  const endIndex = reverseNoaaData.length - reverseNoaaData.findIndex(sample => Date.parse(sample.t) <= end)

  const samples = noaaData.slice(startIndex, endIndex)
    .map(sample => {
      const noaaSample = sample
      return {
        noaaTime: parseFloat(Date.parse(noaaSample['t'])),
        ...select(noaaData, maps.noaaData)
      }
    })
    .map(sample => {
      const pier17Sample = deriveSample({ stationData: pier17Data, timestamp: sample.noaaTime })
      return {
        pier17Time: parseInt(pier17Sample['Date_Time']),
        ...sample,
        ...select(pier17Sample, maps.pier17Data)
      }
    })
    .map(sample => {
      const centralParkSample = deriveSample({ stationData: centralParkData, timestamp: sample.noaaTime })

      return {
        centralParkTime: parseInt(centralParkSample['Date_Time']),
        ...sample,
        ...select(centralParkSample, maps.centralParkData)
      }
    })

  const bacteria = rainToBacteria(samples.map(({ rain }) => rain))

  const version = 1

  const date = new Date()

  const sources = Object.assign(...samples[0].keys()
    .map(key => ({ key: getSource(key, sourcemap) }))
  )

  return {
    version,
    date,
    sources,
    samples: samples.map((sample, index) => ({ ...sample, bacteria: bacteria[index] }))
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

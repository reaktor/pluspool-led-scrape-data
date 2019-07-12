/**
 * getSamples returns an array of samples
 * @param {Object} noaaData - raw noaaData
 * @param {Object} stationData - raw stationData
 *
 * @returns {Object} Array of samples
 */

const rainToBacteria = require('@jedahan/predicted-mpn')

const getSamples = ({ noaaData, pier17Data, centralParkData }) => {
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
    .map(sample => ({
      noaaTime: parseFloat(Date.parse(sample.t)),
      speed: parseFloat(sample.s),
      direction: parseInt(sample.d)
    }))
    .map(sample => {
      const pier17Sample = deriveSample({ stationData: pier17Data, timestamp: sample.noaaTime })
      return {
        ...sample,
        pier17Time: parseInt(pier17Sample['Date_Time']),
        oxygen: parseFloat(pier17Sample['Percent Oxygen_SDI_0_10_%']),
        salinity: parseFloat(pier17Sample['Salinity_SDI_0_4_ppt']),
        turbidity: parseFloat(pier17Sample['Turbidity_SDI_0_8_NTU']),
        ph: parseFloat(pier17Sample['pH mV_SDI_0_7_V'])
      }
    })
    .map(sample => {
      const centralParkSample = deriveSample({ stationData: centralParkData, timestamp: sample.noaaTime })

      return {
        ...sample,
        centralParkTime: parseInt(centralParkSample['Date_Time']),
        rain: parseFloat(centralParkSample['Rain_10680977_in'])
      }
    })

  const bacteria = rainToBacteria(samples.map(({ rain }) => rain))
  return {
    version: 1,
    date: new Date(),
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
  getSamples
}

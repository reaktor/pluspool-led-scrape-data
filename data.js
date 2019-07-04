/**
 * getSamples returns an array of samples
 * @param {Object} noaaData - raw noaaData
 * @param {Object} stationData - raw stationData
 *
 * @returns {Object} Array of samples
 */
const getSamples = ({ noaaData, stationData }) => {
  const start = Math.max(
    Date.parse(noaaData[0].t),
    stationData.samples[0][0]
  )
  const end = Math.min(
    Date.parse(noaaData[noaaData.length - 1].t),
    stationData.samples[stationData.samples.length - 2][0]
  )

  const startIndex = noaaData.findIndex(sample => Date.parse(sample.t) >= start)
  const reverseNoaaData = noaaData.slice().reverse()
  const endIndex = reverseNoaaData.length - reverseNoaaData.findIndex(sample => Date.parse(sample.t) <= end)

  const samplesInRange = noaaData.slice(startIndex, endIndex)

  const samples = samplesInRange
    .map(({ t, s, d }) => ({
      noaaTime: parseFloat(Date.parse(t)),
      speed: parseFloat(s),
      direction: parseInt(d)
    }))
    .map(noaaSample => {
      const timestamp = noaaSample.noaaTime
      const rawStationSample = deriveSampleFromStationData({ stationData, timestamp })
      const stationSample = {
        oxygen: parseFloat(rawStationSample['Percent Oxygen_SDI_0_10_%']),
        salinity: parseFloat(rawStationSample['Salinity_SDI_0_4_ppt']),
        turbidity: parseFloat(rawStationSample['Turbidity_SDI_0_8_NTU']),
        ph: parseFloat(rawStationSample['pH mV_SDI_0_7_V']),
        stationTime: parseInt(rawStationSample['Date_Time'])
      }
      return { ...noaaSample, ...stationSample }
    })

  return samples
}

/**
 *
 * @param {Object} stationData - Data retrieved from the Datagarrison weather station.
 * @param {Array} stationData.header - A list of labels for each column of data.
 * @param {Array} stationData.samples - The data samples.
 * @param {string} stationData.timezone - Timezone for data
 * @param {number} stationSampleIndex - Temporary index for which sample to grab.
 * @returns {Object} A sample of data.
 */
const deriveSampleFromStationData = ({ stationData, timestamp }) => {
  if (!timestamp || !stationData || !stationData.samples) return {}

  const sample = getStationSampleAtTimestamp({ stationData, timestamp })

  return stationData.header.reduce((acc, column, i) => {
    acc[column] = sample[i]
    return acc
  }, {})
}

const getStationSampleAtTimestamp = ({ stationData, timestamp }) => {
  const index = stationData.samples.findIndex(
    sample => sample[0] > timestamp
  ) - 1

  return stationData.samples[index] || {}
}

module.exports = {
  getSamples
}

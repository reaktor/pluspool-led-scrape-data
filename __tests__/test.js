const { getSamples } = require('../data')

const centralParkData = {
  'name': 'HOBO Weather Station - SN 8388608',
  'timezone': 'UTC-300 minutes',
  'header': [
    'Date_Time',
    'Pressure_10660975_in_Hg',
    'carbon_9807985_ppm',
    'carbon2_9807972_ppm',
    'Rain_10680977_in',
    'Solar Radiation_10612119_W/m^2',
    'Temperature_10693502_deg_F',
    'RH_10693502b_%'
  ],
  'samples': [
    [1561999500000, 29.702, 358.643, 0.244, 0.000, 701.875, 84.811, 72.700], // Mon Jul 1 12:45:00
    [1562000400000, 29.690, 359.619, 0.244, 0.000, 406.875, 85.216, 70.300], // Mon Jul 1 13:00:00
    [1562001300000, 29.693, 359.131, 0.244, 0.000, 558.125, 84.901, 71.000], // Mon Jul 1 13:15:00
    [1562002200000, 29.687, 356.201, 0.244, 0.071, 151.875, 84.093, 70.500], // Mon Jul 1 13:30:00
    [1562003100000, 29.681, 365.967, 0.244, 0.000, 35.625, 81.554, 73.900], // Mon Jul 1 13:45:00
    [1562004000000, 29.693, 367.920, 0.244, 0.000, 28.125, 78.602, 78.600], // Mon Jul 1 14:00:00
    [1562004900000, 29.687, 372.314, 0.244, 0.071, 68.125, 75.550, 88.600] // Mon Jul 1 14:15:00
  ]
}

const pier17Data = {
  'name': 'HOBO Weather Station - SN 8388608',
  'timezone': 'UTC-300 minutes',
  'header': [
    'Date_Time',
    'Pressure_10096011_mbar',
    'Water Temperature_SDI_0_2_F',
    'Sp Cond_SDI_0_3_mS/cm',
    'Salinity_SDI_0_4_ppt',
    'Depth_SDI_0_5_m',
    'pH_SDI_0_6_H+',
    'pH mV_SDI_0_7_V',
    'Turbidity_SDI_0_8_NTU',
    'Chl_SDI_0_9_ug/L',
    'Percent Oxygen_SDI_0_10_%',
    'Concentration Oxygen_SDI_0_11_mg/L',
    'Battery_SDI_0_12_volts',
    'Corrected Depth_SDI_0_12_m'
  ],
  'samples': [
    [1562000400000, 1020, 73.75, 11, 6.25, 2.162, 7.13, -52.8, 10, 3.9, 70, 5.77, 11.1, 2.09], // Mon Jul 01 2019 13:00:00
    [1562001300000, 1020, 73.75, 11, 6.25, 2.162, 7.13, -52.8, 10, 3.9, 70, 5.77, 11.1, 2.09], // Mon Jul 01 2019 13:15:00
    [1562002200000, 1021, 73.75, 11, 6.25, 2.162, 7.13, -52.8, 10, 3.9, 70, 5.77, 11.1, 2.09], // Mon Jul 01 2019 13:30:00
    [1562003100000, 1022, 73.75, 11, 6.25, 2.162, 7.13, -52.8, 10, 3.9, 70, 5.77, 11.1, 2.09], // Mon Jul 01 2019 13:45:00
    []
  ]
}

const noaaData = {
  data: [
    {
      t: '2019-07-01 13:00',
      s: '1.065',
      d: '150',
      b: '11'
    },
    {
      t: '2019-07-01 13:06',
      s: '1.065',
      d: '150',
      b: '11'
    },
    {
      t: '2019-07-01 13:12',
      s: '1.065',
      d: '150',
      b: '11'
    },
    {
      t: '2019-07-01 13:18',
      s: '1.065',
      d: '150',
      b: '11'
    },
    {
      t: '2019-07-01 13:24',
      s: '1.065',
      d: '150',
      b: '11'
    },
    {
      t: '2019-07-01 13:30',
      s: '1.065',
      d: '150',
      b: '11'
    },
    {
      t: '2019-07-01 13:36',
      s: '1.065',
      d: '150',
      b: '11'
    },
    {
      t: '2019-07-01 13:42',
      s: '1.065',
      d: '150',
      b: '11'
    },
    {
      t: '2019-07-01 13:48',
      s: '0.987',
      d: '153',
      b: '11'
    },
    {
      t: '2019-07-01 13:54',
      s: '0.881',
      d: '158',
      b: '11'
    },
    {
      t: '2019-07-01 14:00',
      s: '0.814',
      d: '162',
      b: '11'
    }
  ]
}

it('gets data', () => {
  const { samples } = getSamples({ noaaData, pier17Data, centralParkData })
  const firstSample = samples[0]
  const lastSample = samples[samples.length - 1]

  // check timestamp of first sample
  expect(firstSample).toEqual(
    expect.objectContaining({
      noaaTime: 1562000400000,
      pier17Time: 1562000400000,
      centralParkTime: 1562000400000
    })
  )

  // check timestamp of last sample
  expect(lastSample).toEqual(
    expect.objectContaining({
      noaaTime: 1562002920000,
      pier17Time: 1562002200000,
      centralParkTime: 1562002200000
    })
  )

  // check length
  expect(samples.length).toBe(8)
})

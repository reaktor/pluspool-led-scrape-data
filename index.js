if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const { fetchNoaaData, fetchPier17Data, fetchCentralParkData } = require('./fetch')
const { getSamples } = require('./data')

const AWS = require('aws-sdk')
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const uploadFile = async () => {
  const samples = await Promise.all([
    fetchPier17Data,
    fetchCentralParkData,
    fetchNoaaData
  ])
    .then(([pier17Data, centralParkData, rawNoaaData]) => {
      return getSamples({ pier17Data, centralParkData, noaaData: rawNoaaData.data})
    })

  const params = {
    Bucket: 'pluspool',
    Key: 'samples.json',
    Body: JSON.stringify(samples, null, 2),
    ACL: 'public-read',
    ContentType: 'application/json'
  }
  s3.upload(params, function (s3Err, data) {
    if (s3Err) throw s3Err
    console.log(`File uploaded successfully at ${data.Location}`)
  })
}

uploadFile()

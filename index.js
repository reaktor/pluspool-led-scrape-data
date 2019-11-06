if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const pako = require('pako')
const {
  fetchNoaaData,
  fetchPier17Data,
  fetchCentralParkData
} = require('./fetch')
const {
  getSamples,
  storeRawData,
  getDataSets
} = require('./data')

const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const bucket = process.env.AWS_BUCKET

const AWS = require('aws-sdk')
const s3 = new AWS.S3({
  accessKeyId,
  secretAccessKey
})

const uploadFile = async () => {
  const samples = await Promise.all([
    Promise.resolve(fetchNoaaData()),
    Promise.resolve(fetchPier17Data()),
    Promise.resolve(fetchCentralParkData())
  ])
    .then(([noaaData, pier17Data, centralParkData]) => {
      console.log('Data fetching complete')
      return storeRawData({
        noaaData,
        pier17Data,
        centralParkData
      })
    })
  console.log('samples done', samples)
  const dataSets = getDataSets()
  const path = 'samples.json'
  const archivePath = path.replace('samples', samples.date.toJSON())
  const json = JSON.stringify(samples, null, 2)
  const gzipJson = pako.gzip(json)

  // If we do not have aws credentials, write to local filesystem
  if (!accessKeyId || !secretAccessKey) {
    const fs = require('fs')
    fs.writeFile(path, json, (err) => {
      if (err) throw err
      console.log(`Samples written to '${path}'`)
      fs.copyFile(path, archivePath, (err) => {
        if (err) throw err
        console.log(`copied to '${archivePath}'`)
      })
    })
    return
  }

  const params = {
    Bucket: bucket,
    ACL: 'public-read',
    ContentType: 'application/json',
    ContentDisposition: 'attachment',
    ContentEncoding: 'gzip'
  }

  // First upload as (new Date()).json
  s3.upload({
    ...params,
    Key: path,
    Body: Buffer.from(gzipJson, 'utf-8')
  }, (s3Err, data) => {
    if (s3Err) throw s3Err
    console.log(`Samples uploaded to ${data.Location}`)

    // Then copy to `samples.json`
    s3.copyObject({
      ...params,
      CopySource: data.Location,
      Key: archivePath
    }, (s3Err, data) => {
      if (s3Err) throw s3Err
      console.log(`copied to '${archivePath}'`)
    })
  })

  // Upload latest as latest.samples.json
  const samplesLength = samples.samples.length
  const latestLength = 100
  const latestSamples = {
    ...samples,
    samples: samples.samples.slice(samplesLength - latestLength, samplesLength)
  }

  const latestParams = {
    Bucket: bucket,
    ACL: 'public-read',
    ContentType: 'application/json',
    Key: 'latest.samples.json',
    Body: Buffer.from(JSON.stringify(latestSamples, null, 2), 'utf-8')
  }

  s3.upload(latestParams, (s3Err, data) => {
    if (s3Err) throw s3Err
    console.log(`Latest samples uploaded to ${data.Location}`)
  })
}

uploadFile()

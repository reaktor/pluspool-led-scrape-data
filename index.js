const pako = require('pako')
const { S3Client, PutObjectCommand, CopyObjectCommand } = require("@aws-sdk/client-s3")

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

if (!('AWS_ACCESS_KEY_ID' in process.env)) throw new Error('Missing AWS_ACCESS_KEY_ID')
const accessKeyId = process.env.AWS_ACCESS_KEY_ID

if (!('AWS_SECRET_ACCESS_KEY' in process.env)) throw new Error('Missing AWS_SECRET_ACCESS_KEY')
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

if (!('AWS_BUCKET' in process.env)) throw new Error('Missing AWK_BUCKET')
const bucket = process.env.AWS_BUCKET

const params = {
  Bucket: bucket,
  ACL: 'public-read',
  ContentType: 'application/json',
  ContentDisposition: 'attachment',
  ContentEncoding: 'gzip'
}

const s3Client = new S3Client({ region: 'us-east-2'})

const retrieveDataSets = async () => {
  await Promise.all([
    Promise.resolve(fetchNoaaData()),
    Promise.resolve(fetchPier17Data()),
    Promise.resolve(fetchCentralParkData())
  ])
    .then(([noaaData, pier17Data, centralParkData]) => {
      storeRawData({
        noaaData,
        pier17Data,
        centralParkData
      })
      storeDataSetsToFile(getDataSets())
    })
}

const storeDataSetsToFile = (dataSets) => {
  Object.keys(dataSets).forEach(rangeName => {
    const path = `${rangeName}_samples.json`

    const json = JSON.stringify(dataSets[rangeName], null, 2)
    const gzipJson = pako.gzip(json)

    // If we do not have aws credentials, write to local filesystem
    if (!accessKeyId || !secretAccessKey) {
      const fs = require('fs')
      fs.writeFile(path, json, (err) => {
        if (err) throw err
        console.log(`Samples written to '${path}'`)
      })
    } else {
      uploadToS3(path, gzipJson)
    }
  })
}

const uploadToS3 = (path, gzipJson) => {
  const uploadParams = {
    ...params,
    Key: path,
    Body: Buffer.from(gzipJson, 'utf-8')
  }

  s3Client
    .send(new PutObjectCommand(uploadParams))
    .then((s3Err, data) => {
      if (s3Err) throw s3Err
      console.log(`Samples uploaded to ${data.Location}`)
    })
}

// Legacy uploadFile
const uploadFile = async () => {
  const samples = await Promise.all([
    Promise.resolve(fetchNoaaData()),
    Promise.resolve(fetchPier17Data()),
    Promise.resolve(fetchCentralParkData())
  ])
    .then(([noaaData, pier17Data, centralParkData]) => {
      const keys = [noaaData, pier17Data, centralParkData].map(data => Object.keys(data))
      console.debug({ keys })
      return getSamples({
        noaaData,
        pier17Data,
        centralParkData
      })
    })
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

  // First upload as (new Date()).json
  s3Client.send(new PutObjectCommand({
    ...params,
    Key: path,
    Body: Buffer.from(gzipJson, 'utf-8'),
  })).then((s3Err, data) => {
    if (s3Err) throw s3Err
    console.log(`Samples uploaded to ${data.Location}`)

    // Then copy to `samples.json`
    s3Client.send(new CopyObjectCommand({
      ...params,
      CopySource: data.Location,
      Key: archivePath
    })).then((s3Err) => {
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

  s3Client.send(new PutObjectCommand(latestParams)).then((s3Err, data) => {
    if (s3Err) throw s3Err
    console.log(`Latest samples uploaded to ${data.Location}`)
  })
}
retrieveDataSets()
uploadFile()

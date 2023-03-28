import { gzip } from 'pako'
import { S3Client, PutObjectCommand, CopyObjectCommand } from "@aws-sdk/client-s3"

import { fetchNoaaData, fetchPier17Data, fetchCentralParkData } from './fetch.mjs'

import { getSamples, storeRawData, getDataSets }  from './data.mjs'

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
  const [noaaData, pier17Data, centralParkData] = await Promise.all([
    Promise.resolve(fetchNoaaData()),
    Promise.resolve(fetchPier17Data()),
    Promise.resolve(fetchCentralParkData())
  ])
   
  await storeRawData({
    noaaData,
    pier17Data,
    centralParkData
  })

  const dataSets = await getDataSets()
  
  storeDataSetsToFile(dataSets)
}

const storeDataSetsToFile = (dataSets) => {
  Object.keys(dataSets).forEach(async (rangeName) => {
    const path = `${rangeName}_samples.json`

    const json = JSON.stringify(dataSets[rangeName], null, 2)
    const gzipJson = gzip(json)

    // If we do not have aws credentials, write to local filesystem
    if (!accessKeyId || !secretAccessKey) {
      const fs = require('fs')
      fs.writeFile(path, json, (err) => {
        if (err) throw err
        console.log(`Samples written to '${path}'`)
      })
    } else {
      console.log('uploading to S3')
      //await uploadToS3(path, gzipJson)
    }
  })
}

const uploadToS3 = async (path, gzipJson) => {
  const uploadParams = {
    ...params,
    Key: path,
    Body: Buffer.from(gzipJson, 'utf-8')
  }

  await s3Operation(new PutObjectCommand(uploadParams))
  console.log(`Samples uploaded to ${uploadParams.Bucket}/${uploadParams.Key}`)
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
      return getSamples({
        noaaData,
        pier17Data,
        centralParkData
      })
    })
  const path = 'samples.json'
  const archivePath = path.replace('samples', samples.date.toJSON())
  const json = JSON.stringify(samples, null, 2)
  const gzipJson = gzip(json)

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
  const uploadParams = {
    ...params,
    Key: path,
    Body: Buffer.from(gzipJson, 'utf-8')
  }
  await s3Operation(new PutObjectCommand(uploadParams))
  console.log(`Samples uploaded to ${uploadParams.Bucket}/${uploadParams.Key}`)

  const copyParams = {
    ...params,
    CopySource: `${uploadParams.Bucket}/${uploadParams.Key}`,
    Key: archivePath
  }
  await s3Operation(new CopyObjectCommand(copyParams));
  console.log(`Copied to ${copyParams.Bucket}/${copyParams.Key}`)

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

  await s3Operation(new PutObjectCommand(latestParams));
  console.log(`Latest samples uploaded to ${latestParams.Bucket}/${latestParams.Key}`)
}

async function s3Operation (params) {
  try {
    await s3Client.send(params);
  } catch (s3Err) {
    console.log('encountered an AWS SDK S3 error', s3Err)
    //reject with an error, so we don't end up with unhandled promise rejections
    return new Promise((res, reject) => {
      reject(s3Err);
    })
  }
}

//catch a rejected promise, so we don't have unhandled promise rejection errors
Promise.all([
    retrieveDataSets(),
    uploadFile()
  ]
).catch(err => {
  console.log(err)
})

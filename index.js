if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

const pako = require('pako')
const { fetchNoaaData, fetchPier17Data, fetchCentralParkData } = require('./fetch')
const { getSamples } = require('./data')

const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

const AWS = require('aws-sdk')
const s3 = new AWS.S3({ accessKeyId, secretAccessKey })

const uploadFile = async () => {
  const samples = await Promise.all([
    Promise.resolve(fetchNoaaData()),
    Promise.resolve(fetchPier17Data()),
    Promise.resolve(fetchCentralParkData())
  ])
    .then(([noaaData, pier17Data, centralParkData]) => {
      return getSamples({ noaaData, pier17Data, centralParkData })
    })

  const path = `samples.json.gz`
  const archivePath = path.replace('samples', samples.date.toJSON())
  const json = pako.gzip(JSON.stringify(samples, null, 2))

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
    Bucket: 'pluspool',
    ACL: 'public-read',
    ContentType: 'application/json',
    ContentDisposition: 'attachment',
    ContentEncoding: 'gzip'
  }

  // First upload as (new Date()).json
  s3.upload({ ...params, Key: path, Body: Buffer.from(json, 'utf-8') }, (s3Err, data) => {
    if (s3Err) throw s3Err
    console.log(`Samples uploaded to ${data.Location}`)

    // Then copy to `samples.json`
    s3.copyObject({ ...params, CopySource: data.Location, Key: archivePath }, (s3Err, data) => {
      if (s3Err) throw s3Err
      console.log(`copied to '${archivePath}'`)
    })
  })
}

uploadFile()

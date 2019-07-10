if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config()
}

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
    .then(([rawNoaaData, pier17Data, centralParkData]) => {
      return getSamples({ pier17Data, centralParkData, noaaData: rawNoaaData.data })
    })

  const path = `${samples.date.toJSON()}.json`
  const json = JSON.stringify(samples, null, 2)

  // If we do not have aws credentials, write to local filesystem
  if (!accessKeyId || !secretAccessKey) {
    const fs = require('fs')
    fs.writeFile(path, json, (err) => {
      if (err) throw err
      console.log(`File written to ${path}`)
      fs.writeFile('samples.json', json, (err) => {
        if (err) throw err
        console.log(`File written to samples.json`)
      })
    })
    return
  }

  const params = {
    Bucket: 'pluspool',
    ACL: 'public-read',
    ContentType: 'application/json'
  }

  // First upload as (new Date()).json
  s3.upload({ ...params, Key: path, Body: json }, (s3Err, data) => {
    if (s3Err) throw s3Err
    console.log(`File uploaded successfully at ${data.Location}`)

    // Then copy to `samples.json`
    s3.copyObject({ ...params, CopySource: data.Location, Key: 'samples.json' }, (s3Err, data) => {
      if (s3Err) throw s3Err
      console.log(`copied to '${data.Location}'`)
    })
  })
}

uploadFile()

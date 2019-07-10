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
    Key: path,
    Body: json,
    ACL: 'public-read',
    ContentType: 'application/json'
  }

  s3.upload(params, function (s3Err, data) {
    if (s3Err) throw s3Err
    console.log(`File uploaded successfully at ${data.Location}`)

    const copyParams = {
      Bucket: 'pluspool',
      CopySource: data.Location,
      Key: 'samples.json',
      ACL: 'public-read',
      ContentType: 'application/json'
    }
    s3.copyObject(copyParams, function (err, data) {
      if (err) throw err
      console.log(`copied to ${data.Location}`)
    })
  })
}

uploadFile()

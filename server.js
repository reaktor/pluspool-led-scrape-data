const samples = require('fs').readFileSync('samples.json')

require('http').createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'application/json'})
  res.end(samples)
}).listen(8000)

const http = require("http")

const hostname = "localhost"
const port = 3000

const server = http.createServer((req, res) => {
    // Status code 
    res.statusCode = 200 
    res.setHeader('Content-Type', 'text/plain')
    res.end('This is server for socket app')
})

server.listen(port, hostname, () => {
    console.log(`恭喜成功`)
})
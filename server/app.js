const express = require('express');
const bodyParser = require('body-parser')
const mqtt = require('./mqtt')
const coap = require('./coap')
const os = require('os')
//MQTT
mqtt.initialize()

//CoAP
//this one needs a little bit of work becaues they are requests fired at will
//coap.requests()

const portHttp = 8080

const netInterface = os.networkInterfaces();
var resultsNet = {}

// filtering nets on the interface of the host system
for (const name of Object.keys(netInterface)) {
    for (const net of netInterface[name]) {
        // If the IP is IPv4 type and it is not equal to localhost
        if (net.family === 'IPv4' && !net.internal) {
            if (!resultsNet[name]) {
                resultsNet[name] = [];
            }
            resultsNet[name].push(net.address);
        }
    }
}

// Public IP
const host = resultsNet[Object.keys(resultsNet)[0]][0]

const app = express()

// bodyParser for POST
app.use(bodyParser.json())
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
)

// static directory used to the app
app.use(express.static(__dirname + "/public", {
  index: false, 
  immutable: true, 
  cacheControl: true,
  maxAge: "30d"
}));

// Http API
// default API for setup tool
app.get("/", (request, response)=>{
  response.sendFile(path.join(__dirname, 'index.html'));
})

// Retrieve connected sensors ids
//app.get('/getIDs', protocols.getIDs)

// update data for sensor via http protocol
//app.post('/update-setup', protocols.updateSetup)


// listening on http
app.listen(portHttp, host, ()=>{
  console.log(`Listening in HTTP on ${host}:${portHttp}.`)
})
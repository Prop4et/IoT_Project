const express = require('express');
const bodyParser = require('body-parser')
const protocols = require('./protocols')

const path = require('path')
//MQTT
protocols.initializeMQTT()
//CoAP
//this one needs a little bit of work becaues they are requests fired at will
//coap.requests()

const portHttp = 8080

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

let clients = []
// Http API
// default API for setup tool
app.get("/", (req, res)=>{
  res.sendFile(path.join(__dirname, '/index.html'));
})

//get parameters
/*
this is not used anymore, the esp will receive un update on mqtt whenever
the dashboard updates them
app.get('/sensor', http.getSensor);
*/
app.post('/sensor', protocols.connectSensor);
app.post('/pingMqtt', protocols.setPingMQTT);



//set parameters from dashboard
app.post('/update-sensor', protocols.postSensor);

app.get('/getSensors', protocols.getSensors);

// Change the 404 message modifing the middleware
app.use(function(req, res, next) {
  res.status(404).send("Sorry, that route doesn't exist. Have a nice day :)");
});

// start the server in the port 3000 !
app.listen(8080, '192.168.24.2', function () {
  console.log('App server listening on port 8080.');
});
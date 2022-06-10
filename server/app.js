const express = require('express');
const bodyParser = require('body-parser')
const protocols = require('./protocols')

const path = require('path')
//MQTT
//protocols.initializeMQTT()

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

//pages routes
app.get("/", (req, res)=>{
  res.sendFile(path.join(__dirname, '/html/index.html'));
})
app.get('/map', (request, response) =>{
  response.sendFile(path.join(__dirname, '/html/map.html'))
})

app.post('/sensor', protocols.connectSensor);
app.get('/sensor', protocols.getNewId);
app.post('/pingMqtt', protocols.setPingMQTT);


//set parameters from dashboard
app.post('/update-sensor', protocols.postSensor);

app.get('/getSensors', protocols.getSensors);

app.get('/sensorIds', protocols.getSensorIds)
// Change the 404 message modifing the middleware
app.use(function(req, res, next) {
  res.status(404).send("Sorry, that route doesn't exist. Have a nice day :)");
});

//get daily avg humidity and temperature
// start the server in the port 3000 !
app.listen(8080, '192.168.1.133', function () {
  console.log('App server listening on port 8080.');
    protocols.dailyForecast();
});
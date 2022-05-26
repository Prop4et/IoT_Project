const express = require('express');
const bodyParser = require('body-parser')
const mqtt = require('./protocols/mqtt')
const coap = require('./protocols/coap')
const http = require('./protocols/http')

const path = require('path')
//MQTT
mqtt.initialize()

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

// Http API
// default API for setup tool
app.get("/", (req, res)=>{
  res.sendFile(path.join(__dirname, '/index.html'));
})

// Retrieve connected sensors ids
app.get('/update-freq', http.getFreq);
app.get('/update-gas', http.getGas);
app.get('/update-proto', http.getProto);
//app.get('/getIDs', protocols.getIDs)
app.post('/update-freq', http.updateFreq);
app.post('/update-gas', http.updateGas);
app.post('/update-proto', http.updateProto);
// Change the 404 message modifing the middleware
app.use(function(req, res, next) {
  console.log(req)
  res.status(404).send("Sorry, that route doesn't exist. Have a nice day :)");
});




// start the server in the port 3000 !
app.listen(8080, function () {
  console.log('Example app listening on port 8080.');
});
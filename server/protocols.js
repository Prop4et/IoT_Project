const mqtt = require('mqtt')
const coap = require('coap')
const config = require('./config')
const parser = require('./parser')
var params = {}
// ----- MQTT setup -----
const hostMqtt = config.host; // Broker Mosquitto, should i make mine?
const portMqtt = config.port; // listen port for MQTT
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtt://${hostMqtt}:${portMqtt};` // url for connection
// connection on Mosquitto broker

var client = null;

const topicMqtt = parser.topicMqtt;
const subtopics = parser.subtopics;

function initializeMQTT() {
    //initializing MQTT
    console.log(connectUrl);
    client = mqtt.connect(connectUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        username: config.username,
        password: config.password,
        reconnectPeriod: 1000,
    });
    // mqtt event handlers
    client.on('connect', () => {
        console.log(`MQTT client up and running on port: ${portMqtt}.`);
        try {
            subtopics.forEach(topic => client.subscribe(topicMqtt+topic))
          } catch (e) {
            console.log('MQTT Error: ' + e)
          }
    });

    client.on('message', (topic, payload) => {
        topic_exists = false
        sarr = topic.split('/');
        subtopics.forEach(subtopic => {
            if (sarr[sarr.length - 1] === subtopic){
                topic_exists = true;
            }
        });
        
        if(!topic_exists){
            return;
        }
        parser.parse(payload, sarr[sarr.length - 1], 'MQTT');

    });
}


function sendUpdate(data, id){
    if (client == null) {
      console.log('Not connected to mqtt')
    }
    // publish with QoS 1 for secure setup, possible propagation doesn't have effect on the runtime.
    client.publish(
      'sensor/update/'+id,
      JSON.stringify(data),
      { qos: 1, retain: false },
      (e) => {
        if (e) {
          return false;
        } else {
          console.log('MQTT: Published with success on the setup topic.')
          return true;
        }
      })
    return true;
}

function getSensors(req, res){
    res.json(params);
}



1//-----------------------------------CoAP-------------------------------
var req0, req1, req2, req3;
function coapReq(ip, sf){
    setInterval( () => {
        req0 = coap.request({
            observe: true,
            hostname: ip,
            pathname: '/'+topicMqtt+subtopics[0],
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'true'
        });
        //req0 = coap.request(ip+'/'+topicMqtt+subtopics[0])
        req0.on('response', (res) => {
            parser.parse(res.payload, subtopics[0], 'CoAP');
        })
        req0.end();
        req1 = coap.request({
            observe: true,
            hostname: ip,
            pathname: '/'+topicMqtt+subtopics[1],
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'true'
        });
        req1.on('response', (res) => {
            parser.parse(res.payload, subtopics[1], 'CoAP');
        })
        req1.end();
        req2 = coap.request({
            observe: true,
            hostname: ip,
            pathname: '/'+topicMqtt+subtopics[2],
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'true'
        });
        req2.on('response', (res) => {
            parser.parse(res.payload, subtopics[2], 'CoAP');
        })
        req2.end();
        req3  = coap.request({
            observe: true,
            hostname: ip,
            pathname: '/'+topicMqtt+subtopics[3],
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'true'
        });
        req3.on('response', (res) => {
            parser.parse(res.payload, subtopics[3], 'CoAP');
        })
        req3.end();
    }, sf);
}

function coapPing(id, ip){
    let d = new Date();
    var tottime = 0;
    let sendTime = d.getTime();
        var pingreq = coap.request({
            observe: false,
            hostname: ip,
            pathname: '/sensor/ping',
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'false'
        });
        //req0 = coap.request(ip+'/'+topicMqtt+subtopics[0])
        pingreq.on('response', (res) => {
            res.pipe(process.stdout)
            res.on('end', () => {
                console.log(sendTime, d.getTime());
            })
        })

        pingreq.on('timeout', (res) => {
            tottime = d.getTime() - sendTime;
        })
        pingreq.end();

    /*params[id]["coapratio"] = receivedn/10;
    params[id]["pingcoap"] = tottime/receivedn;*/
    
}

//------------------------------------HTTP-------------------------------
//resources value
//nothing is sanitized and types aren't checked
function postSensor(req, res){
    console.log('HTTP: Update ...')
    const id = req.body.id;
    const data = {
        sampleFrequency: parseInt(req.body.sampleFrequency),
        gasMin: parseInt(req.body.minGas),
        gasMax: parseInt(req.body.maxGas),
        proto: parseInt(req.body.proto)
    }
    //id unknown
    if(isNaN(id) || !(id in params)) {
        console.log('HTTP Error: ID ' + id + ' not found for the update');
        res.redirect('/');
        return;
    }
    console.log("ID: ", id);
    if(data.sampleFrequency < 0 || data.sampleFrequency == undefined || data.sampleFrequency == null || isNaN(data.sampleFrequency)){
        console.log('HTTP Error: Invalid values received for sample frequency');
        console.log('-----------------------------');
        data.sampleFrequency = params[id].sampleFrequency;
    }else console.log('HTTP received a new value for the sample frequency ' + data.sampleFrequency);

    if(data.gasMin > data.gasMax){
        console.log('HTTP Error: min value for gas is higher than maximum, back to default');
        data.gasMin = params[id].gasMin;
        data.gasMax = params[id].gasMax;
    }
    if(data.gasMin !== undefined && data.gasMin !== null && !isNaN(data.gasMin)) console.log('HTTP: New value for MIN_GAS_VALUE: ' + data.gasMin);
    else{
        console.log('HTTP Error: invalid minGas value')
        data.gasMin = params[id].gasMin;
    }
    if(data.gasMax !== undefined && data.gasMax !== null && !isNaN(data.gasMax)) console.log('HTTP: New value for MAX_GAS_VALUE: ' + data.gasMax);
    else{
        console.log('HTTP Error: invalid minGas value')
        data.gasMax = params[id].gasMax;
    }

    if (data.proto == undefined || data.proto == null || isNaN(data.proto) || data.proto < 1 || data.proto > 3) {
        console.log('HTTP Error: Invalid data received, no valid protocol, defaulting to MQTT');
        data.proto = params[id].proto;
    }else console.log('HTTP received a new value for the protocol ' + data.proto);

    params[id].sampleFrequency = data.sampleFrequency;
    params[id].gasMin = data.gasMin;
    params[id].gasMax = data.gasMax;
    params[id].proto = data.proto;

    //clearInterval();
    
    sendUpdate(data, id);
    
    /*if(data.proto == 2)
        coapReq(params[id].ip, params[id].sampleFrequency)
    */
    
    console.log('..... Update done');
    res.redirect('/');

}

//on a new sensor i can notify if that id already exists
function connectSensor(req, res){
    const id = req.body.id;
    console.log('HTTP connecting a new sensor with id ' + id);
    if(id in params){
        console.log('a new sensor has connected with the same id of another one: ' + id);
        res.status(404).send("Sensor with id already connected");
        return;
    }

    params[id] = {
        ip: req.body.ip,
        mqttping: 'No',
        coapping: 'No',
        mqttratio: 1,
        coapratio: 1,
        sampleFrequency: 10000,
        gasMin: 0,
        gasMax: 5000,
        proto: 3 
    }

    res.sendStatus(200);

}

function setPing(req, res){
    const id = req.body.id;
    if(id in params){
        console.log(req.body);
        params[id]["mqttping"] = req.body.ping;
        params[id]["mqttratio"] = req.body.ratio;
        console.log(req.body.ratio);
        params[id]["proto"] = 1;
        res.sendStatus(200);
    }
    else    
        res.status(404).send("Sensor uknown");

}

module.exports = {
    postSensor,
    connectSensor,
    initializeMQTT,     
    sendUpdate,
    getSensors,
    setPing
}



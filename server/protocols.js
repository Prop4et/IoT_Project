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
    });

    client.on('message', (topic, payload) => {
        topic_exists = false
        subtopics.forEach(subtopic => {
            sarr = topic.split('/');
            if (sarr[sarr.length - 1] === subtopic){
                topic_exists = true;
            }
        });

        if(!topic_exists){
            console.log(`MQTT: the selected topic: ${topic} was not found`);
            return;
        }

        parser.parse(payload, topic.split('/')[sarr.length - 2], topic.split('/')[sarr.length - 1], 'MQTT');
    
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
      { qos: 1, retain: true },
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



1//-----------------------------------CoAP-------------------------------
function coapReq(){
    const topicMqtt = parser.topicMqtt;
    const subtopics = parser.subtopics;
    const server = coap.createServer()
    setInterval( () => {
        var req0 = coap.request('coap://192.168.1.229/'+topicMqtt+subtopics[0])
        req0.on('response', (res) => {
            parser.parse(res.payload, subtopics[0], 'CoAP');
        })

        var req1 = coap.request('coap://192.168.1.229/'+topicMqtt+subtopics[1])
        req1.on('response', (res) => {
            parser.parse(res.payload, subtopics[1], 'CoAP');
        })

        var req2 = coap.request('coap://192.168.1.229/'+topicMqtt+subtopics[2])
        req2.on('response', (res) => {
            parser.parse(res.payload, subtopics[2], 'CoAP');
        })

        var req3 = coap.request('coap://192.168.1.229/'+topicMqtt+subtopics[3])
        req3.on('response', (res) => {
            parser.parse(res.payload, subtopics[3], 'CoAP');
        })

        setTimeout( () => {
            req0.end();
            req1.end();
            req2.end();
            req3.end();
        }, 1000);
    }, 9000);
}

//------------------------------------HTTP-------------------------------

//resources value
//nothing is sanitized and types aren't checked
function postSensor(req, res){
    console.log('HTTP: Update ...')
    const id = req.body.id;
    const data = {
        sampleFrequency: parseInt(req.body.sampleFrequency),
        gasMin: parseFloat(req.body.minGas),
        gasMax: parseFloat(req.body.maxGas),
        proto: parseInt(req.body.proto)
    }
    //id unknown
    if(!(id in params)) {
        console.log('HTTP Error: ID ' + id + ' not found for the update');
        res.redirect('/');
        return;
    }
    if(data.sampleFrequency < 0 || data.sampleFrequency == undefined || data.sampleFrequency == null){
        console.log('HTTP Error: Invalid values received for sample frequency');
        console.log('-----------------------------');
        data.sampleFrequency = params["id"].sampleFrequency;
    }else console.log('HTTP received a new value for the sample frequency ' + data.sampleFrequency);

    if(data.gasMin > data.gasMax){
        console.log('HTTP Error: min value for gas is higher than maximum, back to default');
        data.gasMin = params[id].gasMin;
        data.gasMax = params[id].gasMax;
    }
    if(data.gasMin !== undefined && data.gasMin !== null) console.log('HTTP: New value for MIN_GAS_VALUE: ' + data.gasMin);
    else{
        console.log('HTTP Error: invalid minGas value')
        data.gasMin = params[id].gasMin;
    }
    if(data.gasMax !== undefined && data.gasMax !== null) console.log('HTTP: New value for MAX_GAS_VALUE: ' + data.gasMax);
    else{
        console.log('HTTP Error: invalid minGas value')
        data.gasMax = params[id].gasMax;
    }

    if (data.proto == undefined || data.proto == null || (data.proto !== 1 && data.proto !== 2)) {
        console.log('HTTP Error: Invalid data received, no valid protocol, defaulting to MQTT');
        data.proto = params[id].proto;
    }else console.log('HTTP received a new value for the protocol ' + data.proto);

    params[id] = data;
    console.log(params);
    sendUpdate(data, id);
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

    console.log('---------------------');
    console.log('Topics: ');
    subtopics.forEach(subtopic => {
        client.subscribe(topicMqtt+id+'/'+[subtopic], () => {
            console.log(`Subscribed to: '${topicMqtt}${subtopic}'`);
        })
    })
    console.log('---------------------');

    params[id] = {
        sampleFrequency: 10000,
        gasMin: 0,
        gasMax: 5000,
        proto: 1
    }
    console.log('parameters set up', params);
    res.sendStatus(200);
}

module.exports = {
    postSensor,
    connectSensor,
    initializeMQTT,     
    sendUpdate 
}



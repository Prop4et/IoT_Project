const mqtt = require('mqtt')
const coap = require('coap')
var coapTiming = {
    ackTimeout: 60
};
coap.updateTiming(coapTiming);

const config = require('./config')
const parser = require('./parser')
var params = {}
var intervals = {}
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
        var msg = JSON.parse(payload.toString());
        parser.parse(msg, sarr[sarr.length - 1], params[msg['id']].lat, params[msg['id']].lon, 'MQTT');

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
function coapReq(id, ip, sf){
    var lat = params[id].lat;
    var lon = params[id].lon;
    intervals[id] = setInterval( () => {
        var req0 = coap.request({
            observe: true,
            hostname: ip,
            pathname: '/'+topicMqtt+subtopics[0],
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'true'
        });

        req0.on('response', (res) => {
            msg = JSON.parse(res.payload.toString());
            parser.parse(msg, subtopics[0], lat, lon, 'CoAP');
        })

        req0.on('timeout', (e) => {
            console.log('req0 timetout', e);
        })
        
        req0.on('error', (error) => {
            req0.destroy();
        });

        req0.end();

        var req1 = coap.request({
            observe: true,
            hostname: ip,
            pathname: '/'+topicMqtt+subtopics[1],
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'true'
        });

        req1.on('response', (res) => {
            msg = JSON.parse(res.payload.toString());
            parser.parse(msg, subtopics[1], lat, lon, 'CoAP');
        })

        req1.on('timeout', (e) => {
            console.log('req1 timetout', e);
        })

        req1.on('error', (error) => {
            req1.destroy();
        });

        req1.end();

        var req2 = coap.request({
            observe: true,
            hostname: ip,
            pathname: '/'+topicMqtt+subtopics[2],
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'true'
        });
        
        req2.on('response', (res) => {
            msg = JSON.parse(res.payload.toString());
            parser.parse(msg, subtopics[2], lat, lon, 'CoAP');
        })

        req2.on('timeout', (e) => {
            console.log('req2 timetout', e);
        })

        req2.on('error', (error) => {
            req2.destroy();
        });
    
        req2.end();

        var req3  = coap.request({
            observe: true,
            hostname: ip,
            pathname: '/'+topicMqtt+subtopics[3],
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'false'
        });

        req3.on('response', (res) => {
            msg = JSON.parse(res.payload.toString());
            parser.parse(msg, subtopics[3], lat, lon, 'CoAP');
        })

        req3.on('timeout', (e) => {
            req3.destroy();
        })
        
        req3.on('error', (error) => {
            console.error( error );
        });

        req3.end();
    }, sf);
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

    if(data.gasMin >= data.gasMax){
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
    if(params[id].proto != 3)
        params[id].prevProto = params[id].proto;
    if(data.proto != 3)
        params[id].prevProto = data.proto;
    params[id].proto = data.proto;
    if(intervals[id]){
        clearInterval(intervals[id]);
        intervals[id] = null;
    }
    
    
    if(data.proto == 2)
            coapReq(id, params[id].ip, params[id].sampleFrequency)
    
    sendUpdate(data, id);
    
    console.log('..... Update done');
    res.redirect('/');

}

ids = {}

function getNewId(req, res){
    var query = JSON.parse(JSON.stringify(req.query));
    if(query.mac in ids)
        res.json({"id": ids[query.mac]})
    else{
        var id = Object.keys(ids).length
        ids[query.mac] = id;
        res.json({"id": id});
    }
}

//on a new sensor i can notify if that id already exists
function connectSensor(req, res){
    const id = req.body.id;
    console.log('HTTP connecting a new sensor with id ' + id);
    if(!(id in params)){
        params[id] = {
            ip: req.body.ip,
            lat: req.body.lat, 
            lon: req.body.lon,
            mqttping: 'No',
            coapping: 'No',
            mqttratio: 1,
            coapratio: 1,
            sampleFrequency: 10000,
            gasMin: 1500,
            gasMax: 5000,
            proto: 3, 
            prevProto: null,
            isSet: false 
        }
    }else{
        const data = {
            sampleFrequency: parseInt(params[id].sampleFrequency),
            gasMin: parseInt(params[id].minGas),
            gasMax: parseInt(params[id].maxGas),
            proto: parseInt(params[id].proto)
        }
        sendUpdate(data, id);
    }
    res.sendStatus(200);

}

function setPingMQTT(req, res){
    const id = req.body.id;
    if(id in params){
        params[id]["mqttping"] = Math.ceil(req.body.ping);
        params[id]["mqttratio"] = req.body.ratio;
        res.sendStatus(200);
        setPingCoap(id, params[id]["ip"]);
    }
    else    
        res.status(404).send("Sensor uknown");
}

const server = coap.createServer()


async function setPingCoap(id, ip){
    const ping = await pingCoap(ip);
    const ratio = await pktRatioCoap(ip, ping);
    params[id]["coapping"] = Math.ceil(ping);
    params[id]["coapratio"] = ratio;
    params[id]["isSet"] = true;
    if(params[id].prevProto)
        params[id].proto = params[id].prevProto;
    /*const data = {
        sampleFrequency: parseInt(params[id].sampleFrequency),
        gasMin: parseInt(params[id].minGas),
        gasMax: parseInt(params[id].maxGas),
        proto: parseInt(params[id].proto)
    }*/
    console.log("Pings done");
    //THIS ONLY IF AUTOMATED STARTUP
    //sendUpdate(data, id);
    
}

function pktRatioCoap(ip, ping){
    let i = 0;
    let n = 0;
    if(ping != "disconnected"){
        var int = setInterval(() => {
            if(i<10){
                pingreq = coap.request({
                    observe: false,
                    hostname: ip,
                    pathname: '/sensor/ping',
                    port: 5683,
                    method: 'get',
                    confirmable: 'true',
                    retrySend: 'false'
                });
                
                pingreq.on('response', (res) => {
                    n++;
                })

                pingreq.on('timeout', (res) => {
                    console.log('timeout');
                })

                i++;
                pingreq.end();
            }
        }, ping)
    
        setTimeout(() => clearInterval(int), ping*10+1000);
        return new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve(n/i);
            }, 12000);
          });
    }else{
        return new Promise((resolve, reject) => {
            resolve(0);
          });
    }
   
}
function pingCoap(ip){
    var i = 0;
    let tottime = 0;
    var pingreq;
    var int = setInterval(() => {
        let sendTime = Date.now();
        pingreq = coap.request({
            observe: false,
            hostname: ip,
            pathname: '/sensor/ping',
            port: 5683,
            method: 'get',
            confirmable: 'true',
            retrySend: 'false'
        });
        
        pingreq.on('response', (res) => {
            tottime += Date.now() - sendTime;
        })
        i++;
        pingreq.end();
    }, 1000)

    setTimeout(() => clearInterval(int), 10000);
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if(tottime != 0)
                resolve(tottime/i);
            else
                resolve("disconnected")
        }, 12000);
      });
}

module.exports = {
    postSensor,
    connectSensor,
    initializeMQTT,     
    sendUpdate,
    getSensors,
    setPingMQTT, 
    getNewId
}



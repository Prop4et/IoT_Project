const mqtt = require('mqtt')
const coap = require('coap')
const request = require('request')
const scheduler = require('expressweb-scheduler')
const opweather = require('./opweather')

var coapTiming = {
    ackTimeout: 0.10, 
    maxRetransmit: 1
};
coap.updateTiming(coapTiming);

const config = require('./config').mqtt
const parser = require('./parser')
var params = {}
var intervals = {}
var aliveInterval = {}
var gpsList= []
// ----- MQTT setup -----
const hostMqtt = config.host; 
const portMqtt = config.port; // listen port for MQTT
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtt://${hostMqtt}:${portMqtt};` // url for connection
// connection on Mosquitto broker

var client = null;
const topicMqtt = parser.topicMqtt;
const subtopics = parser.subtopics;

function initializeMQTT() {
    //initializing MQTT
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

//-----------------------------------CoAP-------------------------------
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
            confirmable: 'false',
            retrySend: 'false'
        });

        req0.on('response', (res) => {
            msg = JSON.parse(res.payload.toString());
            parser.parse(msg, subtopics[0], lat, lon, 'CoAP');
        })

        req0.on('timeout', (e) => {
            req0.destroy();
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
            retrySend: 'false'
        });

        req1.on('response', (res) => {
            msg = JSON.parse(res.payload.toString());
            parser.parse(msg, subtopics[1], lat, lon, 'CoAP');
        })

        req1.on('timeout', (e) => {
            req1.destroy();
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
            confirmable: 'false',
            retrySend: 'false'
        });
        
        req2.on('response', (res) => {
            msg = JSON.parse(res.payload.toString());
            parser.parse(msg, subtopics[2], lat, lon, 'CoAP');
        })

        req2.on('timeout', (e) => {
            req2.destroy();
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
            confirmable: 'false',
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
            req3.destroy();
        });

        req3.end();
    }, sf);
}


function isAlive(id, ip){
    if(!(id in aliveInterval)){
        console.log('isAlive started')
        aliveInterval[id] = setInterval(() => {
            var req = coap.request({
                observe: false,
                hostname: ip,
                pathname: '/sensor/keepalive',
                port: 5683,
                method: 'get',
                confirmable: 'true',
                retrySend: 'false'
            });
    
            req.on('response', (res) => {
            })
    
            req.on('error', (e) => {
                var ip = req.url.hostname;
                Object.keys(params).forEach( e => {
                    if(params[e]["ip"] == ip && params[e]["isSet"]){
                        clearInterval(aliveInterval[e]);
                        aliveInterval[e] = null;
                        params[e]["isSet"] = false;
                        params[e]["prevProto"] = params[e]["proto"]
                        params[e]["proto"] = 3
                        request.post('http://127.0.0.1:5000/removeId/'+id,
                            function (error, response, body) {
                                if (!error && response.statusCode == 200) {
                                    console.log(body);
                                }
                            }
                        )
                    }
                })
                req.destroy();

            })

            req.on('timeout', (e) => {
                var ip = req.url.hostname;
                Object.keys(params).forEach( id => {
                    if(params[id]["ip"] == ip && params[id]["isSet"]){
                        clearInterval(aliveInterval[id]);
                        aliveInterval[id] = null;
                        params[id]["isSet"] = false;
                        params[id]["prevProto"] = params[id]["proto"]
                        params[id]["proto"] = 3
                        request.post('http://127.0.0.1:5000/removeId/'+id,
                            function (error, response, body) {
                                if (!error && response.statusCode == 200) {
                                    console.log(body);
                                }
                            }
                        )
                    }
                })
                req.destroy();
                console.log('sensor '+id+' disconnected');

            })
            req.end();
        }, 180000);
    }
}
//------------------------------------HTTP-------------------------------
//resources value
//nothing is sanitized and types aren't checked


function postSensor(req, res){
    console.log('HTTP: Update ...')
    const id = req.body.id;
    var responseMsg="";
    var status = 200;
    const data = {
        sampleFrequency: parseInt(req.body.sampleFrequency),
        gasMin: parseInt(req.body.gasMin),
        gasMax: parseInt(req.body.gasMax),
        proto: parseInt(req.body.proto)
    }
    //id unknown
    if(isNaN(id) || !(id in params)) {
        console.log('HTTP Error: ID ' + id + ' not found for the update');
        res.status(400);
        res.send('Invalid ID');
    }
    if(data.sampleFrequency < 0 || data.sampleFrequency == undefined || data.sampleFrequency == null || isNaN(data.sampleFrequency)){
        console.log('HTTP Error: Invalid values received for sample frequency');
        console.log('-----------------------------');
        status = 406;
        responseMsg += "Using old sample frequency - "
        data.sampleFrequency = params[id].sampleFrequency;
    }else console.log('HTTP received a new value for the sample frequency ' + data.sampleFrequency);

    if(data.gasMin >= data.gasMax){
        console.log('HTTP Error: min value for gas is higher than maximum, back to default');
        data.gasMin = params[id].gasMin;
        data.gasMax = params[id].gasMax;
        status = 406;
        responseMsg += "Using old min and max gas value - "
    }
    if(data.gasMin !== undefined && data.gasMin !== null && !isNaN(data.gasMin)) console.log('HTTP: New value for MIN_GAS_VALUE: ' + data.gasMin);
    else{
        console.log('HTTP Error: invalid minGas value')
        status = 406;
        responseMsg += "Using old min value - "
        data.gasMin = params[id].gasMin;
    }
    if(data.gasMax !== undefined && data.gasMax !== null && !isNaN(data.gasMax)) console.log('HTTP: New value for MAX_GAS_VALUE: ' + data.gasMax);
    else{
        status = 406;
        responseMsg += "Using old max value - "
        console.log('HTTP Error: invalid minGas value')
        data.gasMax = params[id].gasMax;
    }

    if (data.proto == undefined || data.proto == null || isNaN(data.proto) || data.proto < 1 || data.proto > 3) {
        console.log('HTTP Error: Invalid data received, no valid protocol, defaulting to MQTT');
        status = 406;
        responseMsg += "Using old protocol value"
        data.proto = params[id].proto;
    }else console.log('HTTP received a new value for the protocol ' + data.proto);

    params[id].sampleFrequency = data.sampleFrequency;
    params[id].gasMin = data.gasMin;
    params[id].gasMax = data.gasMax;
    if(params[id].proto != 3)
        params[id].prevProto = params[id].proto;
    else{
        //after pinging on connection it doesn't start automatically, it wait's to start some sort of communication
        //if someone decides to ping randomly during the usage then it clears the previous interval
        if(aliveInterval[id])
            clearInterval(aliveInterval[id]);
        isAlive(id, params[id].ip)
    }
    //if i didn't do a ping as the last thing i save the last protocol used
    if(data.proto != 3)
        params[id].prevProto = data.proto;
    params[id].proto = data.proto;

    //clear the coap interval, in case the protocol is coap it restarts with coap req
    if(intervals[id]){
        clearInterval(intervals[id]);
        intervals[id] = null;
    }
    
    
    if(data.proto == 2)
            coapReq(id, params[id].ip, params[id].sampleFrequency)
    
    sendUpdate(data, id);
    
    console.log('..... Update done');
    res.status(status);
    if(responseMsg == "")
        responseMsg = "Update done"
    res.send(responseMsg);

}

var ids = {}
var requests = []

function getId(req, res){
    var mac = req.body.mac
    var id = req.body.id
    if(!(mac in ids)){//otherwise it means i assigned it and skipped somhow
        var v = Object.values(ids)
        if(v.findIndex( (e) => e === id) === -1 ){//id not assigned
            requests = requests.filter(e => e !== mac);
            ids[mac] = id;
            macResponses[mac].json({"id": id});
            macResponses[mac].destroy();
            macResponses[mac] = null;
            res.sendStatus(200);
            return;
        }
    }
    res.sendStatus(400);

}

macResponses = {}
function getNewId(req, res){
    var query = JSON.parse(JSON.stringify(req.query));
    var mac = query.mac
    if(mac in ids){
        if(ids[mac] && ids[mac] != null && !(isNaN(ids[mac]))){
            res.json({"id": ids[query.mac]})
        }
        else{
            requests.push(mac);
            macResponses[mac] = res;
        }
    }
    else{
        requests.push(mac);
        macResponses[mac] = res;
    }
}

function connectSensor(req, res){
    const id = req.body.id;
    console.log('HTTP connecting a new sensor with id ' + id);
    //the sensor is new or was completely
    if(!(id in params) || !params[id]["isSet"]){
        params[id] = {
            ip: req.body.ip,
            lat: req.body.lat, 
            lon: req.body.lon,
            mqttping: 'No',
            coapping: 'No',
            mqttratio: 1,
            coapratio: 1,
            sampleFrequency: 10000,
            gasMin: 1,
            gasMax: 5,
            proto: 3, 
            predWindow: null,
            prevProto: null,
            isSet: false 
        }
        //save gps coordinates for meteostats, in case two sensors have the same coordinates i can take only one weather forecast
        if( gpsList.findIndex((e) => e[0] === req.body.lat && e[1] === req.body.lon) === -1){
            gpsList.push([req.body.lat, req.body.lon]);
            opweather.forecast(req.body.lat, req.body.lon)
        }
    }else{
        //the system didn't recognize the sensor as disconnected, tries to do everything in a shorter way
        const data = {
            sampleFrequency: parseInt(params[id].sampleFrequency),
            gasMin: parseInt(params[id].minGas),
            gasMax: parseInt(params[id].maxGas),
            proto: parseInt(params[id].proto)
        }
        params[id]["isSet"] = true
        isAlive(id, params[id].ip)
        request.post('http://127.0.0.1:5000/newId/'+id,
            function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                }
            }
        );
        sendUpdate(data, id);
    }
    res.sendStatus(200);

}

//----------------------------------PING SECTION---------------------------------------------
//get the mqtt ping from the sensor, computed by the sensor itself
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

async function setPingCoap(id, ip){
    console.log('coap ping started')
    //get the ping (ms) value
    const ping = await pingCoap(ip);
    //get the delivery ratio (delivered/lost)
    const ratio = await pktRatioCoap(ip, ping);
    //set all the properties and go
    params[id]["coapping"] = Math.ceil(ping);
    params[id]["coapratio"] = ratio;
    params[id]["isSet"] = true;
    if(params[id].prevProto)
        params[id].proto = params[id].prevProto;
    console.log("Pings done");
    var coapTiming = {
        ackTimeout: 0.2, 
        maxRetransmit: 0
    };
    coap.updateTiming(coapTiming);
    //register the new id for the predictions
    request.post('http://127.0.0.1:5000/newId/'+id,
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                console.log(body);
            }
        }
    );
    
}

//everything needed to be async here because coap and intervals
//TODO: check that is incremented correctly 

function pktRatioCoap(ip, ping){
    let i = 0;
    let n = 0;
    if(ping != "disconnected"){
        var int = setInterval(() => {
            if(i<10){
                i++;
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
                //timeout is too high to lose packets tho
                pingreq.on('timeout', (res) => {
                    console.log('timeout');
                })

                pingreq.on('error', (err) => {
                })

                pingreq.end();
            }
        }, ping)
    
        setTimeout(() => clearInterval(int), ping+10000);
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

//get the ping (ms)
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

//function to HTTP POST the flask app for the prediction
function postStartPrediction(req, res){
    console.log('HTTP: Start prediction')
    const id = req.body.id;
    //check valid id
    if(!(id in params) || !params[id]["isSet"]){
        res.status(400);
        res.send('Invalid ID');
        return;
    }
    //check valid time window
    const window = req.body.window
    if(window === '' || isNaN(window)){
        res.status(400);
        res.send('Invalid window');
        return;
    }
    //get the response from the app and send it to the frontend
    request.post('http://127.0.0.1:5000/predict/'+id+'/'+window,
    function (error, response, body) {
        if(window >= 15) {
            res.status(response.statusCode)
            res.send(body);
        }else{
            res.status(406);
            res.send('Window too short, starting with window = 15');
        }
    });

}

//function to HTTP POST the flask app for stopping the prediction
function postStopPrediction(req, res){
    console.log('HTTP: Stop prediction')
    const id = req.body.id;
    //check for valid id
    if(!(id in params) || !params[id]["isSet"]){
        res.status(400);
        res.send('Invalid ID');
        return;
    }
    request.post('http://127.0.0.1:5000/stoppredict/'+id,
    //get the response and send it to the frontend
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
            res.status(response.statusCode)
            res.send(body);
        }
    });
}

//function that calls the interaction with openweather 4 times a day (00.00, 06.00, 12.00, 18.00)
function dailyForecast(){
    scheduler.call(()=> {
        gpsList.forEach((e) => {
            opweather.forecast(e[0], e[1])
        });
    }).dailyAt('23:59').run();

    scheduler.call(()=> {
        gpsList.forEach((e) => {
            opweather.forecast(e[0], e[1])
        });
    }).dailyAt('05:59').run();

    scheduler.call(()=> {
        gpsList.forEach((e) => {
            opweather.forecast(e[0], e[1])
        });
    }).dailyAt('11:59').run();

    scheduler.call(()=> {
        gpsList.forEach((e) => {
            opweather.forecast(e[0], e[1])
        });
    }).dailyAt('17:59').run();
    
}

//Functions to communicate with the frontend
function getSensors(req, res){
    res.json(params);
}

function getSensorIds(req, res){
    res.json({'ids': Object.keys(params)})
}

function getRequests(req, res){
    res.json(requests);
}


module.exports = {
    postSensor,
    connectSensor,
    initializeMQTT,     
    sendUpdate,
    getSensors,
    getSensorIds,
    setPingMQTT, 
    getNewId,
    dailyForecast,
    postStartPrediction,
    postStopPrediction,
    getId,
    getRequests
}



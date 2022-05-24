const mqtt = require('mqtt')
const config = require('./config')
// ----- MQTT setup -----
const hostMqtt = config.host; // Broker Mosquitto, should i make mine?
const portMqtt = config.port; // listen port for MQTT
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtt://${hostMqtt}:${portMqtt};` // url for connection

// connection on Mosquitto broker
var client = null;
const topicMqtt = 'sensor/';
//info -> RSS, id, gps
//temp_hum -> temperature and humidity
//MQ2 -> AQI smoke
//PPM -> smoke, CO, CO2, alcohol, toluen, NH4, aceton
const subtopics = ["temp_hum", "info", 'MQ2', 'PPM']

function initialize() {
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
        console.log('---------------------');
        console.log('Topics: ');
        subtopics.forEach(subtopic => {
            client.subscribe(topicMqtt+[subtopic], () => {
                console.log(`Subscribed to: '${topicMqtt}${subtopic}'`);
            })
        })
        console.log('---------------------');
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

        res = JSON.parse(payload.toString());

        sarr = topic.split('/');
        switch(sarr[sarr.length - 1]){
            case 'info': console.log("MQTT: Info> ID: ", res['id'] + " Signal: " +res['RSS'] + "db Coordinates: "+ res['gps'].lat+"°, "+res['gps'].lon+"°");
            break;
            case 'temp_hum': console.log("MQTT: Temperature and Humidity>", res['temperature'] + "° " + res['humidity']+"%");
            break;
            case 'MQ2': console.log("MQTT: MQ2 params>", +"AQI: " + res["AQI"] + " smoke: " + res["smoke"]);
            break;
            case 'PPM': {
                console.log("MQTT: PPM> \n\t" +
                                'CO: ' + res['CO'] +"\n\t" +
                                'CO2: ' + res['CO2'] +"\n\t" +
                                'NH4: ' + res['NH4'] +"\n\t" +
                                'Alchool: ' + res['alcohol'] +"\n\t" +
                                'Toluen: ' + res['toluen'] +"\n\t" +
                                'Aceton: ' + res['aceton']
                            );
            }
            break;
            default:
                console.log('MQTT: topic not supported:', sarr[sarr.length - 1]);
            break;
        }
    
    });
}

//Mybe i should send it with coap, makes more sense that the arduino asks for the update
/*
function toSensor(data) {
    if (client == null) {
        console.log('Error, no sensors connected.')
    }

    client.publish("sensor/freq", data.sampleFrequency.toString())
    client.publish("sensor/minv", data.minGas.toString())
    client.publish("sensor/maxv", data.maxGas.toString())
    client.publish("sensor/protocol", data.proto.toString())
}*/

module.exports = {
    initialize
    //toSensor,
}
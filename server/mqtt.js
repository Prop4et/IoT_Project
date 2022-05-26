const mqtt = require('mqtt')

const config = require('./config')
const parser = require('./parser')
// ----- MQTT setup -----
const hostMqtt = config.host; // Broker Mosquitto, should i make mine?
const portMqtt = config.port; // listen port for MQTT
const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
const connectUrl = `mqtt://${hostMqtt}:${portMqtt};` // url for connection

// connection on Mosquitto broker
var client = null;
const topicMqtt = parser.topicMqtt;
const subtopics = parser.subtopics;

function initialize() {

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

        //res = JSON.parse(payload.toString());


        //sarr = topic.split('/');
        parser.parse(payload, topic.split('/'), 'MQTT');
    
    });
}


//Mybe i should send it with coap, makes more sense that the arduino asks for the update

module.exports = {
    initialize
}
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
const updateTopic = '/sensor/update'

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

        parser.parse(payload, topic.split('/')[1], 'MQTT');
    
    });
}


function sendUpdate(id, data, client){
    if (client == null) {
      console.log('Not connected to mqtt')
    }
    // publish with QoS 1 for secure setup, possible propagation doesn't have effect on the runtime.
    tosend = {id: id, data: data}
    client.publish(
      updateTopic,
      JSON.stringify(tosend),
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

module.exports = {
    initialize, 
    sendUpdate
}
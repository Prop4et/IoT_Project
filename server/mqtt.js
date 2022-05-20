const mqtt = require('mqtt')

// ----- MQTT setup -----
const hostMqtt = '127.0.0.1'; // Broker Mosquitto, should i make mine?
const portMqtt = '1883'; // listen port for MQTT
const clientId = 'mqtt_client';
const connectUrl = `mqtt://${hostMqtt}:${portMqtt};` // url for connection

// connection on Mosquitto broker
var client = null;
const topicMqtt = 'sensor/3030/';
const subtopics = ["tempterature", "humidity", "RSS", "AQI", "smoke", "CO", "CO2", "alcohol", "toluen", "NH4", "aceton", "id", "gps"]; //ex channels


function init() {
    client = mqtt.connect(connectUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        username: 'iot2022',
        password: 'mqtt2022*',
        reconnectPeriod: 2000,
    });

    // mqtt event handlers
    client.on('connect', () => {
        console.log(`MQTT client up and running on port: ${portMqtt}.`);
        console.log('---------------------');
        console.log('Topics: ');
        subtopics.forEach(subtopic => {
            client.subscribe([subtopic], () => {
                console.log(`Subscribed to: '${subtopic}'`);
            });
        });
        console.log('---------------------');
    });

    client.on('message', (topic, payload) => {
        topic_exists = false
        subtopics.forEach(subtopic => {
            if (topic == subtopic) topic_exitsts = true
        });

        if(!topic_exists){
            console.log(`MQTT: the selected topic: ${topic} was not found`);
            return;
        }

        if(topic === (topicMqtt + id) || topic === (topicMqtt + "gps")){
            res = payload.toString();
        }
        else{
            res = parseFloat(pyload.toString()).toFixed(2);
        }

        if (value == NaN) {
            console.error('MQTT: NaN value found with on the subscription', topic)
        } else {

            sarr = topic.split('/');

            switch(sarr[sarr.length - 1]){
                case 'temperature': console.log("MQTT: Temperature>", value + "°");
                break;
                case 'humidity': console.log("MQTT: Humidity>", value + "%");
                break;
                case 'RSS': console.log("MQTT: WiFi RSS>", RSS + "db");
                break;
                case 'AQI': console.log("MQTT: Air Quality Index>", value+"");
                break;
                case 'gps': {
                    coords = value.split("/\s*, \s*/");
                    console.log("MOTT: GPS Coordinates>", coords[0]+", "+coords[1]);
                }
                break;
                case 'CO': console.log("MQTT: CO> ", value+" PPM");
                break;
                case 'CO2': console.log("MQTT: CO2> ", value+" PPM");
                break;
                case 'smoke': console.log("MQTT: Smoke> ", value+" PPM");
                break;
                case 'alcohol': console.log("MQTT: Alcohol> ", value+" PPM");
                break;
                case 'toluen': console.log("MQTT: Toluen> ", value+" PPM");
                break;
                case 'NH4': console.log("MQTT: NH4> ", value+" PPM");
                break;
                case 'aceton': console.log("MQTT: Aceton> ", value+" PPM");
                break;
                case 'id': console.log("MQTT: Device ID>", value+"");
                break;
                default:
                    console.log('MQTT: topic not supported:', sarr);
                break;
            }
        }
    });
}

function toSensor(data) {
    if (client == null) {
        console.log('Error, no sensors connected.')
    }

    client.publish("sensor/3030/freq", data.sampleFrequency.toString())
    client.publish("sensor/3030/ming", data.minGas.toString())
    client.publish("sensor/3030/maxg", data.maxGas.toString())
    client.publish("sensor/3030/proto", data.proto.toString())
}

module.exports = {
    init,
    toSensor,
}
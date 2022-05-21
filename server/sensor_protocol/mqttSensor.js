const mqtt = require('mqtt')
const config = require('../config')

class MqttSimulator {

    constructor(host, port, clientId, username, password) {
        this.host = host;
        this.port = port;
        this.options = {
            // Clean session fields
            clean: true,
            connectTimeout: 4000,
            // Authentication fields
            clientId: clientId,
            username: username,
            password: password,
        }
    }

    publish() {
        console.log('MQTT connection to ' + "mqtt://" + this.host + ":" + this.port)
        const client = mqtt.connect("mqtt://" + this.host + ":" + this.port, this.options)

        //create an object to send as POST data
        const payloads = {
            info: {id: '11111', RSS: -60, gps:{lat: '44.5012555', lon:'11.3501868'}},
            temp_hum: {temperature: 28, humidity: 50},
            AQI: 1,
            PPM: {
                CO: 400,
                CO2: 399,
                smoke: 388,
                alcohol: 377,
                toluen: 366,
                NH4: 355,
                aceton: 344 
            }
        };

        // handler
        client.on('connect', function () {
            console.log('Connected to the Mosquitto broker...')
            client.subscribe('#')
            console.log('Publishing data...')

            client.publish('sensor/info', JSON.stringify(payloads.info))
            client.publish('sensor/temp_hum', JSON.stringify(payloads.temp_hum))
            client.publish('sensor/AQI', payloads.AQI + "")
            client.publish('sensor/PPM', JSON.stringify(payloads.PPM))
            client.end()
        });
        
        
    
    }
}

const simulator = new MqttSimulator(config.host, config.port, "mqttBiancucci"+ Math.floor(Math.random() * 10) + 1, config.username, config.password);
simulator.publish();

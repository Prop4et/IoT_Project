const mqtt = require('./mqtt')
const coap = require('./coap')
// init MQTT
mqtt.initialize()
coap.requests()
const coap = require('coap')
const parser = require('./parser')

function requests(){
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

module.exports = {
    requests
}
//const coap = require('coap');
const coap = require("coap");
const parser = require('./parser')

request_obj= {
    hostname: '192.168.1.229', 
    port: '5683',
    method: 'get',
    pathname: '/info',
    retrySend: 10
};

const server = coap.createServer()

server.on('request', (req, res) => {
    //http request to the page with the setup
    console.log(req.url)
    if(req.url == "/params") {  
        data = JSON.stringify({SAMPLE_FREQ: 15000, MIN_GAS_VALUE:0.5, MAX_GAS_VALUE: 4995, protocol:2})
        console.log(data)
        res.end(data)
    }
    else
        res.end(404)
  })
  
  server.listen()
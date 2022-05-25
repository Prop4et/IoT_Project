const coap = require("node-coap-client").CoapClient;

coap
    .tryToConnect("coap://192.168.1.229")
    .then((result) => {
        if(result == true) console.log('coap server available');
        else console.log('Error: ', result);
    })
    ;
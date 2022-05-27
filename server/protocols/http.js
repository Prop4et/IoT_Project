//resources value
params = {} //{ id: {smpleFrequency: xx, minGas:xx, maxGas:xx, proto:}, .....}
//nothing is sanitized and types aren't checked
function postSensor(req, res){
    console.log('HTTP: Update ...')
    const id = req.body.id;
    const data = {
        sampleFrequency: parseInt(req.body.sampleFrequency),
        gasMin: parseFloat(req.body.minGas),
        gasMax: parseFloat(req.body.maxGas),
        proto: parseInt(req.body.proto)
    }
    //id unknown
    if(!(id in params)) {
        console.log('HTTP Error: ID ' + id + ' not found for the update');
        res.redirect('/');
        return;
    }
    if(data.sampleFrequency < 0 || data.sampleFrequency == undefined || data.sampleFrequency == null){
        console.log('HTTP Error: Invalid values received for sample frequency');
        console.log('-----------------------------');
        data.sampleFrequency = params["id"].sampleFrequency;
    }else console.log('HTTP received a new value for the sample frequency ' + data.sampleFrequency);

    if(data.gasMin > data.gasMax){
        console.log('HTTP Error: min value for gas is higher than maximum, back to default');
        data.gasMin = params[id].gasMin;
        data.gasMax = params[id].gasMax;
    }
    if(data.gasMin !== undefined && data.gasMin !== null) console.log('HTTP: New value for MIN_GAS_VALUE: ' + data.gasMin);
    else{
        console.log('HTTP Error: invalid minGas value')
        data.gasMin = params[id].gasMin;
    }
    if(data.gasMax !== undefined && data.gasMax !== null) console.log('HTTP: New value for MAX_GAS_VALUE: ' + data.gasMax);
    else{
        console.log('HTTP Error: invalid minGas value')
        data.gasMax = params[id].gasMax;
    }

    if (data.proto == undefined || data.proto == null || (data.proto !== 1 && data.proto !== 2)) {
        console.log('HTTP Error: Invalid data received, no valid protocol, defaulting to MQTT');
        data.proto = params[id].proto;
    }else console.log('HTTP received a new value for the protocol ' + data.proto);

    params[id] = data;
    console.log(params)
    console.log('..... Update done');
    res.redirect('/');

}

//on a new sensor i can notify if that id already exists
function connectSensor(req, res){
    const id = req.body.id;
    console.log('HTTP connecting a new sensor with id ' + id);
    if(id in params){
        console.log('a new sensor has connected with the same id of another one: ' + id);
        res.status(404).send("Sensor with id already connected");
        return;
    }
    params[id] = {
        sampleFrequency: 10000,
        gasMin: 0,
        gasMax: 5000,
        proto: 1
    }
    console.log('parameters set up', params);
    res.sendStatus(200);
}

function getSensor(req, res){
    //there should be a query param with the id
    var id = req.query.id.toString();
    console.log('HTTP Get from id ' + id)
    if(id in params){
        console.log('sending params: ', params);
        res.status(200).send(JSON.stringify(params[id]));
    }
    else{
        res.status(404).send("Sensor is not registered");
        console.log("GET request on uknown id: " + id);
    }
    //res.redirect('/');
}

module.exports = {
    postSensor,
    connectSensor, 
    getSensor,
}
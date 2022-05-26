//resources value
params = {} //{ id: {smpleFrequency: xx, minGas:xx, maxGas:xx, proto:}, .....}

//nothing is sanitized and types aren't checked
function postSensor(req, res){
    console.log('HTTP: Update ...')
    const id = req.body.id;
    const data = {
        sampleFrequency: req.body.sampleFrequency,
        gasMin: req.body.minGas,
        gasMax: req.body.maxGas,
        proto: req.body.proto
    }
    if(!(id in params)) {
        console.log('HTTP Error: ID ' + id + ' not found for the update');
        res.redirect('/');
        return;
    }
    if(data.sampleFrequency < 0 || data.sampleFrequency == undefined || data.sampleFrequency == null){
        console.log('HTTP Error: Invalid values received for sample frequency');
        console.log('-----------------------------');
        data.sampleFrequency = params.id.sampleFrequency;
    }else console.log('HTTP received a new value for the sample frequency');

    if(data.gasMin > data.gasMax){
        console.log('HTTP Error: min value for gas is higher than maximum, back to default');
        data.gasMin = params.id.gasMin;
        data.gasMax = params.id.gasMax;
    }
    if(data.gasMin !== undefined && data.gasMin !== null) console.log('HTTP: New value for MIN_GAS_VALUE: ' + data.gasMin);
    else{
        console.log('HTTP Error: invalid minGas value')
        data.gasMin = params.id.gasMin;
    }
    if(data.gasMax !== undefined && data.gasMax !== null) console.log('HTTP: New value for MAX_GAS_VALUE: ' + data.gasMax);
    else{
        console.log('HTTP Error: invalid minGas value')
        data.gasMax = params.id.gasMax;
    }

    if (data.proto == undefined || data.proto == null || (data.proto !== 1 && data.proto !== 2)) {
        console.log('HTTP Error: Invalid data received, no valid protocol, defaulting to MQTT');
        data.proto = params.id.proto;
    }

    params.id = data;
    res.redirect('/');

}

//on a new sensor i can notify if that id already exists
function connectSensor(req, res){
    console.log('HTTP connecting a new sensor')
    const id = req.body.id;
    if(id in params){
        console.log('a new sensor has connected with the same id of another one: ' + id);
        return;
    }
    params.id = {
        sampleFrequency: 10000,
        gasMin: 0,
        gasMax: 5000,
        proto: 1
    }
    res.redirect('/');
    //there's already a sensor with that id, can't do that, deve essere fatto a mano imo
}

function getSensor(req, res){
    //there should be a query param with the id
    var id = req.query.id;
    if(id in params)
        res.send(JSON.stringify(params.id))
    res.redirect('/');
}

module.exports = {
    postSensor,
    connectSensor, 
    getSensor,
}
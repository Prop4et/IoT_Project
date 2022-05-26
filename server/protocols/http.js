//resources value
var sampleFrequency = 10000;
var minGas = 0;
var maxGas = 5000;
var proto = 1;

function updateFreq(req, res){
    console.log('HTTP: Update sample frequency values...')
    var app = req.body.sampleFrequency;

    if(app < 0) {
        console.log('HTTP Error: Invalid values received.');
        console.log('-----------------------------');
        return;
    }

    if (app != undefined && app != null) {
        console.log('HTTP: Received SAMPLE_FREQUENCY: ' + app)
    } else {
        console.log('HTTP: Invalid frequency value, defaulting to 10000');
        app = 10000
    }
    //here i save the resource that i should be able to get later 
    sampleFrequency = app;
}

function updateGas(req, res){
    console.log('HTTP: Update gas values...')
    var appMin = req.body.minGas;
    var appMax = req.body.maxGas;

    if (appMin > appMax){
        console.log('HTTP Error: Invalid values received.');
        console.log('-----------------------------');
        return;
    }

    if (appMin !== undefined && appMin !== null) console.log('HTTP: Received MIN_GAS_VALUE: ' + appMin);
        else {
            console.log('HTTP: Invalid min value, defaulting to min 0');
            appMin = 0;
        }
        if (appMax !== undefined && appMax !== null) console.log('HTTP: Received MAX_GAS_VALUE: ' + appMax);
        else {
            console.log('HTTP: Invalid max value, defaulting to max 5000');
            appMax = 5000;
        }

    minGas = appMin;
    maxGas = appMax;
        
}

function updateProto (req, res){
    console.log('HTTP: Update protocol...');
    appProto = req.body.protocol;

    if (appProto == undefined || appProto == null || (appProto !== 1 && appProto !== 2)) {
        console.log('HTTP Error: Invalid data received, no valid protocol');
        console.log('-----------------------------');
        return;
    }

    proto = appProto;

}

function getFreq(req, res){
    res.send(JSON.stringify({sampleFreq: sampleFrequency}));
}

function getGas(req, res){
    res.send(JSON.stringify({minGas: minGas, maxGas: maxGas}));
}

function getProto(req, res){
    res.send(JSON.stringify({proto: proto}));
}

module.exports = {
    updateFreq,
    updateGas, 
    updateProto,
    getFreq,
    getGas,
    getProto
}
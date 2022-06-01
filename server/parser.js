//info -> RSS, id, gps
//temp_hum -> temperature and humidity
//MQ2 -> AQI smoke
//PPM -> smoke, CO, CO2, alcohol, toluen, NH4, aceton
const influx = require('./influx');
const influxConfig = require('./influxconfig')
const influxClient = new influx.InfluxClient(influxConfig.host, influxConfig.port, influxConfig.toke, influxConfig.org);
const topicMqtt = 'sensor/';
const subtopics = ['info', 'temp_hum', 'MQ2', 'PPM']
var params = {}
//everything here should become a send to the influx db
const matchtopic = (element) => element === t;
const parseInfo = (data) => {
    console.log("\tID: " + data['id'] + " Signal: " +data['RSS'] + "db Coordinates: "+ data['gps'].lat+"°, "+data['gps'].lon+"°");
    if(!data['id'] in params){
        params[id]["lat"] = data['gps']['lat'];
        params[id]["lon"] = data['gps']['lon'];
    }
    influxClient.writeDB(data['id'], data['gps']['lat'], data['gps']['lon'], 'rss', data['RSS']);
};
const parseTempHum = (data) => {
    console.log("\t" + data['temperature'] + "° " + data['humidity']+"%");
    if(!data['id'] in params)
        return;
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'temp', data['temperature']);
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'hum', data['humidity']);

    
};
const parseMQ2 = (data) =>  {
    console.log("\t" + data["smoke"] + " AQI: " + data["AQI"] + " avg " + data["avg"]);
    if(!data['id'] in params)
        return;
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'smoke', data['smoke']);
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'aqi', data['AQI']);
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'avg', data['avg']);
    
};
const parsePPM = (data) => {
    console.log("\t" +
        'CO: ' + data['CO'] +"\n\t" +
        'CO2: ' + data['CO2'] +"\n\t" +
        'NH4: ' + data['NH4'] +"\n\t" +
        'Alchool: ' + data['al'] +"\n\t" +
        'Toluen: ' + data['to'] +"\n\t" +
        'Aceton: ' + data['ac']
    );
    if(!data['id'] in params)
        return;
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'co', data['CO']);
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'co2', data['CO2']);
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'nh4', data['NH4']);
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'al', data['al']);
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'to', data['to']);
    influxClient.writeDB(data['id'], params[data['id']].lat, params[data['id']].lon, 'ac', data['ac']);

    };

const fnArr = [parseInfo, parseTempHum, parseMQ2, parsePPM]

function parse(payload, topic, proto){
    msg = JSON.parse(payload.toString());
    t = topic
    i = subtopics.findIndex(matchtopic)
    console.log('\n'+proto+ ' on '+topic);
    console.log('From sensor ' + msg['id']);
    i !== -1 ? fnArr[i](msg) : console.log('error');
}

module.exports = {
    topicMqtt, 
    subtopics,
    parse
}
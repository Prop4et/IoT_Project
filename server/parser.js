//info -> RSS, 'id', gps
//temp_hum -> temperature and humidity
//MQ2 -> AQI smoke
//PPM -> smoke, CO, CO2, alcohol, toluen, NH4, aceton
const influx = require('./influx');
const influxConfig = require('./influxconfig')
const influxClient = new influx.InfluxClient(influxConfig.remotehost, influxConfig.port, influxConfig.token, influxConfig.org);
const topicMqtt = 'sensor/';
const subtopics = ['info', 'temp_hum', 'MQ2', 'PPM']
//everything here should become a send to the influx db
const matchtopic = (element) => element === t;
const parseInfo = (data, lat, lon) => {
    console.log("\tID: " + data['id'] + " Signal: " +data['RSS'] + "dbm");
    var id = data['id'];
    influxClient.writeDB(data['id'], lat, lon, 'rss', data['RSS']);
};
const parseTempHum = (data, lat, lon) => {
    console.log("\t" + data['temperature'] + "° " + data['humidity']+"%");
    if(data['temperature'] > -300)
        influxClient.writeDB(data['id'], lat, lon, 'temp', data['temperature']);
    if(data['humidity'] >= 0)
        influxClient.writeDB(data['id'], lat, lon, 'hum', data['humidity']);

    
};
const parseMQ2 = (data, lat, lon) =>  {
    console.log("\tSmoke: " + data["smoke"] + " AQI: " + data["AQI"] + " avg " + data["avg"]);
    influxClient.writeDB(data['id'], lat, lon, 'smoke', data['smoke']);
    influxClient.writeDB(data['id'], lat, lon, 'aqi', data['AQI']);
    influxClient.writeDB(data['id'], lat, lon, 'avg', data['avg']);
    
};
const parsePPM = (data, lat, lon) => {
    console.log("\t" +
        'CO: ' + data['CO'] +"\n\t" +
        'CO2: ' + data['CO2'] +"\n\t" +
        'NH4: ' + data['NH4'] +"\n\t" +
        'Alchool: ' + data['al'] +"\n\t" +
        'Toluen: ' + data['to'] +"\n\t" +
        'Aceton: ' + data['ac']
    );
    influxClient.writeDB(data['id'], lat, lon, 'co', data['CO']);
    influxClient.writeDB(data['id'], lat, lon, 'co2', data['CO2']);
    influxClient.writeDB(data['id'], lat, lon, 'nh4', data['NH4']);
    influxClient.writeDB(data['id'], lat, lon, 'al', data['al']);
    influxClient.writeDB(data['id'], lat, lon, 'to', data['to']);
    influxClient.writeDB(data['id'], lat, lon, 'ac', data['ac']);

    };

const fnArr = [parseInfo, parseTempHum, parseMQ2, parsePPM]

function parse(msg, topic, lat, lon, proto){
    //msg = JSON.parse(payload.toString());
    t = topic
    i = subtopics.findIndex(matchtopic)
    console.log('\n'+proto+ ' on '+topic);
    console.log('From sensor ' + msg['id']);
    i !== -1 ? fnArr[i](msg, lat, lon) : console.log('error');
}

module.exports = {
    topicMqtt, 
    subtopics,
    parse
}
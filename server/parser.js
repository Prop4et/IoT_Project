
//everything here should become a send to the influx db
function parseInfo(data){
    console.log("MQTT: Info> ID: ", data['id'] + " Signal: " +data['RSS'] + "db Coordinates: "+ data['gps'].lat+"°, "+data['gps'].lon+"°");
}

function parseTempHum(data){
    console.log("MQTT: Temperature and Humidity>", data['temperature'] + "° " + data['humidity']+"%");
}

function parseMQ2(data){
    console.log("MQTT: MQ2 params>", "smoke: " + data["smoke"] + " AQI: " + data["AQI"] + " avg " + data["avg"]);
}

function parsePPM(data){
    console.log("MQTT: PPM> \n\t" +
    'CO: ' + data['CO'] +"\n\t" +
    'CO2: ' + data['CO2'] +"\n\t" +
    'NH4: ' + data['NH4'] +"\n\t" +
    'Alchool: ' + data['alcohol'] +"\n\t" +
    'Toluen: ' + data['toluen'] +"\n\t" +
    'Aceton: ' + data['aceton']
);
}

module.exports = {
    parseInfo,
    parseTempHum,
    parseMQ2,
    parsePPM
}
//info -> RSS, id, gps
//temp_hum -> temperature and humidity
//MQ2 -> AQI smoke
//PPM -> smoke, CO, CO2, alcohol, toluen, NH4, aceton

const topicMqtt = 'sensor/';
const subtopics = ['info', 'temp_hum', 'MQ2', 'PPM']

//everything here should become a send to the influx db
const matchtopic = (element) => element === t;
const parseInfo = (data) => {console.log("\tID: " + data['id'] + " Signal: " +data['RSS'] + "db Coordinates: "+ data['gps'].lat+"°, "+data['gps'].lon+"°")};
const parseTempHum = (data) => {console.log("\t" + data['temperature'] + "° " + data['humidity']+"%")};
const parseMQ2 = (data) =>     {console.log("\t" + data["smoke"] + " AQI: " + data["AQI"] + " avg " + data["avg"])};
const parsePPM = (data) => {console.log("\t" +
                                        'CO: ' + data['CO'] +"\n\t" +
                                        'CO2: ' + data['CO2'] +"\n\t" +
                                        'NH4: ' + data['NH4'] +"\n\t" +
                                        'Alchool: ' + data['al'] +"\n\t" +
                                        'Toluen: ' + data['to'] +"\n\t" +
                                        'Aceton: ' + data['ac']
                                        )};

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
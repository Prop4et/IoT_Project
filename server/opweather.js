const request = require('request'); 
const influx = require('./influx');
const influxConfig = require('./config').influx
const influxClient = new influx.InfluxClient(influxConfig.host, influxConfig.port, influxConfig.token, influxConfig.org);

const API_KEY = require('./config').ow.API_KEY

//asks openweather for temperature (max and min and computes the average) and humidity  
function forecast(lat, lon){ 
  
var url = 'http://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon='+ lon +'&appid='+API_KEY
  
    request({ url: url, json: true }, (error, response) => { 
        if (error) { 
            console.log('Unable to connect to Forecast API'); 
        } 
        else { 
            avgtemp = ((response.body.main.temp_min + response.body.main.temp_max)/2)  - 273.15;
            avghum = response.body.main.humidity;
            
            influxClient.writeOW(lat, lon, "opweather", avgtemp, "temp");
            influxClient.writeOW(lat, lon, "opweather", avghum, "hum");

        } 
    })
} 

module.exports = {
    forecast
}
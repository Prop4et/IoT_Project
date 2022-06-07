const request = require('request'); 
const influx = require('./influx');
const influxConfig = require('./influxconfig')
const influxClient = new influx.InfluxClient(influxConfig.remotehost, influxConfig.port, influxConfig.token, influxConfig.org);
var API_KEY = '70db7dbca3722a9613cc28ebb4190af7';

  
const forecast = (lat, lon) => { 
  
var url = 'http://api.openweathermap.org/data/2.5/weather?lat=' + lat + '&lon='+ lon +'&appid='+API_KEY
  
    request({ url: url, json: true }, (error, response) => { 
        if (error) { 
            console.log('Unable to connect to Forecast API'); 
        } 
        else { 

            avgtemp = response.body.main.temp - 273.15
            avghum = response.body.main.humidity
            console.log(avgtemp.toFixed(2), avghum);
        } 
    })
} 
  
var lat = 44.501; // Indore latitude 
var lon = 11.350; // Indore longitude 
  
// Function call 
forecast(lat, lon); 

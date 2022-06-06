const request = require('request'); 
var API_KEY = '70db7dbca3722a9613cc28ebb4190af7';

  
let temp = 0
const forecast = function (latitude, longitude) { 
  
var url = `http://api.openweathermap.org/data/2.5/weather?`
            +`lat=${latitude}&lon=${longitude}&appid=${API_KEY}`
  
    request({ url: url, json: true }, function (error, response) { 
        if (error) { 
            console.log('Unable to connect to Forecast API'); 
        } 
          else { 
            console.log(JSON.stringify(response));
        } 
    }) 
} 
  
var latitude = 44.501; // Indore latitude 
var longitude = 11.350; // Indore longitude 
  
// Function call 
forecast(latitude, longitude); 

console.log(temp)